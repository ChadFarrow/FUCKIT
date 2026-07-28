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
