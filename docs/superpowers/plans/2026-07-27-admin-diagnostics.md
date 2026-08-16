# Admin Diagnostics Panel Implementation Plan

> **Shipped — do not execute this plan.** The work described below is implemented and in
> production. This document is a historical record of the plan as written on 2026-07-27; the
> unchecked `- [ ]` boxes reflect its state at authoring, not work outstanding. Nobody ticked
> them as they went, so they were left as written rather than filled in retroactively.
>
> Current behaviour: the `diagnostics` skill; `app/api/admin/diagnostics/`. Shipped in #182 (`8191d09`).

**Goal:** Surface boost payment failures and browser-side errors on `/admin`, durably across deploys, so triage no longer means trawling Railway logs.

**Architecture:** Two new Prisma tables with deliberately asymmetric storage — one row per boost failure (rare, individually interesting), and a daily upsert-and-increment bucket per distinct client error message (high volume, low individual value). Both write paths are wrapped in `try/catch` inside routes that already swallow errors, so a missing table degrades to silence rather than breaking a boost. One admin-gated endpoint serves both to a new self-contained React card component.

**Tech Stack:** Next.js 15 App Router, TypeScript, PostgreSQL via Prisma, React 18. Tests are `node:test` + `tsx` — **there is no jest or vitest in this repo.**

## Global Constraints

- **Reporting must never become its own outage.** Every persist is individually wrapped in `try/catch` and never changes the route's response. This is what makes deploy-before-migrate safe.
- **`npm run build` before committing, and stop `npm run dev` first** — both write `.next/` and building over a live dev server makes every asset request 400 until dev restarts. Delete the `public/sw.js` + `public/workbox-*.js` it emits afterwards.
- **Railway does not run migrations on deploy** (issue #122). The migration must be applied to prod *before* this code ships: `railway run --service StableKraft --environment production npm run db:migrate`.
- **Prisma client import is `import { prisma } from '@/lib/prisma';`** — this exact path, everywhere.
- **Admin routes are auto-gated** by the existing `/api/admin/:path*` matcher in `middleware.ts`. Do **not** edit `middleware.ts`; anything under `/api/admin/` is covered.
- **Run the full suite, not `lib/*.test.ts`** — that glob does not recurse and misses `lib/admin`, `lib/nostr`, `lib/caches`, `lib/downloads`. Use: `npx tsx --test lib/*.test.ts lib/*/*.test.ts`
- Field caps copied verbatim from the spec: `recent` lists max **100**; retention **30 days**; `samplePlatform` truncated at **200** chars.

---

### Task 1: Prisma schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (append two models)
- Create: `prisma/migrations/20260727000000_add_admin_diagnostics_tables/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `BoostFailure` and `ClientErrorReport`, reachable as `prisma.boostFailure` and `prisma.clientErrorReport`. Every later task depends on these exact field names.

- [ ] **Step 1: Append both models to `prisma/schema.prisma`**

```prisma
model BoostFailure {
  id             String   @id @default(cuid())
  createdAt      DateTime @default(now())
  category       String
  userActionable Boolean
  scope          String
  amount         Int
  recipient      String?
  trackTitle     String?
  artistName     String?
  feedId         String?
  trackId        String?
  paymentType    String?
  error          String

  @@index([createdAt])
  @@index([category, createdAt])
}

model ClientErrorReport {
  id             String   @id @default(cuid())
  day            String
  level          String
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

- [ ] **Step 2: Create the migration directory and SQL**

```bash
mkdir -p prisma/migrations/20260727000000_add_admin_diagnostics_tables
```

Write `prisma/migrations/20260727000000_add_admin_diagnostics_tables/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "BoostFailure" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "userActionable" BOOLEAN NOT NULL,
    "scope" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "recipient" TEXT,
    "trackTitle" TEXT,
    "artistName" TEXT,
    "feedId" TEXT,
    "trackId" TEXT,
    "paymentType" TEXT,
    "error" TEXT NOT NULL,

    CONSTRAINT "BoostFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientErrorReport" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "samplePath" TEXT,
    "samplePlatform" TEXT,
    "sampleData" TEXT,

    CONSTRAINT "ClientErrorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoostFailure_createdAt_idx" ON "BoostFailure"("createdAt");

-- CreateIndex
CREATE INDEX "BoostFailure_category_createdAt_idx" ON "BoostFailure"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientErrorReport_day_level_category_message_key" ON "ClientErrorReport"("day", "level", "category", "message");

-- CreateIndex
CREATE INDEX "ClientErrorReport_day_idx" ON "ClientErrorReport"("day");

-- CreateIndex
CREATE INDEX "ClientErrorReport_category_day_idx" ON "ClientErrorReport"("category", "day");
```

- [ ] **Step 3: Apply locally and regenerate the client**

Run: `npm run db:migrate`
Expected: migration applies, no drift reported.

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Verify the client actually exposes both models**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{
  console.log('boostFailure:', await prisma.boostFailure.count());
  console.log('clientErrorReport:', await prisma.clientErrorReport.count());
  process.exit(0)})()"
```
Expected: `boostFailure: 0` and `clientErrorReport: 0`. A `TypeError: Cannot read properties of undefined` means Step 3's `prisma generate` did not take.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260727000000_add_admin_diagnostics_tables
git commit -m "feat(admin): add BoostFailure and ClientErrorReport tables"
```

---

### Task 2: Pure summary helpers

**Files:**
- Create: `lib/admin/diagnostics.ts`
- Test: `lib/admin/diagnostics.test.ts`

**Interfaces:**
- Consumes: nothing (deliberately dependency-free — no Prisma import, so it is testable without a database).
- Produces:
  - `type BoostFailureScope = 'boost' | 'recipient' | 'fee'`
  - `dayKey(date: Date): string`
  - `summarizeBoostFailures(rows: Array<{ category: string; userActionable: boolean }>): BoostFailureSummaryRow[]`
  - `summarizeClientErrors(rows: Array<{ category: string; count: number }>): ClientErrorSummaryRow[]`
  - `interface BoostFailureSummaryRow { category: string; userActionable: boolean; count: number }`
  - `interface ClientErrorSummaryRow { category: string; count: number }`

- [ ] **Step 1: Write the failing tests**

Create `lib/admin/diagnostics.test.ts`:

```ts
// Run: npx tsx --test lib/admin/diagnostics.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, summarizeBoostFailures, summarizeClientErrors } from './diagnostics';

test('dayKey buckets by UTC calendar day', () => {
  assert.equal(dayKey(new Date('2026-07-27T00:00:00.000Z')), '2026-07-27');
  assert.equal(dayKey(new Date('2026-07-27T23:59:59.999Z')), '2026-07-27');
  assert.equal(dayKey(new Date('2026-07-28T00:00:00.000Z')), '2026-07-28');
});

test('dayKey is UTC, not local — the bucket boundary must not move with the server', () => {
  // 22:30 in New York on the 27th is already the 28th in UTC. If this ever reads
  // '2026-07-27', a day's counts silently split across two rows on a server whose
  // timezone is not UTC.
  assert.equal(dayKey(new Date('2026-07-28T02:30:00.000Z')), '2026-07-28');
});

test('summarizeBoostFailures counts ROWS and carries userActionable', () => {
  const summary = summarizeBoostFailures([
    { category: 'no-route', userActionable: false },
    { category: 'no-route', userActionable: false },
    { category: 'insufficient-balance', userActionable: true },
  ]);

  assert.deepEqual(summary, [
    { category: 'no-route', userActionable: false, count: 2 },
    { category: 'insufficient-balance', userActionable: true, count: 1 },
  ]);
});

test('summarizeClientErrors SUMS the stored count, it does not count rows', () => {
  // Rows are already daily aggregates, so counting rows would report "2 errors"
  // for something that happened 412 times.
  const summary = summarizeClientErrors([
    { category: 'audio-playback', count: 400 },
    { category: 'audio-playback', count: 12 },
    { category: 'data-service', count: 5 },
  ]);

  assert.deepEqual(summary, [
    { category: 'audio-playback', count: 412 },
    { category: 'data-service', count: 5 },
  ]);
});

test('summaries sort by count desc, then category asc so output is deterministic', () => {
  const summary = summarizeClientErrors([
    { category: 'zebra', count: 5 },
    { category: 'alpha', count: 5 },
    { category: 'middle', count: 9 },
  ]);

  assert.deepEqual(summary.map(r => r.category), ['middle', 'alpha', 'zebra']);
});

test('empty input yields an empty summary, not a throw', () => {
  assert.deepEqual(summarizeBoostFailures([]), []);
  assert.deepEqual(summarizeClientErrors([]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/admin/diagnostics.test.ts`
Expected: FAIL — `Cannot find module './diagnostics'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/diagnostics.ts`:

```ts
/**
 * Pure helpers for the admin diagnostics panel.
 *
 * Deliberately free of Prisma and of any Next import so it is unit-testable without a
 * database or a browser — the query side lives in app/api/admin/diagnostics/route.ts.
 */

/** Which of the three failures log-boost emits a row represents. */
export type BoostFailureScope = 'boost' | 'recipient' | 'fee';

export interface BoostFailureSummaryRow {
  category: string;
  userActionable: boolean;
  count: number;
}

export interface ClientErrorSummaryRow {
  category: string;
  count: number;
}

/**
 * Bucket key for ClientErrorReport, always UTC. Local time would move the boundary
 * with the server's timezone and split one day's counts across two rows.
 */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sortSummary<T extends { category: string; count: number }>(rows: T[]): T[] {
  // Category ascending breaks count ties, so the panel does not reshuffle between refreshes.
  return rows.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** Counts ROWS — one BoostFailure row is one failure. */
export function summarizeBoostFailures(
  rows: Array<{ category: string; userActionable: boolean }>
): BoostFailureSummaryRow[] {
  const byCategory = new Map<string, BoostFailureSummaryRow>();

  for (const row of rows) {
    const existing = byCategory.get(row.category);
    if (existing) {
      existing.count += 1;
    } else {
      byCategory.set(row.category, { category: row.category, userActionable: row.userActionable, count: 1 });
    }
  }

  return sortSummary([...byCategory.values()]);
}

/** SUMS the stored count — rows are already daily aggregates, not single occurrences. */
export function summarizeClientErrors(
  rows: Array<{ category: string; count: number }>
): ClientErrorSummaryRow[] {
  const byCategory = new Map<string, ClientErrorSummaryRow>();

  for (const row of rows) {
    const existing = byCategory.get(row.category);
    if (existing) {
      existing.count += row.count;
    } else {
      byCategory.set(row.category, { category: row.category, count: row.count });
    }
  }

  return sortSummary([...byCategory.values()]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/admin/diagnostics.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/diagnostics.ts lib/admin/diagnostics.test.ts
git commit -m "feat(admin): pure summary helpers for the diagnostics panel"
```

---

### Task 3: Persist boost failures

**Files:**
- Modify: `app/api/lightning/log-boost/route.ts`

**Interfaces:**
- Consumes: `prisma.boostFailure` (Task 1), `BoostFailureScope` from `@/lib/admin/diagnostics` (Task 2), and the existing `classifyBoostFailure` from `@/lib/lightning/boost-failure`.
- Produces: `BoostFailure` rows. Task 5 reads them.

- [ ] **Step 1: Replace the `tag` helper so the classification is computed once**

The file currently has, at the top:

```ts
/** `[category user|fix]` — greppable triage tag on every failure line. */
function tag(reason: string | null | undefined): string {
  const { category, userActionable } = classifyBoostFailure(reason);
  return `[${category} ${userActionable ? 'user' : 'fix'}]`;
}
```

Replace it with:

```ts
/**
 * Classification plus its `[category user|fix]` log tag. Returned together because the
 * persisted row and the log line need the same verdict — classifying twice invites them
 * to disagree after a future edit to one call site.
 */
function classify(reason: string | null | undefined): { category: string; userActionable: boolean; tag: string } {
  const { category, userActionable } = classifyBoostFailure(reason);
  return { category, userActionable, tag: `[${category} ${userActionable ? 'user' : 'fix'}]` };
}
```

Add the imports at the top of the file:

```ts
import { prisma } from '@/lib/prisma';
import type { BoostFailureScope } from '@/lib/admin/diagnostics';
```

- [ ] **Step 2: Add the persist helper below `classify`**

```ts
/**
 * Records a failure for the /admin diagnostics panel.
 *
 * Never throws and never awaited into the response path: this route's job is to accept a
 * report, and a diagnostics write must not turn a boost into an error. A missing table —
 * the state between deploying this code and running the migration — lands here as a
 * caught error and simply collects nothing.
 */
async function persistBoostFailure(row: {
  category: string;
  userActionable: boolean;
  scope: BoostFailureScope;
  amount: number;
  recipient?: string;
  trackTitle?: string;
  artistName?: string;
  feedId?: string;
  trackId?: string;
  paymentType?: string;
  error: string;
}): Promise<void> {
  try {
    await prisma.boostFailure.create({ data: row });
  } catch (err) {
    console.warn('⚠️ Failed to persist boost failure (diagnostics only):', err);
  }
}
```

- [ ] **Step 3: Write rows from the three failure branches**

In the POST handler, the three `console.error` blocks (currently around lines 121, 129 and 137) become:

```ts
    // Logged at error severity so these surface in Railway without trawling the feed.
    if (status === 'failed') {
      const verdict = classify(error);
      console.error(
        `❌ ${verdict.tag} Boost failed entirely — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${error || 'no reason reported'}`
      );
      await persistBoostFailure({
        category: verdict.category,
        userActionable: verdict.userActionable,
        scope: 'boost',
        amount,
        recipient,
        trackTitle,
        artistName,
        feedId,
        trackId,
        paymentType: type,
        error: error || 'no reason reported',
      });
    }

    if (failedRecipients) {
      console.error(
        `❌ ${failedRecipients.length} recipient(s) unpaid on boost ${boost.id}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${amount} sats, ${type}): ` +
        failedRecipients.map(r => `${classify(r.error).tag} ${r.name} (${r.amount} sats): ${r.error}`).join(' | ')
      );
      // One row per unpaid recipient — which recipient failed is the whole point.
      for (const r of failedRecipients) {
        const verdict = classify(r.error);
        await persistBoostFailure({
          category: verdict.category,
          userActionable: verdict.userActionable,
          scope: 'recipient',
          amount: r.amount,
          recipient: r.name,
          trackTitle,
          artistName,
          feedId,
          trackId,
          paymentType: type,
          error: r.error,
        });
      }
    }

    if (feeStatus === 'failed') {
      const verdict = classify(feeError);
      console.error(
        `❌ ${verdict.tag} StableKraft fee failed on boost ${boost.id} — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${feeError || 'no reason reported'}`
      );
      await persistBoostFailure({
        category: verdict.category,
        userActionable: verdict.userActionable,
        scope: 'fee',
        amount,
        recipient,
        trackTitle,
        artistName,
        feedId,
        trackId,
        paymentType: type,
        error: feeError || 'no reason reported',
      });
    }
```

**Do not** add a persist call to the other three `console.error` sites in this file — they are field validation and the two catch handlers, and are not boost failures.

- [ ] **Step 4: Verify against a running dev server**

Run `npm run dev` in one shell. Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/lightning/log-boost \
  -H 'Content-Type: application/json' \
  -d '{"trackId":"t1","amount":100,"type":"keysend","recipient":"a@example.com",
       "trackTitle":"Test Track","artistName":"Test Artist",
       "status":"failed","error":"Keysend failed - cannot find payment route",
       "feeStatus":"failed","feeError":"Insufficient balance in wallet",
       "failedRecipients":[{"name":"bob@example.com","amount":40,"error":"Payment timeout"}]}'
```
Expected: `200`

```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{
  console.table(await prisma.boostFailure.findMany({select:{scope:true,category:true,userActionable:true,recipient:true,amount:true}}));
  process.exit(0)})()"
```
Expected: exactly **three** rows —

| scope | category | userActionable | recipient | amount |
|---|---|---|---|---|
| `boost` | `no-route` | false | a@example.com | 100 |
| `recipient` | `timeout` | false | bob@example.com | 40 |
| `fee` | `insufficient-balance` | true | a@example.com | 100 |

If `boost` comes back as `keysend-unsupported`, the classifier regression from PR #181 has returned.

- [ ] **Step 5: Commit**

```bash
git add app/api/lightning/log-boost/route.ts
git commit -m "feat(admin): persist boost failures for the diagnostics panel"
```

---

### Task 4: Persist client errors

**Files:**
- Modify: `app/api/client-log/route.ts`

**Interfaces:**
- Consumes: `prisma.clientErrorReport` (Task 1), `dayKey` from `@/lib/admin/diagnostics` (Task 2).
- Produces: `ClientErrorReport` rows. Task 5 reads them.

- [ ] **Step 1: Add imports**

```ts
import { prisma } from '@/lib/prisma';
import { dayKey } from '@/lib/admin/diagnostics';
```

- [ ] **Step 2: Add the upsert helper above the POST handler**

```ts
/**
 * Folds one collapsed entry into its daily bucket for the /admin panel.
 *
 * Upsert rather than insert is what makes persisting safe on an UNAUTHENTICATED
 * endpoint: row growth becomes bounded by distinct messages per day instead of by
 * traffic. `count` increments by the entry's OWN count — the client already collapsed
 * repeats into it, so adding 1 would undercount by however many the client merged.
 *
 * Never throws. A missing table (deploy before migration) collects nothing and logs
 * nothing to the client.
 */
async function persistClientError(entry: {
  level: string;
  category: string;
  message: string;
  count: number;
  data: unknown;
  path: string;
  platform: string;
}): Promise<void> {
  try {
    const now = new Date();
    const sampleData = entry.data === undefined || entry.data === null
      ? null
      : String(typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)).slice(0, MAX_DATA);

    await prisma.clientErrorReport.upsert({
      where: {
        day_level_category_message: {
          day: dayKey(now),
          level: entry.level,
          category: entry.category,
          message: entry.message,
        },
      },
      create: {
        day: dayKey(now),
        level: entry.level,
        category: entry.category,
        message: entry.message,
        count: entry.count,
        firstSeen: now,
        lastSeen: now,
        samplePath: entry.path.slice(0, MAX_CONTEXT_FIELD),
        samplePlatform: entry.platform.slice(0, 200),
        sampleData,
      },
      update: {
        count: { increment: entry.count },
        lastSeen: now,
        samplePath: entry.path.slice(0, MAX_CONTEXT_FIELD),
        samplePlatform: entry.platform.slice(0, 200),
        sampleData,
      },
    });
  } catch (err) {
    console.warn('⚠️ Failed to persist client error (diagnostics only):', err);
  }
}
```

- [ ] **Step 3: Call it from the existing collapse loop**

The route already builds a `collapsed` Map and then iterates it with `collapsed.forEach(...)` to emit log lines. `forEach` cannot await, so convert that iteration to a `for...of` and persist inside it:

```ts
    for (const { level, category, message, count, data } of collapsed.values()) {
      const repeat = count > 1 ? ` (x${count})` : '';

      const line =
        `🖥️ [client ${level} ${category}] ${message}${repeat}` +
        ` | path=${path} | ${platform} | display=${display}${formatData(data)}`;

      if (level === 'error') {
        console.error(line);
      } else {
        console.warn(line);
      }

      await persistClientError({ level, category, message, count, data, path, platform });
    }
```

At most `MAX_ENTRIES` (20) upserts per request, since the collapse already merged duplicates.

- [ ] **Step 4: Verify against a running dev server**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/client-log \
  -H 'Content-Type: application/json' \
  -d '{"entries":[{"level":"error","category":"audio-playback","message":"All playback URLs failed","count":7,"data":{"attempts":3}}],
       "dropped":0,"context":{"path":"/album/x","platform":"probe-ua","display":"browser"}}'
```
Expected: `204`

Run the same curl a second time, then:

```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{
  console.log(await prisma.clientErrorReport.findMany({select:{day:true,category:true,message:true,count:true,samplePath:true}}));
  process.exit(0)})()"
```
Expected: exactly **one** row, `count: 14`. Two rows means the unique index is not matching; `count: 2` means the increment is using `1` instead of the entry's own count.

- [ ] **Step 5: Commit**

```bash
git add app/api/client-log/route.ts
git commit -m "feat(admin): fold client errors into daily buckets for the diagnostics panel"
```

---

### Task 5: Diagnostics read and prune API

**Files:**
- Create: `app/api/admin/diagnostics/route.ts`

**Interfaces:**
- Consumes: `prisma.boostFailure`, `prisma.clientErrorReport` (Task 1); `dayKey`, `summarizeBoostFailures`, `summarizeClientErrors` (Task 2).
- Produces: `GET /api/admin/diagnostics?days=N` and `DELETE /api/admin/diagnostics?olderThanDays=N`. Task 6 calls the GET; Task 7 calls the DELETE.

- [ ] **Step 1: Write the route**

Create `app/api/admin/diagnostics/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dayKey, summarizeBoostFailures, summarizeClientErrors } from '@/lib/admin/diagnostics';

/**
 * Read + prune for the /admin diagnostics panel.
 *
 * Gated automatically by the `/api/admin/:path*` matcher in middleware.ts — do not add
 * anything to that matcher for this route.
 */

const MAX_RECENT = 100;
const DEFAULT_DAYS = 7;
const DEFAULT_PRUNE_DAYS = 30;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function clampDays(raw: string | null, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 365);
}

export async function GET(req: NextRequest) {
  try {
    const days = clampDays(req.nextUrl.searchParams.get('days'), DEFAULT_DAYS);
    const since = daysAgo(days);

    const [boostRows, errorRows] = await Promise.all([
      prisma.boostFailure.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: MAX_RECENT,
      }),
      prisma.clientErrorReport.findMany({
        // `day` is a 'YYYY-MM-DD' string, so a lexicographic >= is a date comparison.
        where: { day: { gte: dayKey(since) } },
        orderBy: { lastSeen: 'desc' },
        take: MAX_RECENT,
      }),
    ]);

    return NextResponse.json({
      since: since.toISOString(),
      days,
      boostFailures: {
        summary: summarizeBoostFailures(boostRows),
        recent: boostRows,
      },
      clientErrors: {
        summary: summarizeClientErrors(errorRows),
        recent: errorRows,
      },
    });
  } catch (error) {
    console.error('Error loading diagnostics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load diagnostics' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const days = clampDays(req.nextUrl.searchParams.get('olderThanDays'), DEFAULT_PRUNE_DAYS);
    const cutoff = daysAgo(days);

    const [boosts, errors] = await Promise.all([
      prisma.boostFailure.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      prisma.clientErrorReport.deleteMany({ where: { day: { lt: dayKey(cutoff) } } }),
    ]);

    return NextResponse.json({
      success: true,
      olderThanDays: days,
      deleted: { boostFailures: boosts.count, clientErrors: errors.count },
    });
  } catch (error) {
    console.error('Error pruning diagnostics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prune diagnostics' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the gate is on**

```bash
curl -s -o /dev/null -w "unauthed: %{http_code}\n" http://localhost:3000/api/admin/diagnostics
```
Expected: `401`. A `200` means `ADMIN_SECRET` is unset locally — that is the documented fail-open behaviour, not a bug, but re-check with the variable set before trusting this step.

- [ ] **Step 3: Verify the payload**

```bash
source ~/.stablekraft-admin.env
curl -s -H "Authorization: Bearer $ADMIN_SECRET" \
  "http://localhost:3000/api/admin/diagnostics?days=7" | jq '{since, boostSummary: .boostFailures.summary, errorSummary: .clientErrors.summary}'
```
Expected: the three boost categories seeded in Task 3 and the `audio-playback` count of 14 from Task 4.

- [ ] **Step 4: Verify prune is a no-op on fresh rows**

```bash
curl -s -X DELETE -H "Authorization: Bearer $ADMIN_SECRET" \
  "http://localhost:3000/api/admin/diagnostics?olderThanDays=30" | jq
```
Expected: `deleted: { boostFailures: 0, clientErrors: 0 }` — today's rows are not 30 days old. A non-zero count means the comparison direction is inverted and it is deleting live data.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/diagnostics/route.ts
git commit -m "feat(admin): diagnostics read and prune endpoint"
```

---

### Task 6: Diagnostics panel UI

**Files:**
- Create: `components/admin/DiagnosticsPanel.tsx`
- Modify: `components/AdminPanel.tsx` (import + render, two lines)

**Interfaces:**
- Consumes: `GET /api/admin/diagnostics?days=N` (Task 5), `adminFetch` from `@/lib/admin-fetch`, `toast` from `@/components/Toast`.
- Produces: `<DiagnosticsPanel />`, default export.

- [ ] **Step 1: Create the component**

Create `components/admin/DiagnosticsPanel.tsx`:

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { toast } from '@/components/Toast';

/**
 * Boost failures and client errors on /admin.
 *
 * Its own component rather than two more cards inside AdminPanel.tsx, which is already
 * ~2,900 lines and ten cards. Owns its own fetch and state.
 */

interface BoostFailureRow {
  id: string;
  createdAt: string;
  category: string;
  userActionable: boolean;
  scope: string;
  amount: number;
  recipient: string | null;
  trackTitle: string | null;
  artistName: string | null;
  error: string;
}

interface ClientErrorRow {
  id: string;
  day: string;
  level: string;
  category: string;
  message: string;
  count: number;
  lastSeen: string;
  samplePath: string | null;
  samplePlatform: string | null;
}

interface DiagnosticsResponse {
  since: string;
  days: number;
  boostFailures: {
    summary: Array<{ category: string; userActionable: boolean; count: number }>;
    recent: BoostFailureRow[];
  };
  clientErrors: {
    summary: Array<{ category: string; count: number }>;
    recent: ClientErrorRow[];
  };
}

const CARD = 'bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6';
const BTN = 'px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm font-medium disabled:opacity-50';

export default function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/diagnostics?days=${rangeDays}`);
      if (!res.ok) {
        toast.error('Failed to load diagnostics');
        return;
      }
      setData(await res.json());
    } catch {
      toast.error('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const rangePicker = (
    <div className="flex items-center gap-2">
      <select
        value={days}
        onChange={e => setDays(Number(e.target.value))}
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-white/10"
      >
        <option value={1}>Last 24h</option>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
      </select>
      <button onClick={() => load(days)} disabled={loading} className={BTN}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  );

  const boost = data?.boostFailures;
  const errors = data?.clientErrors;

  return (
    <>
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Boost Failures</h2>
          {rangePicker}
        </div>

        {boost && boost.summary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {boost.summary.map(s => (
              <span key={s.category} className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10">
                <span className="font-mono">{s.category}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded ${s.userActionable ? 'bg-yellow-600/20 text-yellow-400' : 'bg-red-600/20 text-red-400'}`}>
                  {s.userActionable ? 'user' : 'fix'}
                </span>
                <span className="ml-2 text-gray-400">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        {boost && boost.recent.length === 0 ? (
          <p className="text-gray-400 text-sm">No boost failures in the last {data?.days} day(s).</p>
        ) : (
          <div className="space-y-2">
            {boost?.recent.map(row => (
              <div key={row.id} className="text-sm border-b border-white/5 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500 font-mono text-xs">{new Date(row.createdAt).toLocaleString()}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5">{row.scope}</span>
                  <span className={row.userActionable ? 'text-yellow-400' : 'text-red-400'}>{row.category}</span>
                  <span className="text-gray-300">{row.amount} sats → {row.recipient || 'unknown'}</span>
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {row.trackTitle || 'unknown track'} / {row.artistName || 'unknown artist'} — {row.error}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Client Errors</h2>
        </div>

        {errors && errors.summary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {errors.summary.map(s => (
              <span key={s.category} className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10">
                <span className="font-mono">{s.category}</span>
                <span className="ml-2 text-gray-400">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        {errors && errors.recent.length === 0 ? (
          <p className="text-gray-400 text-sm">No client errors in the last {data?.days} day(s).</p>
        ) : (
          <div className="space-y-2">
            {errors?.recent.map(row => (
              <div key={row.id} className="text-sm border-b border-white/5 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={row.level === 'error' ? 'text-red-400' : 'text-yellow-400'}>{row.level}</span>
                  <span className="font-mono text-xs text-gray-400">{row.category}</span>
                  <span className="text-gray-200">{row.message}</span>
                  <span className="text-gray-500">×{row.count}</span>
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {row.day} · {row.samplePath || 'unknown path'} · {row.samplePlatform || 'unknown platform'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Render it from AdminPanel**

Add to the imports at the top of `components/AdminPanel.tsx`:

```tsx
import DiagnosticsPanel from '@/components/admin/DiagnosticsPanel';
```

Then render `<DiagnosticsPanel />` immediately **before** the `{/* Recently Added Feeds */}` block (currently around line 2465), so diagnostics sit above the routine feed list.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Verify in a browser**

With `npm run dev` running, open `http://localhost:3000/admin`, log in, and confirm both cards render with the rows seeded in Tasks 3 and 4. Switch the range selector to "Last 24h" and confirm the list reloads.

Then check the empty state is a sentence and not a blank card:

```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{
  await prisma.boostFailure.deleteMany({}); await prisma.clientErrorReport.deleteMany({});
  process.exit(0)})()"
```
Reload `/admin`. Expected: "No boost failures in the last 7 day(s)." and the client-errors equivalent.

- [ ] **Step 5: Commit**

```bash
git add components/admin/DiagnosticsPanel.tsx components/AdminPanel.tsx
git commit -m "feat(admin): diagnostics panel for boost failures and client errors"
```

---

### Task 7: Nightly retention and documentation

**Files:**
- Modify: `.github/workflows/refresh-playlists.yml`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `DELETE /api/admin/diagnostics?olderThanDays=30` (Task 5).
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add the prune step to the nightly workflow**

The whole job is a single `run: |` block starting at line 15, with `AUTH_HEADER` supplied by the step's `env:` key at line 339. Append this at the **end of that run block, before the `env:` key**, matching the file's established shape (`$AUTH_HEADER`, `BASE_URL` and the `HTTP_CODE`/`RESPONSE_BODY` idiom are all already in scope).

**It must be Step 7.** The file already uses Steps 1, 2, 2b–2e, 3, 4, 5, 5b–5d and **6** — do not reuse 6:

```bash
        # Step 7: Prune diagnostics older than 30 days
        echo ""
        echo "📋 Step 7: Pruning old diagnostics..."

        PRUNE_RESPONSE=$(curl -s -X DELETE -w "\n%{http_code}" -H "$AUTH_HEADER" "${BASE_URL}/api/admin/diagnostics?olderThanDays=30") || PRUNE_RESPONSE=$'\n000'
        HTTP_CODE=$(echo "$PRUNE_RESPONSE" | tail -n1)
        RESPONSE_BODY=$(echo "$PRUNE_RESPONSE" | sed '$d')

        if [ "$HTTP_CODE" -eq 200 ]; then
          echo "✅ Diagnostics pruned"
          echo "$RESPONSE_BODY" | jq '.deleted' || echo "$RESPONSE_BODY"
        else
          echo "⚠️ Failed to prune diagnostics (HTTP $HTTP_CODE) — non-fatal"
        fi
```

The step is intentionally non-fatal: a failed prune must not fail the nightly playlist refresh, which is doing the actual work users notice.

- [ ] **Step 2: Add the test command to the CLAUDE.md Commands block**

In the `# Tests` section, after the existing `npx tsx --test lib/lightning/sender-name.test.ts` line:

```
npx tsx --test lib/admin/diagnostics.test.ts      # admin diagnostics: day bucket, summaries
```

- [ ] **Step 3: Document the feature in CLAUDE.md**

Add immediately after the `### Client error reporting` section:

```markdown
### Admin diagnostics panel (`/admin` → Boost Failures, Client Errors)
Boost payment failures and browser-side errors, persisted so triage doesn't mean trawling Railway logs. `components/admin/DiagnosticsPanel.tsx` (its own component — `AdminPanel.tsx` is already ~2,900 lines), served by `GET /api/admin/diagnostics?days=N`.

- **Storage is deliberately asymmetric.** `BoostFailure` gets **one row per failure** — they're rare (each needs a real payment attempt) and individually interesting: which track, which recipient, what the wallet said. `ClientErrorReport` **upserts into a daily bucket and increments `count`**, keyed `@@unique([day, level, category, message])`. That is what makes persisting safe on an **unauthenticated** endpoint: row growth is bounded by distinct messages per day rather than by traffic. It also reads better — "fired 412 times today" beats 412 identical rows.
- **`count` increments by the entry's OWN count**, not by 1. The client already collapsed repeats into it, so `+1` undercounts by however many it merged.
- **`dayKey` is UTC.** Local time would move the bucket boundary with the server's timezone and split a day's counts across two rows.
- **`scope` distinguishes the three failures `log-boost` emits**: `boost` (paid nobody), `recipient` (a split paid someone, these got nothing — one row each), `fee` (recipients paid, the 2 sat fee failed). The other three `console.error` calls in that route are field validation and the two catch handlers and must **not** produce rows.
- **Every persist is individually `try/catch`ed and never changes the response.** This is load-bearing, not habit: it makes deploy-before-migrate degrade to "collects nothing" instead of failing a boost. The read endpoint still 500s until the tables exist.
- **Retention is 30 days**, swept by a step in `refresh-playlists.yml` (`DELETE /api/admin/diagnostics?olderThanDays=30`), non-fatal so a failed prune can't fail the nightly refresh.
- **Migration gotcha (issue #122)**: `20260727000000_add_admin_diagnostics_tables` must be applied to prod with `railway run --service StableKraft --environment production npm run db:migrate` **before** this code deploys.
- Tests: `npx tsx --test lib/admin/diagnostics.test.ts`. DB writes have no test harness in this repo — verify with curl against `npm run dev`, then read the rows back with `npx tsx -e`.
```

- [ ] **Step 4: Full verification**

```bash
# Stop `npm run dev` FIRST — both write .next/ and a build over a live dev server
# makes every asset request 400 until dev restarts.
npx tsc --noEmit
npx tsx --test lib/*.test.ts lib/*/*.test.ts
npm run build
rm -f public/sw.js public/workbox-*.js
```
Expected: no tsc output; all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/refresh-playlists.yml CLAUDE.md
git commit -m "feat(admin): prune diagnostics nightly, document the panel"
```

---

## Deployment

Ordering is not optional (issue #122 — Railway's Dockerfile does not run migrations):

1. Merge the PR.
2. **Before or immediately after the deploy**, run:
   `railway run --service StableKraft --environment production npm run db:migrate`
3. Confirm: `GET /api/admin/diagnostics?days=1` with the Bearer header returns 200 rather than 500.

If the code deploys first, both write paths catch and collect nothing — no boost is harmed — but the admin panel 500s until step 2 runs.
