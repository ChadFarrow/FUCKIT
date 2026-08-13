---
name: favorites-cross-app
description: "Use when working on the cross-app shared favorites list StableKraft seeds and Boost Me Bitch reads: the kind:10333 replaceable event, NIP-73 podcast:guid / podcast:item:guid identifiers, lib/nostr/favorites-single-list.ts, lib/nostr/pc20-identifiers.ts, lib/nostr/relay-read.ts, the medium grouping, SHARED_FAVORITES_ALLOWLIST, SHARED_FAVORITES_APPLY_DELETES, SHARED_FAVORITES_IMPORT_UNKNOWN, /api/favorites/sync-shared, a degraded or untrustworthy relay read, favorites disappearing after a sync, the disclosure notice, or a dead default relay."
---

# favorites-cross-app

The second favorites channel: one shared, app-neutral list read by other Podcasting 2.0 apps. The per-item kind 30001 events are a separate channel — see the `favorites` skill. Don't collapse the two: the Community tab reads the 30001 events, and its author-scoped filters and d-tag ladder are tuned against real prod data.

## Tests for this subsystem

```
npx tsx --test lib/nostr/favorites-single-list.test.ts   # the format: build, parse, round trip
npx tsx --test lib/nostr/relay-read.test.ts              # the read, against scripted misbehaving relays (~10s)
npx tsx lib/nostr/favorites.relay-probe.ts               # read-only smoke check against the REAL default relays (network; not in --test runs)
npx tsx scripts/backup-favorites.ts dump > fav.json      # snapshot favorites before enabling SHARED_FAVORITES_APPLY_DELETES
```

---

## The format — kind 10333, one flat list

Spec: [`PC20-Nostr/pc20-favorites-single-list.md`](https://github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites-single-list.md), the canonical app-neutral copy kept outside both implementing repos. **That document, not this code, is what a third app implements against.** One plain (non-`d`-tagged) replaceable event, so exactly one per pubkey; `i` tags grouped under a running `medium`; `content` empty and public. Republishing the whole tag list IS the sync.

It **replaced** the two-list NIP-78 kind:30078 design (`pc20-favorites.md` in the same repo), which proved overcomplicated and is now deleted here. Events at `d:podcast:favorites` and `d:podcast:favorites:items` are still on the relays and are the rollback path; nothing in this app reads or writes them.

Files: `lib/nostr/pc20-identifiers.ts` (the NIP-73 vocabulary, which outlives any one format), `lib/nostr/favorites-single-list.ts` (build + parse + fetch), `lib/nostr/relay-read.ts` (the trusted read), `lib/nostr/favorites-sync-client.ts` (DB→identifier mapping, debounce, publish, pull, sync health), `app/api/favorites/sync-shared/route.ts` (inbound reconcile).

## Placement is POSITIONAL, and everything below follows from it

An item entry carries no parent. It belongs to the feed group most recently opened above it, under the medium most recently declared above that. Reordering the tags is therefore not cosmetic — it re-parents entries and re-labels media, while leaving the event perfectly well-formed.

- **A feed group is opened for every parent of a favorited track**, favorited or not, because there is no other way to name the feed a track came from. Measured on real data: 82 favorited feeds, 159 distinct parents, **196 groups**. Nothing on the wire distinguishes a group opened for placement from a feed the user chose. Resolving the guids and deciding what to render is the consuming app's job — they are the standard Podcasting 2.0 identifiers.
- **Unfavoriting a feed while a track of it stays favorited is invisible.** The placement group and the favorite are the same bytes, so the removal cannot be expressed until the last track goes too. Pinned by a test; found because an idempotence assertion failed and was right to.
- **A track whose feed has no `<podcast:guid>` cannot be expressed** and is dropped on write. The two-list format could carry it parentless. No favorite is in that state today; the fix is an admin reparse, not an invented parent.

## No baseline — so only ONE app may write

The predecessor diffed against a baseline (the ids this device last agreed with the relay on), which is what let it tell "another app added this" from "I removed this". This format has none: a publish replaces the event with what this app holds.

- **StableKraft seeds, Boost Me Bitch reads.** Safe exactly while that is true.
- **Before a second writer exists it needs a read-then-carry pass** — re-emit feed groups read from the event that resolve to no local row. Without it, each publish deletes whatever the other app holds exclusively, silently, with no undo. `publishSingleList` says so at its call site.
- **Inbound removals do not propagate**, and the reconcile is passed a permanently empty `baseline` for that reason: removals are `baseline − incoming`, so an empty one means the route may add but never delete. That is the only safe reading of a format that cannot tell "another app removed this" from "another app never had it".

## The medium hint

Position: a `["medium", …]` tag applies to every entry that follows it until the next one. Same-medium feeds must stay contiguous or entries get silently re-labelled.

- **Published only from `Feed.medium`, never `Feed.type`.** `type` defaults to `"album"`, so publishing it would be guessing, and a guess here is sticky across every app that reads it.
- **Groups with no medium are emitted FIRST**, ahead of any `medium` tag. Every alternative is worse: appending them inherits whatever was declared last, and inventing `["medium","unknown"]` writes a value no reader was told about.
- **On READ, an entry before any `medium` tag is UNKNOWN, not `podcast`** — a deliberate divergence from the spec's stated default. This app writes its own unknown-medium groups in exactly that position, so honouring the default would round-trip "not told" into "podcast" and file a music release under Podcasts. The hint is advisory and a resolved answer wins.
- `/favorites` reads the medium into a Podcasts tab that only appears when there is something in it. The split is `medium === 'podcast'`, falling back to `Feed.type` only for rows whose medium hasn't been parsed yet; anything unknown stays where it has always been rather than being called music.

## `k` tags — one per distinct KIND, trailing

**A deviation from the spec as written, pending a spec update.** The document pairs a `k` with every `i`; this app writes one per kind at the end, and READS both forms. They carry identical information — `k` names an identifier kind and the kind is already the identifier's prefix — but the paired form cost **423 tags holding two distinct values, ~11 KB of a 36 KB event**. Trailing is safe because only `i` and `medium` are positional.

A reader must take an entry's kind from position 1. One that walks `i`/`k` in pairs will not read what this writes.

**Kinds come from the table in `identifierKind`, never string-scanning.** `Track.guid` is routinely a permalink URL, so "everything before the last colon" yields `podcast:item:guid:https` — a tag no relay filter matches, breaking discovery with nothing visibly wrong. Pinned by a test.

## The trusted read (`relay-read.ts`)

`trustworthy: false` means "nothing answered", NOT "the list is empty". The two are indistinguishable at exactly one point in the pipeline, and the wrong call there wipes a library.

- **It cannot be built on `pool.subscribeMany`'s aggregate `oneose`** — that was a bug for the feature's whole life, found only once there was a harness scripting a misbehaving relay. Two non-answers fold into that callback and both report as an answered read: (1) `AbstractRelay.baseEoseTimeout` (4400ms) **synthesizes** an EOSE on a timer when a relay never sends one — under the 5s default, so a relay that accepted the socket then said nothing read as `trustworthy` (measured, 4424ms); (2) a **failed connection** also counts, so an offline device reported `trustworthy` in **19ms**.
- So the read subscribes **per relay**: answered means connected *and* sent a real EOSE inside the window. The bar is `reached > 0 && answered === reached`.
- `eoseTimeout` sits just past our own deadline — **a large value leaves a real timer pending long after the read returns** (110s of dangling timer once, which is why a test file took 114s).
- `CONNECT_TIMEOUT_MS` (2s) is capped well under the overall budget because **one dead relay sized to the full remaining budget burns the entire window** — `wss://nostr.oxtr.dev` did exactly that, turning every read into 5s.
- **A merely unreachable relay drops out of the denominator; one that hangs makes the read degraded.** Deliberate asymmetry: a default list can ship a dead relay, so counting unreachable ones would leave the feature permanently degraded, while a hung relay genuinely is an unknown.
- **Nothing prunes dead defaults automatically**, and there have been two (`relay.nsec.app`, then `nostr.oxtr.dev`). **Check a relay before adding one**: connect, send a REQ, require a real EOSE. `favorites.relay-probe.ts` does that against the live list and is the fastest way to spot the next one.
- **Author check at INTAKE, not on the winner** (`preferAuthoredEvent`). A foreign event with a high `created_at` would otherwise take the slot and displace the genuine one, and rejecting it afterwards discards the real event too — turning a good read into an empty one.

## Reporting failure

- **A degraded read is reported, not just handled** (`SharedSyncStatus`, rendered by `components/favorites/SharedFavoritesNotice.tsx`). A degraded read and an empty list render identically, so correct behaviour looks exactly like data loss — in the sibling app that produced half an hour of production debugging and a near-revert of a correct commit.
- **Read and write health are SURFACED as one flag but TRACKED as two** (`setSyncHealth('read'|'write', …)`). The push runs on every toggle, so one shared flag let a successful write clear a `degraded` raised by a failed read — the notice then vanished the next time the user favorited anything, taking the Retry button (the only thing that re-runs the pull) with it. Reporting success is worse than staying silent.
- **Every exit path must settle the status**, including a throw: the read opens with a dynamic `import('nostr-tools/pool')` that rejects offline — exactly the population the notice exists for — and an unhandled rejection left the flag pinned at `'syncing'`, which renders as nothing.
- **The status-cache invalidation is dispatched BEFORE the push**, not after. The push can throw, and an enclosing catch then swallowed the dispatch even though the reconcile had already written rows — stale hearts, i.e. issue #190 again.
- The pull is **single-flight, keyed on pubkey**. Unkeyed, an account switch without a reload joins the previous user's run and resolves with their result.
- `'off'` (not allowlisted) and signed-out both render nothing — there is no sync to fail, and claiming a relay problem would be a lie.

## Gates that are still on

- **The allowlist** (`SHARED_FAVORITES_ALLOWLIST` in `favorites-sync-client.ts`, unioned with `NEXT_PUBLIC_SHARED_FAVORITES_PUBKEYS`, npub or hex) is **not off by default** — it holds Chad's npub. Empty array *and* unset env means entirely off: no relay read, no publish, no reconcile, nothing on any page load. It exists because **this repo has no preview environment** — `git push origin main` IS the production deploy — and the pull effect fires for every signed-in user, so shipping ungated would publish everyone's favorites to a public list they never asked for. `NEXT_PUBLIC_` bakes at build time. **Deleting `sharedFavoritesEnabledFor` and its call sites is what "ship to everyone" means.**
- **The disclosure notice** (`components/favorites/SharedFavoritesDisclosure.tsx`) is the prerequisite for removing that gate, and it exists. Two states render nothing on purpose, and keeping them that way is what makes it a disclosure rather than a lie: signed out (no key, nothing published) and a `nip05` read-only session (no signer, so nothing is ever signed or sent). Deliberately **not** dismissible.
- **Reconciliation ships with deletes OFF** (`SHARED_FAVORITES_APPLY_DELETES`). It is the only destructive write, and `FavoriteAlbum`/`FavoriteTrack` rows are the only copy. With the empty baseline above it cannot delete anyway; the flag is the second lock. **Snapshot first**: `railway run --service StableKraft --environment production npx tsx scripts/backup-favorites.ts dump > favorites-$(date +%F).json`, restored with `restore <file>` (additive and idempotent).
- **Minting `Feed` rows from another app's list is OFF too** (`SHARED_FAVORITES_IMPORT_UNKNOWN`). BMB is a general podcast app and this one is music, so a shared list carries talk podcasts — and importing them writes rows into a catalogue with whole subsystems devoted to keeping non-music out. The guids still come back as `unresolvedFeedGuids`, which is how you see what a real list contains before deciding.
- **A sanity cap applies even when deletes are on**: a pass refuses to remove more than `max(5, 50%)` of eligible rows, logs `🛑`, and removes nothing.

## Reconciliation

- **Only what could have been on the wire is eligible.** `userId`-scoped (never `sessionId`), album/track only (publishers use synthetic `artist-*` ids and playlists are curated slugs — out of scope both directions), and resolving to a non-null guid. **Something that can never appear on the list can never be missing from it.**
- **The ADD loops must match every id format.** `FavoriteAlbum.feedId` and `FavoriteTrack.trackId` are both polymorphic (`Feed.id` vs `Feed.guid`; `Track.id` vs `Track.guid` — 99 of 235 favorite tracks matched `Track.id`, the rest matched `Track.guid`). The album loop once matched only `Feed.id` while the track loop beside it checked both, so a favorite stored under `Feed.guid` found no match and a **second row** was created, which `@@unique([userId, feedId])` cannot reject because the strings differ. The album then rendered twice. Keep the loops symmetric.
- **Unfavorite fires the shared sync outside the `nostrEventId` guard** (`FavoriteButton`). A kind-5 needs the id of the event it deletes, so a favorite whose 30001 publish once failed can never be unfavorited on that channel — this list has no such dependency.

## Both relay harnesses need a `WebSocket` global Node 20 lacks

This repo targets Node 20 (`.nvmrc`, `node:20-alpine`); the global only arrived in Node 21. `nostr-tools` captures it once at module load, so `installNodeWebSocket()` (`lib/nostr/node-websocket.ts`) supplies `ws`. **It patches three places and all three are load-bearing**: the global, plus `useWebSocketImplementation` on **both** the CJS and ESM copies of `nostr-tools/pool` — this repo is CommonJS, so a static import resolves the CJS build while a dynamic `await import()` resolves the ESM build, two module instances with two `_WebSocket` variables. **The symptom points nowhere near the cause**: the degraded-read cases keep passing (a failed connection is indistinguishable from the degradation they assert) while only the "a relay answers" cases fail, and the probe reports **every** default relay dead. Reproduce on a newer Node with `NODE_OPTIONS=--no-experimental-websocket`. (This is also why the helper aliases the import: eslint reads any `useFoo()` call as a React hook and `next lint` errors.)
