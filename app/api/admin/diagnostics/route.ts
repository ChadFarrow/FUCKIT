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
