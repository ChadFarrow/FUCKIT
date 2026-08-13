import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Backfill Feed.oldestItemPubdate from each feed's oldest track publishedAt.
 * Run after bulk feed refresh or when new feeds are added so "Year" sort uses real release dates.
 * GET returns counts; POST runs the backfill.
 */
export async function POST(request: NextRequest) {
  try {
    // Get all feeds that don't have oldestItemPubdate set, along with their oldest track
    const feeds = await prisma.feed.findMany({
      where: {
        oldestItemPubdate: null,
        status: 'active'
      },
      select: {
        id: true,
        title: true,
        Track: {
          select: {
            publishedAt: true
          },
          orderBy: {
            publishedAt: 'asc'
          },
          take: 1
        }
      }
    });

    console.log(`📅 Backfilling oldestItemPubdate for ${feeds.length} feeds using oldest track date...`);

    let updated = 0;
    let skipped = 0;

    for (const feed of feeds) {
      const oldestTrack = feed.Track[0];

      if (!oldestTrack?.publishedAt) {
        console.log(`⏭️ No tracks with publishedAt for ${feed.title}`);
        skipped++;
        continue;
      }

      // Update the feed with the oldest track's publish date
      await prisma.feed.update({
        where: { id: feed.id },
        data: {
          oldestItemPubdate: oldestTrack.publishedAt
        }
      });

      console.log(`✅ Updated ${feed.title}: ${oldestTrack.publishedAt.toISOString().split('T')[0]}`);
      updated++;
    }

    return NextResponse.json({
      success: true,
      total: feeds.length,
      updated,
      skipped
    });

  } catch (error) {
    console.error('❌ Backfill error:', error);
    return NextResponse.json(
      { error: 'Backfill failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Check how many feeds need backfilling
  const needsBackfill = await prisma.feed.count({
    where: {
      oldestItemPubdate: null,
      status: 'active'
    }
  });

  const hasBackfill = await prisma.feed.count({
    where: {
      oldestItemPubdate: { not: null }
    }
  });

  return NextResponse.json({
    needsBackfill,
    hasBackfill,
    message: `${needsBackfill} feeds need oldestItemPubdate backfill. POST to this endpoint to run.`
  });
}
