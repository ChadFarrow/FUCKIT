---
name: auth-and-security
description: "Use when touching authentication, authorization or hardening: ADMIN_SECRET and the middleware.ts bearer gate, SESSION_SECRET and the signed session cookie in lib/auth/, requireUser, the x-nostr-user-id header (must never be trusted), adding or gating an admin route, a 401 from an admin endpoint, the SSRF guard isSafePublicUrl in lib/url-security.ts, any endpoint that fetches a caller-supplied URL, /api/proxy-image or /api/proxy-audio, CORS, the Content-Security-Policy, response headers leaking Prisma errors, rate limiting, or CI (typecheck, test:all, next lint)."
---

# auth-and-security

Two independent secrets (ADMIN_SECRET gates the operator, SESSION_SECRET gates the user), the SSRF guard, and response/CORS/CSP hardening.

## Tests for this subsystem

```
npx tsx --test lib/auth/*.test.ts                   # session token, requireUser, session-expired
npx tsx --test lib/favorites-check-input.test.ts    # favorites/check input cap + first-match-wins index
```

---

## Admin API Auth (`ADMIN_SECRET`, since PR #153)
`middleware.ts` + `lib/admin-auth.ts` enforce a bearer secret on destructive/expensive endpoints: all `/api/admin/*` **except** `/api/admin/verify` (npub-whitelist login check — must stay open or AdminPanel login breaks), `PUT`/`DELETE /api/feeds`, `DELETE /api/tracks`, `/api/parse-feeds`, `/api/playlist-cache`, `/api/playlist/parse-feeds(-stream)`, and `GET /api/playlist/<name>?refresh=true` (plain playlist GETs stay public — the gate is the query param). The four podping-consumer endpoints above are never gated.

- **Ad-hoc curl to any gated endpoint needs `-H "Authorization: Bearer $ADMIN_SECRET"`** — including the documented duplicate-fix (`DELETE /api/feeds?id=`) and stale-track (`DELETE /api/tracks?id=`) flows.
- **Fail-open by design**: if the `ADMIN_SECRET` env var is unset, auth passes with a warn log (deploys can't lock out crons before secrets exist). Do **not** "fix" this to fail-closed without coordinating all three secret locations.
- **Secret lives in three places** — Railway env (enforcement), GitHub Actions secret (workflows send it via `AUTH_HEADER` env in both refresh workflows), browser `localStorage['admin_secret']` (AdminPanel routes gated calls through `adminFetch` in `lib/admin-fetch.ts`, which prompts on first 401). Rotate = update all three.
- When adding an admin route, the `/api/admin/:path*` matcher covers it automatically. When adding a *non-admin* gated path, update both `requiresAdminAuth()` **and** the `matcher` array in `middleware.ts` — a path missing from the matcher silently bypasses auth.
- The radio-subdomain rewrite in `middleware.ts` is gated on `!pathname.startsWith('/api/')` — keep it that way.
- **`ADMIN_SECRET` gates the operator; `SESSION_SECRET` gates the user.** Two independent secrets, two independent fail-open paths. Admin routes still return `details:` on errors deliberately — they are behind the bearer gate and the detail is operator-facing. Public routes must not (see Response Headers below).

---

## Session Auth (`SESSION_SECRET`, `lib/auth/`, since the 2026-08-12 security audit)
**User identity is a signed cookie. It is never a request header.** `requireUser(request)` (`lib/auth/require-user.ts`) is the ONLY way a route learns who is calling — `grep -rn "x-nostr-user-id" app/api` must stay empty.

Why this exists: `User.id` **IS the user's hex Nostr pubkey** (`app/api/nostr/auth/login/route.ts` — `id: hexPubkey`), which is public by definition. Every authenticated route used to authorize on `request.headers.get('x-nostr-user-id')`, so `curl -X DELETE '.../api/favorites/delete-all?type=all' -H 'x-nostr-user-id: <victim pubkey>'` destroyed anyone's library with only public information. Favorites rows are the only copy — that is why `SHARED_FAVORITES_APPLY_DELETES` ships off and the reconcile has a 50% cap; both guards sat downstream of an open door.

- **`lib/auth/session.ts` is pure** (no env, no Next, no Prisma — secret passed in) so it unit-tests without a browser. Token is `v1.<base64url payload>.<base64url hmac>`, payload `{"uid","iat","p"}`, HMAC-SHA256 over `v1.<payload>`, `timingSafeEqual`, 90-day expiry, future-`iat` rejected. Tests: `npx tsx --test lib/auth/session.test.ts lib/auth/require-user.test.ts lib/auth/session-expired.test.ts`.
- **`{ write: true }` on every mutating route.** It additionally requires a *proven* session. Reads omit it. The per-handler mapping is not guessable from the HTTP verb alone — `POST /api/favorites/check` is a READ and correctly takes no write flag.
- **The `p` (proven) claim is the nip05 firewall.** `/api/nostr/auth/login` verifies a signed event (`getEventHash` reconstruction + `verifyEvent`) → `p:1`. `/api/nostr/auth/nip05-login` proves nothing and mints **no cookie at all** (see the Login Modal section). Only `login/route.ts` may call `sessionCookie()` — `grep -rln sessionCookie app/api` should return exactly that one file.
- **FAIL-OPEN when `SESSION_SECRET` is unset**, mirroring `ADMIN_SECRET`, with a one-time warn. A deploy therefore cannot lock everyone out — but **the fix is completely inert until the Railway env var is set**. Set it *before* the deploy, not after. Generate with `openssl rand -base64 48`.
- **The cookie omits `Secure` outside production** on purpose — the documented phone-testing flow uses a plain `http://<lan-ip>:3000` origin, where a Secure cookie would never be sent.
- **Clients send nothing.** Same-origin `fetch` attaches cookies by default, and the Capacitor WebView loads the live origin, so the ~23 client sites that still pass `x-nostr-user-id` are inert and harmless. Don't bother removing them; don't add new ones.
- **`contexts/NostrContext.tsx` probes `/api/nostr/auth/session` on mount** and logs out ONLY on `{ error: 'session_expired' }` — a bare status check would log users out on unrelated admin 401s, and the catch must stay non-destructive (offline ≠ expired). It sends the legacy header so it fails open like every other route, and it **skips `loginType === 'nip05'`** (those sessions have no cookie by design; probing them logs them out on every load). The probe is deliberately NOT `/api/nostr/auth/me`, which opens relay connections and fetches a kind-0 profile.
- **No `?userId=` overrides.** `activity`/`followers`/`following` used to let a query param override the authenticated identity, exposing `BoostEvent.paymentHash` to anyone with a public pubkey. Never reintroduce a caller-supplied identity parameter.
- **Rotating `SESSION_SECRET` logs everyone out.** Nothing worse.

**`POST /api/favorites/check` is bounded** (`lib/favorites-check-input.ts`, tests alongside). It was an unauthenticated DoS: `trackIds`/`feedIds` uncapped and untyped, with a quadratic `trackIds.forEach` wrapping `tracks.find`, and `x-session-id` is arbitrary caller text so no login was needed. `buildTrackIdIndex` makes it linear and **must preserve first-match-wins** to match the `Array.find` it replaced. Over-cap **rejects with 400, never truncates** — a truncated answer reads as "not favorited" and re-creates the issue #190 symptom.

---

## SSRF Guard (`lib/url-security.ts`)
`isSafePublicUrl(url, { allowHttp? })` rejects private/internal hosts (localhost, RFC-1918, link-local, `.local`/`.internal`). Used by `/api/chapters` (https-only), `/api/proxy-image` (returns placeholder on rejection — never break Next Image), `/api/proxy-audio` (400), `/api/gif-placeholder` (400) and `/api/fetch-feed-metadata` (400). Any new endpoint that fetches a caller-supplied URL must use it.

**It returns `UrlCheckResult = { ok: true; url } | { ok: false; error }` — NOT a boolean.** Always `const c = isSafePublicUrl(u); if (!c.ok)`. Writing `if (!isSafePublicUrl(u))` negates an object, is always `false`, and the guard becomes dead code that rejects nothing — **and `tsc --noEmit` stays clean**, because negating an object is legal TypeScript. That shipped in both new guards and was caught only in review. Verify a guard empirically, never by reading it:
```
npx tsx -e "import {isSafePublicUrl} from './lib/url-security'; for (const u of ['https://10.0.0.5/x.gif','http://169.254.169.254/','https://example.com/a.gif']) { const r = isSafePublicUrl(u); console.log(u, r.ok, r.ok ? '' : r.error); }"
```
Known limits: string check only, no DNS-rebinding defense, and **no route sets `redirect: 'manual'`**, so a permitted public URL can still 302 to a private host. That gap is shared by all five routes and is not yet closed.

**`/api/proxy-image` — every rejection path must `returnPlaceholderImage()`, never pass bytes through.** The content-type guard is intentionally lenient (`!isValidImageType && !hasImageExtension`) so a URL merely *ending* in `.png`/`.jpg` survives a wrong `Content-Type`. That means the signature check below it is the real gate: when the magic bytes don't match **and** the server didn't claim `image/*`, it is an HTML error page, not an image — return the placeholder. It used to only log "proceeding with content-type: text/html" and serve the HTML, which made Next's optimizer emit `⨯ The requested resource isn't a valid image … received null` **once per card referencing that image**, flooding Railway logs. Keep the condition scoped to "signature mismatch AND no image content-type" so AVIF/HEIC/TIFF (valid, not in the signature list, but correctly typed) still pass.

**Animated GIF artwork — render it through `components/ArtworkImage.tsx`, never bare `next/image`.** The Next optimizer *refuses* to process animated images, but it still fetches and buffers the whole file before logging `⚠ The requested resource … is an animated image so it will not be optimized` to stderr — one line **per card referencing the image**, which Railway records at `severity=error`. Same log-flood family as the "isn't a valid image" case above. It is not only noise: Homegrown Hits ships **~19 MB animated GIFs per episode**, so one HGH track list pushed hundreds of MB through the Next server for images it was never going to optimize. `ArtworkImage` is a thin `next/image` wrapper that sets `unoptimized` exactly when `isAnimatedArtworkUrl(src)` (`lib/cdn-utils.ts`, unwraps `/api/proxy-image?url=<encoded>`; tests: `npx tsx --test lib/cdn-utils.test.ts`) — everything else stays on the optimized path. Every site rendering feed-supplied artwork uses it; `CDNImage` and `AlbumCard` already set `unoptimized` themselves. Verify a change by server-rendering the component and asserting the GIF's `src` is **not** a `/_next/image?…` URL.

Two supporting guards in the route, both driven by those 19 MB GIFs:
- **The in-memory cache is bounded by bytes, not just entries.** `MAX_CACHE_ENTRIES` alone let a handful of GIFs pin hundreds of MB of Railway RSS; `MAX_CACHE_BYTES` (96 MB) plus `MAX_CACHEABLE_IMAGE_BYTES` (4 MB, skip-don't-cache) keep it bounded. `cacheBytes` must be maintained by `dropCacheEntry()` on **every** removal path — a direct `imageCache.delete()` leaks the counter and the cache silently stops accepting entries.
- **The fetch timeout is GIF-aware** (12s vs the 3s default). `AbortSignal.timeout` covers the body read, and 19 MB in 3s needs a sustained >6 MB/s, so GIF art intermittently aborted into the placeholder (`⚠️ Image fetch timeout` in the logs).

---

## Response Headers, CORS and CI (`next.config.js`, `.github/workflows/ci.yml`)
- **CORS is NOT `*` on `/api/*` any more.** Only the four podping-consumer endpoints keep a wildcard (`/api/feeds/:path(exists|refresh-by-url|opml)` and `/api/feeds`) — they carry no user data and `msp-podping-service` calls them server-to-server. Everything else sends no CORS headers at all, which is correct: the app is same-origin and the session cookie can't ride a wildcard anyway. Note ~18 route files still hardcode `ACAO: *` in their own handlers; all are public read-only.
- **CSP is `Content-Security-Policy-Report-Only`, deliberately.** Full directive set (`default-src`, `script-src`, `object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors 'none'`) with **`connect-src` copied verbatim** from the old policy so no relay or wallet socket changes. It is report-only because a wrong `script-src` white-screens the app, there is no preview environment, and `app/layout.tsx` ships an inline `<script>`. **Switching it to enforcing is a deliberate follow-up** — watch the browser console across home/album/favorites/admin/radio/Now Playing/login/boost first. There is no `report-uri`, so nothing is collected from real users yet. Caveat: `script-src` carries `'unsafe-inline' 'unsafe-eval'` and `connect-src` carries bare `https:`, so even enforcing it will not stop XSS — it buys `object-src`/`base-uri`/`form-action`/external-script hardening, nothing more.
- **`X-XSS-Protection: 0`** — the legacy auditor is deprecated and was itself an XSS vector. Do not set it back to `1; mode=block`.
- **Public routes must not return raw error text.** `details:` and `error: err.message` both leaked Prisma driver messages and internal paths. Log server-side, return a generic string. Dev-gated (`NODE_ENV === 'development'`) details are fine. Admin routes are exempt (behind `ADMIN_SECRET`). The `error: <raw message>` idiom still survives at ~50 non-admin sites — finding is only partly closed.
- **CI runs `typecheck`, `test:all` and `next lint`** on push to main and on PRs. `npm run build` **keeps `--no-lint`** on purpose: pushing to main IS the deploy, so a cosmetic lint rule must never be able to block shipping a fix. Lint informs in CI; it does not gate the build. Note CI's `push: main` trigger fires *after* the deploying push — it only truly gates if you start using PRs.
- Session IDs come from `crypto.randomUUID()` with a `getRandomValues` fallback (insecure contexts — the LAN phone-testing flow). Never `Math.random()`; these key anonymous favorites.
- `/test-amber` and `/sandbox/album` `notFound()` in production and stay fully usable under `npm run dev`. Don't delete them — `/sandbox/album` renders the real `AlbumDetailClient` and is pinned by `lib/album-detail-routes.test.ts`.
