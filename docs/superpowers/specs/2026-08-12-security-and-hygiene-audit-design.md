# Security and hygiene audit — design

Date: 2026-08-12
Status: approved for planning

## Purpose

A review of the app for bad standards, code abnormalities and vulnerabilities, and
fixes for what it found. The audit ran wide; the fixes are deliberately narrow.

That split is the governing constraint. `CLAUDE.md` is an unusually dense record of
invariants where plausible-looking cleanups caused real production bugs — the `%20`
duplicate feed mints, the ping-pong duration desync, the favorite-status cache. The
app also has no preview environment (`git push origin main` *is* the deploy) and no
automated coverage of its UI paths. So a fix is in scope only if it is self-contained
and verifiable. Everything else is reported.

## Findings

Severity is about this app, not a generic scale.

### Critical

**1. Authenticated routes trust an unauthenticated client-supplied header.**

`app/api/nostr/auth/login/route.ts:108` sets `id: hexPubkey` — the `User` primary key
*is* the user's Nostr public key, which is public by definition: present in every event
they publish, readable off the Community tab, derivable from any npub.

Every authenticated route then authorizes on `request.headers.get('x-nostr-user-id')`
with no verification of any kind. The login route does correctly verify a signed Nostr
event (`verifyEvent` plus a `getEventHash` reconstruction check), but it issues no
session token, so that verification protects nothing once the call returns.

Reproduction, using only public information:

```
curl -X DELETE 'https://stablekraft.app/api/favorites/delete-all?type=all' \
     -H 'x-nostr-user-id: <victim hex pubkey>'
```

This destroys the victim's entire favorites library. `CLAUDE.md` states those rows are
the only copy, which is why `SHARED_FAVORITES_APPLY_DELETES` ships off and why the
reconcile has a `max(5, 50%)` sanity cap. Both guards sit downstream of an open door.

The same header also permits editing another user's profile row
(`app/api/nostr/profile/update/route.ts:16`) and reading their full favorites list.
Roughly 20 routes are affected.

`x-session-id` has the same shape for anonymous users, compounded by finding 7.

### High

**2. Unauthenticated SSRF with response reflection — `app/api/fetch-feed-metadata`.**
No allowlist, no protocol restriction, no `isSafePublicUrl`. It fetches any URL the
caller names and returns the parsed body, so link-local and RFC-1918 hosts are both
reachable and readable. The route has **no callers** anywhere in the app.

**3. SSRF — `app/api/gif-placeholder`.** Requires `https:` and a `.gif` substring, but
nothing rejects private hosts, so `https://10.0.0.5/x.gif` is fetched. Live: called
from `components/CDNImage.tsx:178`.

**4. CSP declares only `connect-src`** (`next.config.js:701`). No `default-src`,
`script-src`, `object-src`, `base-uri`, or `frame-ancestors`. Framing is separately
covered by `X-Frame-Options: DENY`, but the policy otherwise constrains nothing.

**4a. Unauthenticated DoS — `POST /api/favorites/check`.** Takes `trackIds` and
`feedIds` from the body with no size cap, no `Array.isArray` check and no rate limit.
The tracks branch is quadratic: `trackIds.forEach(...)` wraps `tracks.find(...)`
(`route.ts:62-71`), so n inputs against m matched tracks is n·m comparisons over three
fields each. Track ids are semi-public — `/api/albums-fast` returns them — so 10k
scraped ids are ~100M comparisons on the event loop from a single request. No identity
is required: the guard is `if (!sessionId && !userId)` and `x-session-id` is an
arbitrary caller-supplied string, so `-H 'x-session-id: x'` passes it. With
`connection_limit=3` (`lib/prisma.ts:19`) a few concurrent requests saturate the pool
while the loop is already blocked.

Bounded by two things, which is why this is High and not Critical: `feedLookupWhere` is
two indexed `IN`s, so the album branch is linear and the amplification is confined to
the tracks branch; and the impact is availability only — no data loss, no privilege
escalation, recovers on restart.

This was originally filed under Low/performance as part of finding 12. That was wrong:
finding 12 is about queries that are merely unbounded by construction, whereas this one
is attacker-controlled, unauthenticated and amplifying.

### Medium

**5. `Access-Control-Allow-Origin: *` on all of `/api/*`** (`next.config.js:632`). Lets
any origin read every API response, and is incompatible with credentialed requests once
a cookie exists — so it is coupled to finding 1 and must change with it.

**6. Raw error text returned to clients** in 22 routes (`details: errorMessage`),
exposing Prisma driver messages and internal paths.

**7. `Math.random()` session IDs** (`lib/session-utils.ts:14`). These key anonymous
favorites and are guessable.

**8. No lint or typecheck runs anywhere.** `npm run build` passes `--no-lint`, and none
of the five workflows in `.github/workflows/` run `lint` or `tsc --noEmit`. Type errors
surface only as Railway build failures — the failure mode `CLAUDE.md` already documents
for the three-`select` favorites concat.

**9. `/test-amber` (1,341 lines) and `/sandbox/album` are reachable in production.**

**10. `X-XSS-Protection: 1; mode=block`** (`next.config.js:609`) — deprecated, and
itself an XSS vector in older browsers. The modern value is `0`.

### Low / performance

**11. 1,355 `console.log` calls** on shipped paths. `CLAUDE.md` records two Railway
log-flood incidents already (`/api/proxy-image` twice).

**12. Unbounded `findMany`** on user-facing favorites routes (`sync-shared` ×6,
`tracks` ×4). Fine at current scale, unbounded by construction. These read a user's own
rows and are not attacker-amplifiable — unlike finding 4a, which was originally filed
here in error.

### Verified sound

Recorded so a later reader does not re-investigate: the login route's signature
verification is correct; `proxy-video` is properly domain-allowlisted;
`proxy-image` / `proxy-audio` / `chapters` do use `isSafePublicUrl`; the
`FavoriteAlbum` / `FavoriteTrack` indexes cover their query patterns.

## Design

### Phase 1 — session authentication

The only change here that is not self-contained, and the reason the rest is sequenced
behind it.

**`lib/auth/session.ts`** — a pure, dependency-free module so it is unit-testable
without a browser or a database, matching the `lib/feed-lookup.ts` precedent:

- `signSession(userId, now)` → `base64url(payload) + '.' + HMAC-SHA256(payload, SESSION_SECRET)`
  where payload is `{ uid, iat }`.
- `verifySession(token, now)` → `{ userId } | null`. Compares with
  `crypto.timingSafeEqual`. Rejects on bad format, bad signature, or `iat` older than
  90 days.

**`lib/auth/require-user.ts`** — `requireUser(request)` returns the verified user id or
null, reading the cookie and ignoring `x-nostr-user-id` entirely. One helper replaces
the raw header read in all affected routes.

**Login** sets the token as `httpOnly; Secure; SameSite=Lax; Path=/; Max-Age=90d`. The
Capacitor WebView loads the live origin, so one cookie covers browser, PWA and APK.

**Fail-open when `SESSION_SECRET` is unset**, with a warn log, matching the existing
`ADMIN_SECRET` convention in `lib/admin-auth.ts`. This makes the deploy incapable of
breaking favorites for everyone, at the cost that the vulnerability stays live until
the env var is set. **Setting `SESSION_SECRET` in Railway before merging is therefore a
required step, not a follow-up** — the fix is inert without it.

**Migration is a one-time re-login.** A request carrying the legacy header but no valid
cookie gets a 401; `NostrContext` clears the stored session and opens the login modal.
Every current user pays one signer approval. No compatibility window: a window would
leave the hole fully open for its duration, since an attacker simply omits the cookie.

**CORS** narrows from `*` to an explicit origin allowlist. The four podping-consumer
endpoints (`/api/feeds/exists`, `/api/feeds/refresh-by-url`, `POST /api/feeds`,
`/api/feeds/opml`) keep permissive CORS — `msp-podping-service` depends on them and
`CLAUDE.md` marks them intentionally public.

### Phase 2 — SSRF and response headers

- Delete `app/api/fetch-feed-metadata` (finding 2). It has no callers; deleting beats
  hardening an unused remote-fetch endpoint.
- Add `isSafePublicUrl` to `app/api/gif-placeholder` (finding 3), following the
  `/api/chapters` https-only pattern.
- Write a real CSP (finding 4), preserving the existing `connect-src` list verbatim so
  no relay or wallet socket breaks. `script-src` must accommodate the inline script at
  `app/layout.tsx:90` and Next's inline bootstrap — so it ships **`Content-Security-Policy-Report-Only`
  first**, because a wrong `script-src` white-screens the entire app and there is no
  preview environment to catch it.
- `X-XSS-Protection: 0` (finding 10).
- Bound `POST /api/favorites/check` (finding 4a): reject non-array bodies, cap both
  arrays at a documented limit, and replace the nested `tracks.find` with a Map keyed
  by id, guid and audioUrl so the branch is linear. The cap must sit above the largest
  batch the client actually sends — `BatchedFavoritesContext` is the only caller, so
  the real batch size is measured from it rather than guessed, and a request over the
  cap is rejected outright rather than silently truncated (a truncated response would
  read as "not favorited" and re-create the issue #190 symptom).
- Replace client-facing `details: errorMessage` with a generic message, keeping the
  detail in the server log (finding 6).

### Phase 3 — hygiene

- `crypto.randomUUID()` in `lib/session-utils.ts`, with a fallback for insecure
  contexts, since the LAN-testing flow in `CLAUDE.md` uses plain `http://<lan-ip>:3000`
  where `crypto.randomUUID` is unavailable (finding 7).
- Gate `/test-amber` and `/sandbox/album` to non-production via `notFound()` (finding 9).
  **Not deleted**: `/sandbox/album` is a live dev harness that `lib/album-detail-routes.ts`
  and `lib/album-detail-routes.test.ts` both depend on, and the puppeteer verification
  recipes in `CLAUDE.md` run against `npm run dev`, where the gate is inactive.
- Add a `typecheck` script (`tsc --noEmit`) and a CI workflow running it plus the
  existing `node:test` suites (finding 8).
- Lint: report the current error count. Restore it to the build only if the backlog is
  small enough to clear in this change; otherwise report and leave `--no-lint` in place.
  Turning on a failing gate would block deploys, which are this repo's only path to
  production.

Findings 11 and 12 are **reported, not fixed**. Removing 1,355 log statements is a
large diff across files the audit is otherwise avoiding, and the `findMany` calls are
correct at current data volumes. Both belong in separate, scoped work.

## Out of scope

Not edited under any circumstances in this change; anything found is written up:
`contexts/AudioContext.tsx`, `lib/feed-lookup.ts` and the lookup ladder,
`lib/favorite-feed-ids.ts` and favorite id expansion, the Android ping-pong transition,
and the Nostr signing paths (`lib/nostr/nip46-client.ts`, `lib/nostr/signer.ts`).

## Verification

- Unit tests in this repo's `node:test` + `tsx` pattern: token sign/verify round trip,
  expiry, signature tampering, malformed input, and the missing-secret fail-open path.
- A test asserting `gif-placeholder` rejects private hosts.
- A test for the `favorites/check` cap: an over-cap request is rejected, a non-array
  body is rejected, and an at-cap request still returns correct favorited status for
  every id (the linearisation must not change results).
- `npm run build` for the typecheck. Dev server stopped first — both write `.next`, and
  `CLAUDE.md` documents the resulting asset 400s.
- Full existing suite before and after:
  `npx tsx --test lib/*.test.ts lib/*/*.test.ts`.
- Manual check that a logged-out user can still browse, favorite anonymously, and log
  in, since Phase 1 touches that path.

## Deploy sequence

Order matters and is not optional:

1. Set `SESSION_SECRET` in Railway. The fix is inert without it (fail-open by design).
2. Deploy. Signed-in users are prompted to log in once.
3. Watch for CSP report-only violations before switching to enforcing mode.
