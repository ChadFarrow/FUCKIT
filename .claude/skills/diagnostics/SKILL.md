---
name: diagnostics
description: "Use when working on error reporting or the admin diagnostics panel: lib/monitoring.ts, monitoring.warn and monitoring.error, /api/client-log, client errors that never surface anywhere, log throttling and the message-as-throttle-key rule, sendBeacon limits, the BoostFailure and ClientErrorReport tables, /api/admin/diagnostics, or triaging boost failures and browser errors without trawling Railway logs."
---

# diagnostics

Getting client-side failures somewhere a human can actually read them.

## Tests for this subsystem

```
npx tsx --test lib/client-log.test.ts               # client error reporting: throttle key, clamping, key sweep
npx tsx --test lib/admin/diagnostics.test.ts        # admin diagnostics: day bucket, summaries
```

---

## Client error reporting (`lib/monitoring.ts` → `/api/client-log`)
`monitoring.warn`/`.error` buffer to `/api/client-log`, which turns each entry into one greppable Railway line and nothing else — no DB, no schema, no retention. Before this existed the class was **write-only in production**: it buffered into an in-memory array in the user's browser and console-logged only in development, so every call site was collecting diagnostics nobody could read. `monitoring.info` stays local.

- **THE MESSAGE IS THE THROTTLE KEY.** `ClientLogBuffer` collapses identical `level:category:message` into one entry with a `count`. A message that interpolates a per-item value (`No match found for feedGuid: ${guid}`) is therefore a *distinct* message every time: it collapses with nothing, fills `MAX_QUEUE` in one pass of the loop emitting it, and leaves a permanent key behind. **Put variable parts in `data`.** Bounded interpolations (an attempt number, a media error code) are fine. `dataService.getAlbumsByFeedGuids` had the bad shape; it has no callers so it never fired, but it shows how easily it gets written.
- **`MAX_QUEUE` (client) must equal `MAX_ENTRIES` (route).** If the client queues more than the server accepts, the surplus vanishes server-side without being counted in `dropped` — so the report of what was lost is itself wrong. Both are 20.
- **Clamping happens at intake, not just on the route.** `add()` truncates category/message and serialises+truncates `data` *before* building the key. The route's own caps are no help if the request was too big for the browser to send at all: `navigator.sendBeacon` returns **`false` rather than throwing** past its ~64KB budget, and the beacon path is the one carrying reports off a dying tab. Its return is checked, falling through to keepalive `fetch`. A full queue of maximal entries is asserted under 64KB in the tests.
- **`drain(now)` sweeps expired throttle keys.** Nothing else removes them — `add` writes a key for every message it sees including ones it immediately drops — so without the sweep the map grows for the life of the page. Keys inside their window are kept; that is what stops a client flushing between occurrences from re-queueing forever.
- **The route collapses duplicates within a request too**, and reports what the batch cap cut rather than truncating silently. Client-side collapsing is no defence against a caller that runs no client. Ceiling is `MAX_ENTRIES × RATE_LIMIT_MAX` lines/min/IP/instance — 600. It was 1,500, which is enough to bury the log this endpoint exists to make readable (same failure family as the `/api/proxy-image` floods above).
- **Deliberately unauthenticated**, and outside `middleware.ts`'s matcher. The reports worth having come from sessions that are broken, often signed out, sometimes mid-failure — requiring auth would filter out exactly the population being diagnosed. Abuse is bounded by the rate limit, the batch cap and the field caps; nothing in the body is trusted.
- **Manual Offline mode suppresses flushing** (`localStorage['sk_offline_mode'] === '1'`, read directly — this runs outside React and must not pull `DownloadsContext` into the monitoring module). The user has said they want bandwidth spent on playback; reports stay buffered, bounded, with drop counting.
- **A session with no errors pays nothing** — `queueReport` is the only entry point, so with no warn/error there is no buffer, listener, timer or request. Keep it that way.
- Tests: `npx tsx --test lib/client-log.test.ts`. The buffer only runs in a browser, so the route is verifiable by hand: `curl -X POST localhost:3000/api/client-log -H 'Content-Type: application/json' -d '{"entries":[…],"context":{…}}'` and read the `🖥️` lines off the dev server.

---

## Admin diagnostics panel (`/admin` → Boost Failures, Client Errors)
Boost payment failures and browser-side errors, persisted so triage doesn't mean trawling Railway logs. `components/admin/DiagnosticsPanel.tsx` (its own component — `AdminPanel.tsx` is already ~2,900 lines), served by `GET /api/admin/diagnostics?days=N`.

- **Storage is deliberately asymmetric.** `BoostFailure` gets **one row per failure** — they're rare (each needs a real payment attempt) and individually interesting: which track, which recipient, what the wallet said. `ClientErrorReport` **upserts into a daily bucket and increments `count`**, keyed `@@unique([day, level, category, message])`. That is what makes persisting safe on an **unauthenticated** endpoint: row growth is bounded by distinct messages per day rather than by traffic. It also reads better — "fired 412 times today" beats 412 identical rows.
- **`count` increments by the entry's OWN count**, not by 1. The client already collapsed repeats into it, so `+1` undercounts by however many it merged.
- **`dayKey` is UTC.** Local time would move the bucket boundary with the server's timezone and split a day's counts across two rows.
- **`scope` distinguishes the three failures `log-boost` emits**: `boost` (paid nobody), `recipient` (a split paid someone, these got nothing — one row each), `fee` (recipients paid, the 2 sat fee failed). The other three `console.error` calls in that route are field validation and the two catch handlers and must **not** produce rows.
- **Every persist is individually `try/catch`ed and never changes the response.** This is load-bearing, not habit: it makes deploy-before-migrate degrade to "collects nothing" instead of failing a boost. The read endpoint still 500s until the tables exist.
- **Retention is 30 days**, swept by a step in `refresh-playlists.yml` (`DELETE /api/admin/diagnostics?olderThanDays=30`), non-fatal so a failed prune can't fail the nightly refresh.
- **Migration gotcha (issue #122)**: `20260727000000_add_admin_diagnostics_tables` must be applied to prod with `railway run --service StableKraft --environment production npm run db:migrate` **before** this code deploys.
- Tests: `npx tsx --test lib/admin/diagnostics.test.ts`. DB writes have no test harness in this repo — verify with curl against `npm run dev`, then read the rows back with `npx tsx -e`.
