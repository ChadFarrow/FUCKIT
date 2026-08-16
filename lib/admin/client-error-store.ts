import { prisma } from '@/lib/prisma';
import { dayKey } from '@/lib/admin/diagnostics';

/**
 * The one write path into `ClientErrorReport`.
 *
 * Extracted from `app/api/client-log/route.ts` when `/api/csp-report` became a
 * second producer. Two copies of this would be the standard bug in this repo —
 * the same field written from N places, and a fix landing in one of them — and
 * the overflow and race handling below is exactly the kind of detail that gets
 * fixed in one copy only.
 */

/** Truncation bound for the stored sample payload. */
export const MAX_SAMPLE_DATA = 800;

/** Postgres int4 max is 2,147,483,647 — stay comfortably under it. */
const MAX_STORED_COUNT = 2_000_000_000;

// One warning per process is enough to diagnose "the migration hasn't run" — without
// this, the window between deploying and running the migration makes every batch emit
// both Prisma's own error log and this one, burying the very lines these endpoints
// exist to make greppable (this repo has already had two Railway log-flood incidents).
let warnedPersistError = false;

function warnPersistFailureOnce(err: unknown): void {
  if (!warnedPersistError) {
    console.warn(
      '⚠️ Failed to persist client report (diagnostics only) — this warning will not repeat:',
      err
    );
    warnedPersistError = true;
  }
}

export interface ClientReportEntry {
  level: string;
  category: string;
  message: string;
  count: number;
  data: unknown;
  path: string;
  platform: string;
}

/**
 * Folds one collapsed entry into its daily bucket for the /admin panel.
 *
 * Upsert-shaped rather than insert is what makes persisting safe on an UNAUTHENTICATED
 * endpoint: row growth becomes bounded by distinct messages per day instead of by
 * traffic. `count` increments by the entry's OWN count — callers already collapse
 * repeats into it, so adding 1 would undercount by however many were merged.
 *
 * The increment is a raw, saturating `LEAST(count + n, MAX_STORED_COUNT)` UPDATE rather
 * than Prisma's `count: { increment }` — `count` is a Postgres int4 and these values are
 * caller-supplied, and an `increment` that overflows int4 throws Postgres 22003. That
 * throw was caught and swallowed, which left the bucket permanently un-updatable for the
 * rest of the UTC day, silently. LEAST(...) can never overflow, so that failure mode is
 * closed regardless of how a caller's per-entry cap is tuned.
 *
 * `$executeRaw` returns rows affected, so 0 means "no existing bucket" — fall through to
 * create(). A concurrent request can create the row between that UPDATE and this
 * INSERT; the retry below folds this entry's count into it instead of losing it.
 *
 * Never throws. A missing table (deploy before migration) collects nothing and tells
 * the client nothing.
 */
export async function persistClientReport(entry: ClientReportEntry): Promise<void> {
  try {
    const now = new Date();
    const day = dayKey(now);
    const sampleData =
      entry.data === undefined || entry.data === null
        ? null
        : String(typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)).slice(
            0,
            MAX_SAMPLE_DATA
          );

    const updated = await prisma.$executeRaw`
      UPDATE "ClientErrorReport"
      SET "count" = LEAST("count" + ${entry.count}, ${MAX_STORED_COUNT}),
          "lastSeen" = ${now},
          "samplePath" = ${entry.path},
          "samplePlatform" = ${entry.platform},
          "sampleData" = ${sampleData}
      WHERE "day" = ${day} AND "level" = ${entry.level} AND "category" = ${entry.category} AND "message" = ${entry.message}
    `;

    if (updated > 0) return;

    try {
      await prisma.clientErrorReport.create({
        data: {
          day,
          level: entry.level,
          category: entry.category,
          message: entry.message,
          count: Math.min(entry.count, MAX_STORED_COUNT),
          firstSeen: now,
          lastSeen: now,
          samplePath: entry.path,
          samplePlatform: entry.platform,
          sampleData,
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === 'P2002') {
        // Lost the create race to a concurrent request — the row exists now, so
        // re-run the saturating update instead of dropping this entry's count.
        await prisma.$executeRaw`
          UPDATE "ClientErrorReport"
          SET "count" = LEAST("count" + ${entry.count}, ${MAX_STORED_COUNT}),
              "lastSeen" = ${now},
              "samplePath" = ${entry.path},
              "samplePlatform" = ${entry.platform},
              "sampleData" = ${sampleData}
          WHERE "day" = ${day} AND "level" = ${entry.level} AND "category" = ${entry.category} AND "message" = ${entry.message}
        `;
      } else {
        throw createErr;
      }
    }
  } catch (err) {
    warnPersistFailureOnce(err);
  }
}
