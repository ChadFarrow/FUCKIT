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

/**
 * Sorts summary rows by count desc, then category asc, so the panel does not reshuffle
 * between refreshes on a tie. Shared by both summary shapes, which the diagnostics route
 * builds directly from unbounded Prisma `groupBy` aggregates (not from the `recent`
 * arrays, which are capped for display — see the route for why that distinction matters).
 */
export function sortSummaryRows<T extends { category: string; count: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
