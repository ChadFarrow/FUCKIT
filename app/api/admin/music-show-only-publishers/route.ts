import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateAlbumsFastCache } from '@/lib/caches/albums-fast-cache';
import { invalidateSearchCache } from '@/lib/caches/search-cache';

function invalidateFeedListCaches(): void {
  invalidateAlbumsFastCache();
  invalidateSearchCache();
}

// GET /api/admin/music-show-only-publishers
// Lists every publisher feed with its current flag state and child counts.
export async function GET() {
  try {
    const publishers = await prisma.feed.findMany({
      where: { type: 'publisher' },
      select: {
        id: true,
        title: true,
        artist: true,
        originalUrl: true,
        image: true,
        musicShowOnly: true,
        _count: { select: { other_Feed: true } },
      },
      orderBy: [
        { musicShowOnly: 'desc' },
        { title: 'asc' },
      ],
    });

    // Per-publisher track count across all child album feeds.
    const trackCounts = await prisma.track.groupBy({
      by: ['feedId'],
      _count: { _all: true },
      where: { Feed: { publisherId: { in: publishers.map(p => p.id) } } },
    });
    const childTracksByPublisher = new Map<string, number>();
    if (trackCounts.length > 0) {
      const childFeeds = await prisma.feed.findMany({
        where: { id: { in: trackCounts.map(t => t.feedId) } },
        select: { id: true, publisherId: true },
      });
      const publisherByChild = new Map(childFeeds.map(f => [f.id, f.publisherId]));
      for (const t of trackCounts) {
        const pubId = publisherByChild.get(t.feedId);
        if (!pubId) continue;
        childTracksByPublisher.set(pubId, (childTracksByPublisher.get(pubId) ?? 0) + t._count._all);
      }
    }

    return NextResponse.json({
      publishers: publishers.map(p => ({
        id: p.id,
        title: p.title,
        artist: p.artist,
        originalUrl: p.originalUrl,
        image: p.image,
        musicShowOnly: p.musicShowOnly,
        childAlbums: p._count.other_Feed,
        childTracks: childTracksByPublisher.get(p.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('Error listing music-show-only publishers:', error);
    return NextResponse.json({ error: 'Failed to list publishers' }, { status: 500 });
  }
}

// PATCH /api/admin/music-show-only-publishers
// Body: { id: string, musicShowOnly: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, musicShowOnly } = body as { id?: string; musicShowOnly?: boolean };

    if (!id || typeof musicShowOnly !== 'boolean') {
      return NextResponse.json(
        { error: 'Body must include { id: string, musicShowOnly: boolean }' },
        { status: 400 }
      );
    }

    const feed = await prisma.feed.findUnique({ where: { id }, select: { id: true, type: true } });
    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }
    if (feed.type !== 'publisher') {
      return NextResponse.json(
        { error: 'Music-show-only flag is only valid on publisher feeds' },
        { status: 400 }
      );
    }

    const updated = await prisma.feed.update({
      where: { id },
      data: { musicShowOnly },
      select: { id: true, title: true, musicShowOnly: true },
    });

    return NextResponse.json({ feed: updated });
  } catch (error) {
    console.error('Error updating music-show-only flag:', error);
    return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
  }
}

// POST /api/admin/music-show-only-publishers
// Body: { id: string, action: 'preview' | 'cleanup' }
//
// Inspects child album feeds belonging to this publisher and identifies any
// whose tracks are NOT referenced by a SystemPlaylistTrack. Albums where ≥1
// track has been played on a curated music show are kept in full.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body as { id?: string; action?: 'preview' | 'cleanup' };

    if (!id || (action !== 'preview' && action !== 'cleanup')) {
      return NextResponse.json(
        { error: 'Body must include { id: string, action: "preview" | "cleanup" }' },
        { status: 400 }
      );
    }

    const publisher = await prisma.feed.findUnique({
      where: { id },
      select: { id: true, type: true, title: true, musicShowOnly: true },
    });
    if (!publisher) {
      return NextResponse.json({ error: 'Publisher not found' }, { status: 404 });
    }
    if (publisher.type !== 'publisher') {
      return NextResponse.json(
        { error: 'Cleanup only runs on publisher feeds' },
        { status: 400 }
      );
    }

    // Find all child album feeds (publisherId points at this publisher).
    const childFeeds = await prisma.feed.findMany({
      where: { publisherId: id },
      select: {
        id: true,
        title: true,
        artist: true,
        type: true,
        Track: {
          select: {
            id: true,
            SystemPlaylistTrack: { select: { playlistId: true }, take: 1 },
          },
        },
      },
    });

    const toDelete: Array<{ id: string; title: string; artist: string | null; trackCount: number }> = [];
    const toKeep: Array<{ id: string; title: string; artist: string | null; trackCount: number; playedTracks: number }> = [];

    for (const child of childFeeds) {
      // Don't auto-delete podcasts even if mis-attributed; admin can handle those manually.
      if (child.type === 'podcast') continue;

      const playedTracks = child.Track.filter(t => t.SystemPlaylistTrack.length > 0).length;
      if (playedTracks === 0) {
        toDelete.push({
          id: child.id,
          title: child.title,
          artist: child.artist,
          trackCount: child.Track.length,
        });
      } else {
        toKeep.push({
          id: child.id,
          title: child.title,
          artist: child.artist,
          trackCount: child.Track.length,
          playedTracks,
        });
      }
    }

    if (action === 'preview') {
      return NextResponse.json({
        publisher: { id: publisher.id, title: publisher.title, musicShowOnly: publisher.musicShowOnly },
        toDelete,
        toKeep,
      });
    }

    // action === 'cleanup'
    if (toDelete.length === 0) {
      return NextResponse.json({
        publisher: { id: publisher.id, title: publisher.title, musicShowOnly: publisher.musicShowOnly },
        deletedAlbums: 0,
        deletedTracks: 0,
        kept: toKeep.length,
      });
    }

    const idsToDelete = toDelete.map(a => a.id);
    const totalTracks = toDelete.reduce((sum, a) => sum + a.trackCount, 0);

    // Cascade delete via Feed (Track has onDelete: Cascade in schema).
    await prisma.feed.deleteMany({ where: { id: { in: idsToDelete } } });

    invalidateFeedListCaches();

    return NextResponse.json({
      publisher: { id: publisher.id, title: publisher.title, musicShowOnly: publisher.musicShowOnly },
      deletedAlbums: toDelete.length,
      deletedTracks: totalTracks,
      kept: toKeep.length,
    });
  } catch (error) {
    console.error('Error running music-show-only cleanup:', error);
    return NextResponse.json({ error: 'Failed to run cleanup' }, { status: 500 });
  }
}
