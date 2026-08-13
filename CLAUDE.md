# Stablekraft App

Next.js 15 music app for Podcasting 2.0 — RSS feeds, V4V/Lightning payments, Nostr, musicL playlists.

**Most of what was in this file now lives in project skills** (`.claude/skills/*/SKILL.md`), loaded on demand
rather than on every turn. See *Where things are documented* below. The detail is unchanged — it moved, verbatim.

## Commands
```
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:studio    # Open Prisma Studio
npm run deploy       # Build deployment package (local)
git push origin main # Deploy to production (Railway auto-deploys from git)

npm run typecheck    # tsc --noEmit; CI runs this + test:all + next lint
npm run test:all     # everything

# Tests — there is NO jest/vitest. The pattern is node:test + tsx.
# `lib/*.test.ts` does NOT recurse — it misses lib/nostr, lib/caches and lib/downloads.
npx tsx --test lib/*.test.ts lib/*/*.test.ts        # everything (also `npm run test:all`)
```
Per-subsystem test commands live in the skill that owns the subsystem — each skill opens with its own.

## Boundaries
- Never commit secrets (`.env`, API keys). `SESSION_SECRET` and `ADMIN_SECRET` live in Railway env + `.env.local` only.
- **A grep that returns nothing is not evidence that nothing exists.** Under zsh, an unquoted `--include=*.tsx` errors with `no matches found` and prints nothing — indistinguishable from a clean result. This produced three wrong conclusions during the security audit, including "this route has no callers" about a live endpoint that was nearly deleted. Quote the globs, and check the exit status before believing an empty result.
- Run `npm run build` before committing — but **stop `npm run dev` first**. Both write `.next/`, so building over a live dev server replaces the chunks its running client already fetched, and every asset request 400s (`ERR_ABORTED` on `_next/static/...`) until the dev server is restarted. Symptom is a page stuck on its loading state with no obvious error. Recovery: kill dev, `rm -rf .next`, `npm run dev`. Any phone testing over the LAN needs a hard reload afterwards.
- **Testing on a phone over the LAN? The service worker will serve it stale content.** `next-pwa` is disabled in dev, but a production `npm run build` writes `public/sw.js` + `public/workbox-*.js`, and Next serves `public/` statically **even in dev** — so any device that registered the worker keeps getting its cached HTML shell and CSS from `http://<lan-ip>:3000`. Symptom: the phone shows a layout you already changed, often with CSS partly missing (flex `gap`s collapsing, so text runs together) because the shell and the stylesheet come from different builds. A plain reload does not fix it. Delete `public/sw.js` and `public/workbox-*.js` (both gitignored build artifacts) so `/sw.js` 404s — the browser then drops the registration on next load — and reload twice, or use a private tab. Worth deleting them after every local `npm run build` you didn't intend to deploy.
- No `src/` directory — all source lives in `app/`, `lib/`, `components/`, `contexts/`
- No `deploy-*/` artifacts in the repo — add to `.gitignore` if generated
- No JSON-file databases — all data is in PostgreSQL via Prisma
- Android keystore at `~/keystores/stablekraft-release.jks`, creds in `~/.stablekraft-android.env` — never commit either. Losing the keystore = losing the ability to ship updates to installed users.

## Tech Stack
- Next.js 15 (App Router), React 18, TypeScript, PostgreSQL/Prisma
- Podcast Index API for all feed lookups and resolution (never fetch directly from Wavlake — use PI API)
- Nostr for auth, Lightning (Alby/WebLN) for payments


Two repos: **musicL-playlist-updater** generates playlist XML feeds; **stablekraft-app** (this one) consumes them.

## Cross-cutting invariants

These span several subsystems, so they stay here rather than in any one skill. The skill named at the end of each
line holds the full story.

- **`git push origin main` IS the production deploy.** There is no preview environment. `NEXT_PUBLIC_*` bakes at
  build time, so set it *before* the deploy that should use it.
- **Railway does not run migrations on deploy.** The Dockerfile has no `prisma migrate deploy`, so after merging a
  migration run `railway run --service StableKraft --environment production npm run db:migrate` **before** the code
  that reads the new column goes live — otherwise every query selecting it 500s (issue #122).
- **`isSafePublicUrl()` returns `{ ok, ... }`, not a boolean.** `if (!isSafePublicUrl(u))` negates an object, is
  always `false`, and silently turns the SSRF guard into dead code — and `tsc --noEmit` stays clean. Always
  `const c = isSafePublicUrl(u); if (!c.ok)`. Verify empirically, never by reading it → `auth-and-security`.
- **User identity is the signed session cookie, never a request header.** `requireUser(request)` is the only way a
  route learns who is calling; `grep -rn "x-nostr-user-id" app/api` must stay empty → `auth-and-security`.
- **Bump `API_VERSION` in `app/page.tsx`** whenever the `/api/albums-fast` response shape changes, or clients keep
  serving field-missing data out of localStorage indefinitely → `catalog-display`.
- **The same field is often written or read from N places, and fixing one is the standard bug here.**
  `/api/albums-fast` has **two** Track selects; `favorites/tracks` has **three** Feed selects; `podcastImages` has
  **three** write paths; the release date has **seven** read paths; `Feed.medium` has **ten** create/upsert paths
  and the first pass at it caught one; `AlbumDetailClient` duplicates props across its mobile and desktop rows.
  Adding or fixing a field means finding all of them → the owning skill. `grep -rn "prisma.<model>.create\|upsert"`
  before believing you have. Watch for **re-key** paths especially — `refresh-by-url` deletes a row and recreates it
  from a field-by-field copy, so a column missing from that list is silently dropped rather than merely unset.
- **`Feed.type` is this app's classification; `Feed.medium` is what the feed declared.** They are not
  interchangeable and the difference is load-bearing. `type` defaults to `"album"`, so it always has a value and
  that value is often a guess; `medium` is NULL until a feed actually says, and **nothing may default it**. Only
  `medium` goes on the cross-app favorites list, where a guess is sticky and no other app will correct it. Use
  `type` for local behaviour, `medium` for anything published or shown as fact → `favorites-cross-app`,
  `feed-ingestion`.
- **The shared favorites wire format is sequenced reader-first, across two repos and a spec.** The order is: land
  it in [PC20-Nostr](https://github.com/ChadFarrow/PC20-Nostr/blob/main/specs/pc20-favorites.md), teach **both**
  apps to *read* the new form, and only then start *writing* it. Writing a form the other app can't read doesn't
  fail — it silently makes favorites invisible on the far side, which is worse than the format it replaced. Right
  now StableKraft still writes the single list and a prefixed position 3 for exactly that reason, and adopting the
  split before Boost Me Bitch ships its reader is the mistake to avoid → `favorites-cross-app`.
- **Verify UI changes by measuring, not eyeballing** — puppeteer-core against the real component, asserting all
  four edges. Several bugs here survived a sweep that only checked one → `mobile-layout`.

## Where things are documented

Each is a skill under `.claude/skills/`; invoke it when the work touches its area.

| Skill | Covers |
|---|---|
| `feed-ingestion` | How feeds get in: podping consumer, the `lib/feed-lookup.ts` URL ladder, nightly cron, RSS parsing, adding a music podcast |
| `feed-curation` | How feeds get hidden or removed: `markedDead`, blacklists, dead-feed sweep, admin feed management, orphan cleanup |
| `catalog-display` | What the catalog shows: `albums-fast`, sorting, release date, search, album links, publisher pages, artwork |
| `auth-and-security` | `ADMIN_SECRET`, `SESSION_SECRET`, the SSRF guard, CORS/CSP/response headers, CI |
| `nostr-signer` | NIP-46/55/07 signers, the login modal, post-login flow, the publish queue |
| `favorites` | The favorites data model, polymorphic `feedId`, album-vs-track, the status cache, the Community tab |
| `favorites-cross-app` | The shared kind:30078 list synced with Boost Me Bitch |
| `audio-playback` | `AudioContext` playback: end of album, background audio, Android ping-pong, VTS |
| `android-native` | The Capacitor/zapstore APK: foreground service, wake lock, MediaSession, back button |
| `mobile-layout` | Safe-area insets, the player bar reserve, Now Playing, the mobile album page |
| `lightning-boost` | Wallets, NWC backup, BoostBox/Helipad, value splits, AutoBoost, failure triage |
| `downloads` | Offline downloads and manual Offline mode |
| `diagnostics` | Client error reporting and the admin diagnostics panel |
