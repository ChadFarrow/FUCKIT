import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Orphan = type='album' AND Track.none(). These are failed/empty album
// imports left behind by bad fetches, dead URLs, or stale PI API matches.
// Publishers (no tracks by design), podcasts (standalone episodes), and
// any album that has ≥1 track are preserved regardless of whether they're
// referenced by a curated system playlist — the admin can still use the
// per-feed delete button for one-off cleanup.
const ORPHAN_WHERE = {
  type: 'album',
  Track: { none: {} },
} as const;

export async function GET() {
  try {
    const [orphanedFeedCount, totalFeeds, totalTracks, orphanedFeeds] = await Promise.all([
      prisma.feed.count({ where: ORPHAN_WHERE }),
      prisma.feed.count(),
      prisma.track.count(),
      prisma.feed.findMany({
        where: ORPHAN_WHERE,
        select: {
          id: true,
          title: true,
          artist: true,
          image: true,
          type: true,
          originalUrl: true,
          createdAt: true,
          _count: { select: { Track: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      preview: true,
      feedsToKeep: totalFeeds - orphanedFeedCount,
      orphanedFeeds: orphanedFeedCount,
      orphanedTracks: 0,
      totalFeeds,
      totalTracks,
      sampleOrphanedFeeds: orphanedFeeds.map(f => ({
        id: f.id,
        title: f.title,
        artist: f.artist,
        image: f.image,
        type: f.type,
        originalUrl: f.originalUrl,
        trackCount: f._count.Track,
        createdAt: f.createdAt,
      })),
    });

  } catch (error) {
    console.error('Error previewing orphaned items:', error);
    return NextResponse.json(
      { error: 'Failed to preview orphaned items', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const orphanedFeedCount = await prisma.feed.count({ where: ORPHAN_WHERE });

    if (orphanedFeedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned items to delete',
        deletedFeeds: 0,
        deletedTracks: 0,
      });
    }

    console.log(`🗑️ Deleting ${orphanedFeedCount} orphan albums (type='album', zero tracks)`);

    const deleteResult = await prisma.feed.deleteMany({ where: ORPHAN_WHERE });

    const remainingFeeds = await prisma.feed.count();

    return NextResponse.json({
      success: true,
      deletedFeeds: deleteResult.count,
      deletedTracks: 0,
      remainingFeeds,
    });

  } catch (error) {
    console.error('Error deleting orphaned items:', error);
    return NextResponse.json(
      { error: 'Failed to delete orphaned items', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
