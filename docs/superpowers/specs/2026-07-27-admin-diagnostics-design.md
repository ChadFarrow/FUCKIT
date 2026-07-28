# Admin diagnostics panel — boost failures and client errors

**Date:** 2026-07-27
**Status:** approved, not yet implemented

## Problem

PRs #176–#181 made two classes of failure visible *on the server*: boost payments that
fail (tagged `[category user|fix]` by `classifyBoostFailure`) and errors happening in
users' browsers (reported to `/api/client-log`). Both currently land in Railway logs and
nowhere else, so answering "what is breaking for people right now" means trawling logs.

Neither survives a deploy:

- `boostLog` in `app/api/lightning/log-boost/route.ts` is an in-memory array capped at
  500. It empties on every restart — observed reading `count: 0` immediately after the
  #181 deploy.
- `/api/client-log` holds **no state at all**. It formats a line, writes it to stdout,
  and forgets.

`BoostEvent` in `prisma/schema.prisma` is not a substitute. It requires a `userId` (FK to
`User`, cascade delete) and a unique Nostr `eventId`, so it only records boosts that a
signed-in user successfully posted to Nostr. It cannot represent a failed payment, an
anonymous boost, or an auto-boost.

## Goal

Two cards on `/admin` showing recent boost failures and recent client errors, durable
across deploys, with enough structure to triage: which category, ours to fix or the
sender's to resolve, how often, on what platform.

## Non-goals

- Persisting successful boosts. `BoostEvent` already covers the Nostr-posted ones, and
  the rest are not what this panel is for.
- Replacing Railway logs. Those remain the full record; this is the triage view.
- Alerting, charts, or trend analysis over time.
- A build/deploy SHA display. Considered and dropped.

## Design

### Schema — two tables, deliberately asymmetric

The two sources have opposite shapes, so they get opposite storage strategies.

```prisma
model BoostFailure {
  id             String   @id @default(cuid())
  createdAt      DateTime @default(now())
  category       String   // classifyBoostFailure category
  userActionable Boolean
  scope          String   // 'boost' | 'recipient' | 'fee'
  amount         Int
  recipient      String?
  trackTitle     String?
  artistName     String?
  feedId         String?
  trackId        String?
  paymentType    String?  // keysend | lightning-address | value-splits | auto
  error          String

  @@index([createdAt])
  @@index([category, createdAt])
}

model ClientErrorReport {
  id             String   @id @default(cuid())
  day            String   // 'YYYY-MM-DD', UTC
  level          String   // 'error' | 'warn'
  category       String
  message        String
  count          Int      @default(1)
  firstSeen      DateTime @default(now())
  lastSeen       DateTime @default(now())
  samplePath     String?
  samplePlatform String?
  sampleData     String?

  @@unique([day, level, category, message])
  @@index([day])
  @@index([category, day])
}
```

**`BoostFailure` gets one row per failure.** Failures are rare — each one requires a real
payment attempt — and individually interesting: *which* track, *which* recipient, what
the wallet said.

**`ClientErrorReport` upserts into a daily bucket and increments `count`.** Client errors
are the reverse: high volume, low individual value. Bucketing turns row growth from
"proportional to traffic" into "proportional to distinct messages per day", which is what
makes it safe to persist from an **unauthenticated** endpoint. It also produces better
data — "this fired 412 times today" is the signal, not 412 identical rows.

`scope` on `BoostFailure` exists because `log-boost` already emits three distinct
failures, and conflating them would lose the most useful distinction in the panel:

| `scope` | Meaning |
|---|---|
| `boost` | The boost paid nobody. |
| `recipient` | A split paid *someone*, but these recipients got nothing. |
| `fee` | Recipients were paid; the 2 sat StableKraft fee failed. |

### Write path

Both persists sit inside routes that already swallow everything and return success, and
both are individually wrapped in `try/catch`.

**This is load-bearing, not defensive habit.** It is what makes the deploy safe when the
migration has not run yet: a missing table degrades to "no diagnostics collected" instead
of failing a boost. Reporting must never become its own outage — the same principle
`reportBoost` and `queueReport` already follow.

- `app/api/lightning/log-boost/route.ts` — one `BoostFailure` row per emitted failure
  line. There are exactly three such branches (currently the `console.error` calls at
  lines 121, 129 and 137: whole boost failed → `scope: 'boost'`; recipients unpaid →
  `scope: 'recipient'`, one row each; fee failed → `scope: 'fee'`). The other three
  `console.error` calls in that file are field validation and the two catch handlers, and
  must **not** produce rows. `category`/`userActionable` come from the existing
  `classifyBoostFailure` call already computed for the log tag — reuse it, don't call it
  twice.
- `app/api/client-log/route.ts` — after the existing per-request collapse, upsert each
  surviving entry. The collapse already merged duplicates within the request, so this is
  at most `MAX_ENTRIES` (20) upserts.

On upsert, `count` increments by the entry's own `count` (the client already collapsed
repeats into it, so adding 1 would undercount), `lastSeen` and all three `sample*` fields
are overwritten with the newest occurrence, and `firstSeen` is left alone.

Volume bound on the unauthenticated path: the existing rate limit is 30 req/min/IP at 20
entries each, and upserts collapse by `(day, level, category, message)` — so a single IP
can create at most as many rows as it can invent distinct messages, and repeat traffic
only increments counters.

### Read path

One endpoint, `GET /api/admin/diagnostics?days=7`, returning both lists plus the category
rollup. Covered automatically by the existing `/api/admin/:path*` matcher in
`middleware.ts` — **no matcher change needed**, and the AdminPanel reaches it through
`adminFetch` (`lib/admin-fetch.ts`) like every other gated call.

Response shape:

```ts
{
  since: string,                     // ISO
  boostFailures: {
    summary: Array<{ category, userActionable, count }>,
    recent:  Array<BoostFailure>,    // createdAt desc, max 100
  },
  clientErrors: {
    summary: Array<{ category, count }>,
    recent:  Array<ClientErrorReport>,  // lastSeen desc, max 100
  },
}
```

### UI

New component `components/admin/DiagnosticsPanel.tsx`, rendered by `AdminPanel.tsx`.

**Not** more lines in `AdminPanel.tsx`. That file is 2,912 lines with 10 cards already;
adding an eleventh inline makes the largest file in the repo larger for no reason. The
panel owns its own fetch and state.

Two cards, each with a Refresh button and a range selector, matching the existing
"Recently Added" card's markup and button styling:

- **Boost Failures** — rollup line per category with a `user`/`fix` badge and count, then
  the recent list: time, amount, recipient, track/artist, `scope`, the wallet's message.
- **Client Errors** — grouped by message with its count and `lastSeen`, showing the sample
  path and platform.

Empty state must read "nothing in the last N days", not a spinner or a blank card — an
empty panel is the expected healthy state here and should say so.

### Retention

Rows older than **30 days** are deleted by a new step in
`.github/workflows/refresh-playlists.yml`, which already runs nightly at 4 AM and already
sends `AUTH_HEADER`. Long enough to spot "this started after Tuesday's deploy", short
enough that the tables stay small.

`DELETE /api/admin/diagnostics?olderThanDays=30` — same route file, gated by the same
matcher.

### Testing

Pure helpers go in `lib/admin/diagnostics.ts` and are unit-tested with `node:test` + `tsx`
(the repo has **no** jest/vitest):

- `dayKey(date)` → `'YYYY-MM-DD'` in UTC. Must be UTC, or the bucket boundary moves with
  the server's timezone and a day's counts split in two.
- `summarizeBoostFailures(rows)` → per-category counts carrying `userActionable`.
- `summarizeClientErrors(rows)` → per-category counts.

Add to the test list in `CLAUDE.md`'s Commands block:
`npx tsx --test lib/admin/diagnostics.test.ts`

Route behaviour is verified by curl against a running dev server, the same way #181 was:
POST a synthetic failure to `/api/lightning/log-boost`, then `GET /api/admin/diagnostics`
with the Bearer header and confirm the row and its category.

## Risks

**The migration must run before the code deploys.** Railway's Dockerfile does not run
`prisma migrate deploy` (issue #122, documented twice in `CLAUDE.md`). Run:

```
railway run --service StableKraft --environment production npm run db:migrate
```

The `try/catch` on both write paths means deploy-before-migrate degrades to silence
rather than 500s, but `GET /api/admin/diagnostics` **will** 500 until the tables exist.

**Durable storage of user-adjacent data.** `samplePlatform` holds the full user-agent,
truncated at 200 chars. Accepted deliberately: triage needs "iOS 17 Safari standalone"
precision, and it is already written to Railway logs today. This moves it into 30-day
database storage, which is a real change in retention even though it is not new data.
Nothing here stores a pubkey, an npub, or a payment preimage.

**`recipient` on `BoostFailure` is an artist's Lightning address.** Already public in the
feed, so no new exposure.
