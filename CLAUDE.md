# Stablekraft App

Next.js 15 music app for Podcasting 2.0 — RSS feeds, V4V/Lightning payments, Nostr, musicL playlists.

**Most of what was in this file now lives in project skills** (`.claude/skills/*/SKILL.md`), loaded on demand
rather than on every turn. See *Where things are documented* below. The detail is unchanged — it moved, verbatim.

## Reporting Language

Write every reply to the user in ASD-STE100 Simplified Technical English.

- Use only approved STE words, and use one meaning for each word.
- Write short sentences: 20 words maximum for an instruction, 25 for a
  description.
- Give one instruction in each sentence.
- Use the active voice and simple verb tenses.
- Do not use a noun cluster of more than three words.
- Keep the articles. Do not use slang, idioms, or jargon.

This rule applies to chat replies only. Code, code comments, commit messages,
pull request text, file contents, and quoted material keep their normal style —
do not rewrite existing prose into STE.

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

# Testing a WRITE. There is no preview environment, so a local relay is the only
# place a publish can be exercised without writing the real event under the real key.
npm run relay                    # ws://127.0.0.1:7777, in-memory, replaceable-event semantics
npm run seed:relay -- <npub>     # copies the real kind:10333 in — read-only against production
npm run dev:isolated -- -p 3001  # dev, publishing ONLY to the local relay
npm run e2e:favorites            # the whole loop on a throwaway key, with real NIP-44
```
Per-subsystem test commands live in the skill that owns the subsystem — each skill opens with its own.

## Boundaries
- Never commit secrets (`.env`, API keys). `SESSION_SECRET` and `ADMIN_SECRET` live in Railway env + `.env.local` only.
- **`console.log` does not exist in production.** `next.config.js` sets `compiler.removeConsole` with
  `exclude: ['error', 'warn']`, so every `console.log` is compiled out of a production build and survives in dev.
  A diagnostic added with `log` is therefore absent from the one environment worth diagnosing — this cost a
  deploy-and-retest cycle on 2026-08-20, when stage timings added to chase a slow signing prompt printed nothing
  on stablekraft.app. Use `console.warn` for anything you intend to read in production.
- **A grep that returns nothing is not evidence that nothing exists.** Under zsh, an unquoted `--include=*.tsx` errors with `no matches found` and prints nothing — indistinguishable from a clean result. This produced three wrong conclusions during the security audit, including "this route has no callers" about a live endpoint that was nearly deleted. Quote the globs, and check the exit status before believing an empty result.
- **A local relay is not isolation on its own, and the difference is a real publish.** The commands
  are under Commands; the trap is here. Use **`npm run dev:isolated`**, never a hand-set
  `NEXT_PUBLIC_NOSTR_RELAYS` — the publish path unions the user's NIP-65 relays with the defaults, so
  a "local" test by a signed-in user published a real event under their real key, to their real
  relays, silently. `resolvePublishRelays` now returns only the defaults when every one is loopback;
  production is unchanged and pinned by `relay-isolation.test.ts`. Three separate places stripped
  loopback URLs before that worked — `getDefaultRelays`, the publish union, and
  `RelayManager.connect` — and the third one failed *only* the publish while reads kept working, so
  the symptom was "couldn't reach the relays" from a relay that was answering on the same URL.
- **`dev:isolated` does NOT isolate the database.** `.env.local` still points it at Railway
  production, deliberately, because testing a mode switch needs real favorites to move. The reconcile
  can only ADD, but a heart you tap is a real favorite — snapshot with `scripts/backup-favorites.ts`
  first, or override `DATABASE_URL` from `.env` on the command line. Never edit `.env.local`.
- Run `npm run build` before committing — but **stop `npm run dev` first**, *or* build into a
  different directory with `NEXT_DIST_DIR=.next-build npm run build`, which is what to do when a dev
  server is running. Changing the dev PORT does not help; the collision is the directory. Next
  rewrites `tsconfig.json` on every build, so `git checkout tsconfig.json` afterwards.
  Building over a live dev server replaces the chunks its running client already fetched, and every
  asset request 400s (`ERR_ABORTED` on `_next/static/...`) until the dev server is restarted. Symptom
  is a page stuck on its loading state with no obvious error. Recovery: kill dev, `rm -rf .next`,
  `npm run dev`. Any phone testing over the LAN needs a hard reload afterwards.
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
  `/api/albums-fast` has **two** Track selects; `podcastImages` has
  **three** write paths; the release date has **seven** read paths; `Feed.medium` has **ten** create/upsert paths
  and the first pass at it caught one; `AlbumDetailClient` duplicates props across its mobile and desktop rows.
  Adding or fixing a field means finding all of them → the owning skill. `grep -rn "prisma.<model>.create\|upsert"`
  before believing you have. Watch for **re-key** paths especially — `refresh-by-url` deletes a row and recreates it
  from a field-by-field copy, so a column missing from that list is silently dropped rather than merely unset.
  The favorites id ladders were three such copies and are now **one** — `lib/favorites/resolve-favorite-rows.ts`,
  used by `favorites/albums`, `favorites/tracks` and `favorites/sync-items`. Keep new readers on it: both stored ids
  are polymorphic (`Feed.id` vs `Feed.guid`; `Track.id` vs `Track.guid` vs `audioUrl`), every rung carries real
  rows, and a rung present on one path and not another means a favorite that renders on the page and is missing
  from the published Nostr list → `favorites-cross-app`.
- **`Feed.type` is this app's classification; `Feed.medium` is what the feed declared.** They are not
  interchangeable and the difference is load-bearing. `type` defaults to `"album"`, so it always has a value and
  that value is often a guess; `medium` is NULL until a feed actually says, and **nothing may default it**. Only
  `medium` goes on the cross-app favorites list, where a guess is sticky and no other app will correct it. Use
  `type` for local behaviour, `medium` for anything published or shown as fact → `favorites-cross-app`,
  `feed-ingestion`.
- **The shared favorites wire format is sequenced reader-first, across two repos and a spec.** The order is: land
  it in [PC20-Nostr](https://github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites.md), teach
  **both** apps to *read* the new form, and only then start *writing* it. Writing a form the other app can't read
  doesn't fail — it silently makes favorites invisible on the far side, which is worse than the format it
  replaced. The channel is now **kind 10333**, one plain replaceable event; the kind:30078 two-list design it
  replaced is deleted, and its events survive on the relays only as a rollback path.
  **This is not theory, and the order is not a formality.** On 2026-08-25 this app shipped the private
  half and switched a real account to Private while Boost Me Bitch still hardcoded `content: ''`. For
  about an hour, one favorite toggled there would have erased 436 encrypted entries — silently, no
  undo, on an event that keeps no history. Nothing was wrong with any rule; the halves shipped in the
  wrong sequence. **Before switching on anything that writes a new form, go and read the other app's
  shipped `main` and confirm it handles it** — not its open PR → `favorites-cross-app`.
- **Kind 10333 has TWO live writers, so every publish must read first and merge.** Publishing replaces the whole
  event, so a writer that sends what it holds without reading deletes everything the other app added — silently,
  on someone else's device, with no undo. Boost Me Bitch started publishing 2026-08-13, which retired the
  single-writer assumption this file used to state. `publishSingleList` therefore reads, merges via
  `mergeSingleList` against the device-local `sk_single_list_published:<pubkey>` record, and refuses to publish on
  a degraded read → `favorites-cross-app`.
- **The parsed list is an ORDERED NODE LIST, and a republish must be rendered from `nodes` — never from
  `groups`.** `groups`/`orphanItemGuids` are a *projection* holding only what this app can model; the node list is
  what also carries foreign tag types, foreign `k` values, `podcast:publisher:guid` entries and malformed
  `podcast:guid:` values, whole and in position (spec §4, *Carry what you can't read*). Rendering the projection
  instead compiles, type-checks and silently deletes every one of them on the other app's behalf — which is what
  shipped until 2026-08-14. A loose node also must **not** close the open feed group: dropping a non-UUID
  `podcast:guid:` reparented every item after it to the previous feed, well-formed and invisible →
  `favorites-cross-app`.
- **Favorites have a public/private/off choice, and the private half is a SECOND list in `content`.**
  Public entries are `i` tags; private ones are a NIP-44 encrypt-to-self of a tag array. Three rules
  only work together, and each shipped as a production bug in the sibling app: the digest compares
  **decrypted tags, never ciphertext** (NIP-44's nonce makes ciphertext differ every time, so a
  ciphertext digest republishes forever); the baseline is **two records**, with the inactive half's
  claims **carried forward and cleared by the move, never re-derived** (nothing feeds that half, so a
  derived claim goes unbacked and cycle 2 deletes what cycle 1 merely carried — it takes **two
  cycles** to show); and the inactive half is carried on the wire but **never painted into local
  state**, because local state comes back as `local` and is republished into the *active* half, which
  private→public is a disclosure. Seeding a device's mode from the wire must have **each half answer
  only for itself** — public-first fails open and republishes a private list as plaintext, indexed
  tags → `favorites-cross-app`.
- **The privacy choice belongs to the LIST, not to this app.** Whichever half holds entries is the
  mode, and going private takes **everything** — including entries this app did not write and cannot
  resolve. The alternative was measured: 436 entries encrypted and **13 left public** because the
  other app wrote them, with nothing on screen saying which. 97% private is worse than a clear no.
  The move is **one direction only**: public→private may take another app's entries (it only reduces
  exposure, carries them whole, and anything that can decrypt undoes it), private→public may not (it
  publishes an `i` tag relays index and cannot be taken back). **Moved foreign entries are NOT
  claimed in the baseline** — nothing local backs the claim, so it reads as our own removal next
  cycle and deletes them. `strandedInPublicHalf` reports anything a switch could not move, and the
  control says it out loud: silence was the actual defect, the split was only the cause →
  `favorites-cross-app`.
- **An unreadable private half is a degraded read, not an empty one.** Same exit as a silent relay.
  `decodePrivateFavorites` returns `null` rather than `[]` for valid JSON that is not a tag array —
  a `JSON.parse` that succeeds on a non-array marks the blob readable-and-empty, and the next
  republish rewrites `content` from those empty lists. NIP-55 and read-only nip05 sessions **cannot
  encrypt at all**, which is a normal state, not an error → `favorites-cross-app`, `nostr-signer`.
- **Inbound removals do not propagate.** `favorites-sync-client.ts` hardcodes `baseline: []` on the
  `/api/favorites/sync-shared` call and `SHARED_FAVORITES_APPLY_DELETES` defaults off, so unfavoriting in the
  other app never reaches this one. This fails safe — nothing is destroyed — but it is not symmetric with our
  outbound removals, which do work → `favorites-cross-app`.
- **A favorites entry is ambiguous in TWO directions, and each guard is wrong without the others.** Naming a
  track's parent means emitting a feed entry, so a group appears whether or not the feed was favorited (196 groups
  for 82 favorited feeds), and an entry on the list we don't hold locally is either another app's or one we just
  removed. Four rules answer that, and 2026-08-13 shipped four production bugs by having some but not all of
  them (#210–#214): an **itemless** group is a real favorite and one with items is unknowable; the merge drops
  what we published and no longer hold but carries what we never published; the device-local
  `sk_single_list_published:<pubkey>` record that makes those answerable is written on the digest-**unchanged**
  path too, or it never bootstraps; and the **inbound reconcile applies the same filter**, because it runs
  *before* the push and otherwise re-creates what the publish has not yet removed → `favorites-cross-app`.
- **Favorites bugs are verified against the relay and the database, never the UI.** The heart clearing, the row
  being gone, and the entry leaving the list are three different facts, and on 2026-08-13 they disagreed three
  times in a row — a removed favorite still sitting in Postgres, then one deleted and silently re-created two
  minutes later while the published event never moved. Read the event with
  `npx tsx lib/nostr/favorites.relay-probe.ts` and the rows with `railway run`, and compare `createdAt` before
  believing anything changed → `favorites-cross-app`.
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
| `favorites-cross-app` | The shared kind:10333 list StableKraft seeds and Boost Me Bitch reads |
| `audio-playback` | `AudioContext` playback: end of album, background audio, Android ping-pong, VTS |
| `android-native` | The Capacitor/zapstore APK: foreground service, wake lock, MediaSession, back button |
| `mobile-layout` | Safe-area insets, the player bar reserve, Now Playing, the mobile album page |
| `lightning-boost` | Wallets, NWC backup, BoostBox/Helipad, value splits, AutoBoost, failure triage |
| `downloads` | Offline downloads and manual Offline mode |
| `diagnostics` | Client error reporting and the admin diagnostics panel |
