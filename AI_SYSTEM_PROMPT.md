# Stablekraft App — AI Orientation

Context for an AI assistant working on this repo from a tool that can't read `.claude/`.

> **If your tool *can* read `.claude/`, use those instead.** [`CLAUDE.md`](CLAUDE.md) holds the
> authoritative project instructions and cross-cutting invariants; `.claude/skills/*/SKILL.md`
> holds 13 per-subsystem deep dives loaded on demand. This file is a short standalone summary that
> defers to them on every point. It is deliberately not a copy — an earlier 368-line duplicate of
> CLAUDE.md went three weeks stale and started contradicting it, which is the failure mode this
> shape exists to avoid.

## What the app is

A Next.js 15 music app for Podcasting 2.0. It ingests music from podcast RSS feeds via the Podcast
Index API, stores it in PostgreSQL, and adds Value4Value Lightning payments, Nostr identity, and
musicL playlists. Ships as a web app, a PWA, and a Capacitor Android build on zapstore.

**Stack:** Next.js 15 (App Router), React 18, TypeScript, Prisma + PostgreSQL, Nostr
(NIP-07/46/55), WebLN/NWC/LNURL.

**Layout:** no `src/`. Source is `app/`, `lib/`, `components/`, `contexts/`, `hooks/`.

See [`README.md`](README.md) for the directory tree, feature list, environment variables and API
surface.

## Rules that are not negotiable

These are the ones where getting it wrong causes damage rather than a failed build.

- **Never commit secrets.** `SESSION_SECRET` and `ADMIN_SECRET` live in Railway env and
  `.env.local` only. Same for the Android keystore at `~/keystores/stablekraft-release.jks` —
  losing it means losing the ability to ship updates to installed users.
- **`git push origin main` IS the production deploy.** There is no preview environment. Anything
  merged is live.
- **Railway does not run migrations.** The Dockerfile has no `prisma migrate deploy`. After merging
  a migration, run `railway run --service StableKraft --environment production npm run db:migrate`
  **before** the code reading the new column goes live, or every query selecting it 500s.
- **All feed lookups go through the Podcast Index API.** Never fetch Wavlake directly.
- **No JSON-file databases.** All data is PostgreSQL via Prisma. Scripts that read
  `data/music-tracks.json` are deprecated leftovers.
- **User identity is the signed session cookie, never a request header.** `requireUser(request)` is
  the only way a route learns who is calling. `grep -rn "x-nostr-user-id" app/api` must stay empty.
- **`isSafePublicUrl()` returns `{ ok, ... }`, not a boolean.** `if (!isSafePublicUrl(u))` negates
  an object, is always false, silently turns the SSRF guard into dead code — and `tsc --noEmit`
  stays clean. Always `const c = isSafePublicUrl(u); if (!c.ok)`.
- **A grep that returns nothing is not evidence that nothing exists.** Quote your globs and check
  the exit status. An unquoted `--include=*.tsx` under zsh errors and prints nothing, which is
  indistinguishable from a clean result. This produced three wrong conclusions during a security
  audit, including "this route has no callers" about a live endpoint that was nearly deleted.

## The pattern that causes most bugs here

**The same field is often written or read from N places, and fixing one of them is the standard
bug.** Real examples: `/api/albums-fast` has **two** Track selects; `favorites/tracks` has **three**
Feed selects; `podcastImages` has **three** write paths; the release date has **seven** read paths;
`Feed.medium` has **ten** create/upsert paths.

Before believing you've found them all: `grep -rn "prisma.<model>.create\|upsert"`. Watch **re-key**
paths especially — `refresh-by-url` deletes a row and recreates it from a field-by-field copy, so a
column missing from that list is silently dropped rather than merely unset.

Two more of the same shape, outside Prisma: a playlist must be registered in four places
(`docs/ADDING_PLAYLISTS.md`), and `AlbumDetailClient` duplicates props across its mobile and desktop
rows.

## Two columns that both answer "what kind of thing is this feed"

`Feed.type` is **this app's classification**; `Feed.medium` is **what the feed declared**. Not
interchangeable, and the difference is load-bearing:

- `type` defaults to `"album"`, so it always has a value and that value is often a guess.
- `medium` is NULL until a feed actually says so, and **nothing may default it**.
- Only `medium` goes on the cross-app favorites list, where a guess is sticky and no other app will
  correct it.

Use `type` for local behaviour, `medium` for anything published or shown as fact.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build — stop `npm run dev` first, both write .next/
npm run typecheck    # tsc --noEmit
npm run test:all     # tsx --test lib/*.test.ts lib/*/*.test.ts
npx next lint
npm run db:studio    # Prisma Studio
npm run db:migrate:dev
```

CI runs `typecheck`, `test:all` and `next lint`. **There is no jest or vitest** — tests are
`node:test` through `tsx`, and the glob does not recurse past one directory.

## Two repos, plus a spec

- **[musicL-playlist-updater](https://github.com/ChadFarrow/musicL-playlist-updater)** generates
  playlist XML feeds.
- **stablekraft-app** (this one) consumes them.
- **[PC20-Nostr](https://github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites.md)** holds the
  cross-app favorites wire format — app-neutral on purpose, so the two implementing apps can't
  drift from a copy each.

## Where the detail lives

Each subsystem has a skill under `.claude/skills/`. If you can read them, do; if not, these names
tell you what territory a question belongs to:

| Skill | Covers |
|---|---|
| `feed-ingestion` | How feeds get in: podping consumer, the URL lookup ladder, nightly cron, RSS parsing |
| `feed-curation` | How feeds get hidden or removed: `markedDead`, blacklists, dead-feed sweep, orphan cleanup |
| `catalog-display` | What the catalog shows: `albums-fast`, sorting, release date, search, publisher pages, artwork |
| `auth-and-security` | `ADMIN_SECRET`, `SESSION_SECRET`, the SSRF guard, CORS/CSP, CI |
| `nostr-signer` | NIP-46/55/07 signers, the login modal, the publish queue |
| `favorites` | The favorites data model, polymorphic `feedId`, album-vs-track, the Community tab |
| `favorites-cross-app` | The shared kind:10333 list StableKraft seeds and Boost Me Bitch reads |
| `audio-playback` | `AudioContext`: end of album, background audio, Android ping-pong, VTS |
| `android-native` | The Capacitor/zapstore APK: foreground service, wake lock, MediaSession |
| `mobile-layout` | Safe-area insets, the player bar reserve, Now Playing, the mobile album page |
| `lightning-boost` | Wallets, NWC backup, BoostBox/Helipad, value splits, AutoBoost, failure triage |
| `downloads` | Offline downloads and manual Offline mode |
| `diagnostics` | Client error reporting and the admin diagnostics panel |

Longer-form architecture notes are in [`docs/`](docs/).
