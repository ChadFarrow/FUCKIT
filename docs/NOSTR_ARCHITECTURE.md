# Nostr Architecture

## Overview

Nostr does three separate jobs in this app, and conflating them is the usual source of confusion:

1. **Identity** — who the user is, established by a signer and carried by a signed session cookie.
2. **Social features** — profile, follows, shares, zaps. Published to relays, cached in Postgres.
3. **Favorites portability** — favorites live in Postgres and are *also* published to relays, on
   two independent channels with different formats and different audiences.

PostgreSQL is the source of truth for anything the app renders. Relays are how that data becomes
portable and how social features reach the wider Nostr ecosystem.

> An earlier version of this document said "Nostr is for social features. Database is for app
> data." That was never quite true and is now plainly wrong — favorites are published to relays on
> two channels, one of which exists specifically so *other apps* can read them.

---

## Identity and authorization

**A route learns who is calling from the signed session cookie, and from nothing else.**

- `lib/auth/session.ts` — `signSession` / `verifySession`, cookie `sk_session`, 90-day max age.
- `lib/auth/require-user.ts` — `requireUser(request, { write?: boolean })` returns the verified
  user id or `null`.
- Login issues the cookie (`POST /api/nostr/auth/login`, `/nip05-login`); logout clears it
  (`/logout`).

Two rules that are load-bearing:

- **`x-nostr-user-id` is never trusted.** Clients still send the header and several components set
  it, but no route handler reads it — only `lib/auth/` does, and only on the fail-open path below.
  `grep -rn "x-nostr-user-id" app/api` must stay empty.
- **`requireUser` fails open when `SESSION_SECRET` is unset**, falling back to that header. This is
  deliberate and documented in the source, but it means anyone can act as any user until the
  variable is set. Setting it in Railway is step 1 of a deploy, not a follow-up.

Pass `{ write: true }` on any route that mutates. That rejects read-only NIP-05 sessions, which
prove no key ownership.

Admin authorization is separate and unrelated: `middleware.ts` checks an `ADMIN_SECRET` bearer
token. See the `auth-and-security` skill.

---

## Signing methods

All signing goes through the unified signer in `lib/nostr/signer.ts`, which detects what's
available and falls back between methods.

| Method | Supported by | Notes |
|---|---|---|
| **NIP-07** | Alby, nos2x, other browser extensions | Desktop browsers. Preferred when present. |
| **NIP-46** | Amber, Primal, any bunker | Remote signer over WebSocket, via `bunker://` or `nostrconnect://`. Connection persisted in localStorage. |
| **NIP-55** | Amber | Android intent-based signing, for the native/TWA build. |
| **NIP-05** | any verified identifier | **Read-only.** No key access, so nothing can be signed. Rejected by `requireUser(..., { write: true })`. |

Signing paths worth knowing: `components/Nostr/LoginModal.tsx` (auth),
`components/Lightning/BoostButton.tsx` (boosts), `lib/nostr/favorites.ts` (favorites),
`components/Nostr/ShareButton.tsx` (shares).

Signer setup, timeouts, reconnection and the post-login deferred-work flags are covered in depth by
the `nostr-signer` skill.

---

## Event kinds

### Social features

| Kind | What | API | Cached in |
|---|---|---|---|
| 0 | Profile metadata | `POST /api/nostr/profile/update` | `User` |
| 3 | Contact list (follows) | `POST /api/nostr/follow` | `Follow` |
| 1 | Text note (shares, boost posts) | `POST /api/nostr/share` | `NostrPost` |
| 9735 / 9736 | Zap request / receipt | `POST /api/nostr/boost` | `BoostEvent` |
| 30315 | User status | — | — |

Flow: publish to relays, then cache in Postgres. A failed publish does not fail the operation —
warnings are logged, the database write stands, and the app keeps working with relays down.

### Favorites — two channels, do not collapse them

**Channel 1 — per-item, kind 30001 / 30002 (NIP-51).** One event per favorited item. This is what
the **Community tab** reads (`/api/nostr/global-favorites`, `lib/nostr/community-favorites.ts`).
Its author-scoped filters and d-tag ladder are tuned against real production data.

**Channel 2 — the cross-app shared list, kind 10333.** One plain replaceable event per pubkey,
carrying the whole library as NIP-73 `podcast:guid` / `podcast:item:guid` identifiers grouped under
a running `medium`. Other Podcasting 2.0 apps read it; Boost Me Bitch also *writes* it.

Channel 2 has properties that make it unlike anything else here:

- **Republishing the whole tag list IS the sync**, so every publish must read the current event
  first and merge — a blind publish deletes the other app's entries.
- The wire format is specified in a third, app-neutral repo:
  [PC20-Nostr/pc20-favorites.md](https://github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites.md).
  That document, not this code, is what a third app implements against.
- It is **allowlist-gated** (`NEXT_PUBLIC_SHARED_FAVORITES_PUBKEYS`) and its destructive reconcile
  is off by default (`SHARED_FAVORITES_APPLY_DELETES`).
- It replaced a two-list NIP-78 kind:30078 design. Those events are still on relays as a rollback
  path; nothing reads or writes them.

Files: `lib/nostr/favorites-single-list.ts`, `pc20-identifiers.ts`, `relay-read.ts`,
`favorites-sync-client.ts`, `app/api/favorites/sync-shared/route.ts`.

**Read the `favorites-cross-app` skill before touching any of it.** The positional tag layout, the
ordered node list, the device-local published record and the trusted relay read each have failure
modes that are silent, and several of them produced production bugs in a single day.

### Playlists

Kind **34139**, addressable per NIP-33, with tracks referenced by Podcast Index GUIDs. Spec draft
in [`nip-music-playlists.md`](nip-music-playlists.md); implementation in
`lib/nostr/playlist-events.ts`.

---

## Relay reads are not simply "fetch"

`lib/nostr/relay-read.ts` exists because **"nothing answered" and "the list is empty" are
indistinguishable at exactly one point in the pipeline, and getting it wrong wipes a library.**

A read reports `trustworthy: false` unless relays actually connected *and* returned a real EOSE
inside the window. It cannot be built on `pool.subscribeMany`'s aggregate `oneose` — both a
synthesized EOSE timeout and a failed connection fold into that callback and report as a successful
read. A degraded read is surfaced to the user (`components/favorites/SharedFavoritesNotice.tsx`),
because a degraded read and an empty list render identically and correct behaviour otherwise looks
exactly like data loss.

Full detail, including the two dead default relays this has already caught, is in the
`favorites-cross-app` skill.

---

## Database schema

Cached from Nostr:

- `User` — kind 0 metadata
- `Follow` — kind 3 contact lists
- `NostrPost` — kind 1 notes
- `BoostEvent` — kind 9735 / 9736 zaps

Owned by the app, published to Nostr:

- `FavoriteTrack`, `FavoriteAlbum` — note `FavoriteAlbum.feedId` is **polymorphic** (`Feed.id`,
  `Feed.guid`, or a synthetic `artist-*` id). See the `favorites` skill.

Database only:

- `Track`, `Feed` — catalog data, never published.

---

## Further reading

- `nostr-signer` skill — signers, the login modal, the publish queue
- `favorites` skill — the data model, polymorphic ids, the Community tab
- `favorites-cross-app` skill — the kind 10333 channel end to end
- `auth-and-security` skill — session cookie, admin gate, SSRF, CORS/CSP
