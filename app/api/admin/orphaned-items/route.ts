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
    const [orphanedFeedCount, totalFeeds, totalTracks, orphanedFeeds, allOrphansForDupCheck] = await Promise.all([
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
      prisma.feed.findMany({
        where: ORPHAN_WHERE,
        select: { id: true, title: true, artist: true },
      }),
    ]);

    // For each orphan, find any other feed with the same title+artist that
    // still has tracks — that's the "canonical" owner keeping the album on
    // the site. Orphans with a canonical are safe-to-delete duplicates;
    // orphans without one are genuinely broken imports worth reviewing.
    const findCanonical = async (f: { id: string; title: string | null; artist: string | null }) => {
      if (!f.title) return null;
      return prisma.feed.findFirst({
        where: {
          id: { not: f.id },
          title: f.title,
          ...(f.artist ? { artist: f.artist } : {}),
          Track: { some: {} },
        },
        select: { id: true, _count: { select: { Track: true } } },
      });
    };

    const sampleCanonicals = await Promise.all(orphanedFeeds.map(findCanonical));
    const allCanonicals = await Promise.all(allOrphansForDupCheck.map(findCanonical));
    const withCanonicalCount = allCanonicals.filter(Boolean).length;

    return NextResponse.json({
      preview: true,
      feedsToKeep: totalFeeds - orphanedFeedCount,
      orphanedFeeds: orphanedFeedCount,
      orphanedTracks: 0,
      totalFeeds,
      totalTracks,
      withCanonicalCount,
      withoutCanonicalCount: orphanedFeedCount - withCanonicalCount,
      sampleOrphanedFeeds: orphanedFeeds.map((f, i) => ({
        id: f.id,
        title: f.title,
        artist: f.artist,
        image: f.image,
        type: f.type,
        originalUrl: f.originalUrl,
        trackCount: f._count.Track,
        createdAt: f.createdAt,
        canonicalId: sampleCanonicals[i]?.id ?? null,
        canonicalTrackCount: sampleCanonicals[i]?._count.Track ?? 0,
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
