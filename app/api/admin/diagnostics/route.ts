import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dayKey, sortSummaryRows } from '@/lib/admin/diagnostics';
import type { BoostFailureSummaryRow, ClientErrorSummaryRow } from '@/lib/admin/diagnostics';

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
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 365);
}

export async function GET(req: NextRequest) {
  try {
    const days = clampDays(req.nextUrl.searchParams.get('days'), DEFAULT_DAYS);
    const since = daysAgo(days);
    // `BoostFailure.createdAt` is an exact instant, so `days=1` covers exactly the last
    // 24h. `ClientErrorReport` is bucketed by UTC calendar day (`dayKey`) and CANNOT be
    // sliced sub-day, so the same `days=1` covers anywhere from just-past-midnight-UTC
    // up to a full 48h. Both cards are labelled "N day(s)" — that label is accurate for
    // Boost Failures and approximate for Client Errors; this is a known, unfixable
    // asymmetry (not a bug), so the client-errors empty-state wording below doesn't
    // claim exact-hour precision.
    const sinceDay = dayKey(since);

    // `recent` (both) is capped at MAX_RECENT for display. The summary chips are a
    // SEPARATE, unbounded aggregate query over the full window — computing them from
    // the same truncated `recent` arrays would make the chips reflect only the newest
    // 100 rows, misreporting on any day with more than 100 failures. Both groupBys are
    // index-backed (`[category, createdAt]` / `[category, day]`).
    const [boostRows, errorRows, boostGroups, errorGroups] = await Promise.all([
      prisma.boostFailure.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: MAX_RECENT,
      }),
      prisma.clientErrorReport.findMany({
        // `day` is a 'YYYY-MM-DD' string, so a lexicographic >= is a date comparison.
        where: { day: { gte: sinceDay } },
        orderBy: { lastSeen: 'desc' },
        take: MAX_RECENT,
      }),
      prisma.boostFailure.groupBy({
        by: ['category', 'userActionable'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      prisma.clientErrorReport.groupBy({
        by: ['category'],
        where: { day: { gte: sinceDay } },
        _sum: { count: true },
      }),
    ]);

    const boostSummary: BoostFailureSummaryRow[] = sortSummaryRows(
      boostGroups.map(g => ({ category: g.category, userActionable: g.userActionable, count: g._count }))
    );

    const clientErrorSummary: ClientErrorSummaryRow[] = sortSummaryRows(
      errorGroups.map(g => ({ category: g.category, count: g._sum.count ?? 0 }))
    );

    return NextResponse.json({
      since: since.toISOString(),
      days,
      boostFailures: {
        summary: boostSummary,
        recent: boostRows,
      },
      clientErrors: {
        summary: clientErrorSummary,
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
