import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateAlbumsFastCache } from '@/lib/caches/albums-fast-cache';
import { invalidateSearchCache } from '@/lib/caches/search-cache';

// POST /api/admin/music-show-only-publishers/cleanup-by-ids
// Body: { ids: string[], dryRun?: boolean }
//
// Bulk cleanup for the artist-name search panel: caller passes the set of
// already-imported feed IDs visible in the search results, server filters to
// the ones that are NOT podcasts and have NO SystemPlaylistTrack-linked
// tracks, and deletes them (or returns the to-delete/to-keep split when
// dryRun=true). Mirrors the per-publisher cleanup logic in `../route.ts` but
// operates on a flat list of feed IDs instead of children of a publisher.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, dryRun } = body as { ids?: string[]; dryRun?: boolean };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Body must include { ids: string[] } with at least one id' },
        { status: 400 }
      );
    }

    const feeds = await prisma.feed.findMany({
      where: { id: { in: ids } },
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

    type Candidate = { id: string; title: string; artist: string | null; trackCount: number };
    type Kept = Candidate & { playedTracks: number };
    const toDelete: Candidate[] = [];
    const toKeep: Kept[] = [];

    for (const feed of feeds) {
      // Don't auto-delete podcasts even if they slipped into search results.
      if (feed.type === 'podcast') continue;

      const playedTracks = feed.Track.filter(t => t.SystemPlaylistTrack.length > 0).length;
      if (playedTracks === 0) {
        toDelete.push({
          id: feed.id,
          title: feed.title,
          artist: feed.artist,
          trackCount: feed.Track.length,
        });
      } else {
        toKeep.push({
          id: feed.id,
          title: feed.title,
          artist: feed.artist,
          trackCount: feed.Track.length,
          playedTracks,
        });
      }
    }

    if (dryRun) {
      return NextResponse.json({ toDelete, toKeep });
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ deletedAlbums: 0, deletedTracks: 0, kept: toKeep.length });
    }

    const idsToDelete = toDelete.map(a => a.id);
    const totalTracks = toDelete.reduce((sum, a) => sum + a.trackCount, 0);

    await prisma.feed.deleteMany({ where: { id: { in: idsToDelete } } });

    invalidateAlbumsFastCache();
    invalidateSearchCache();

    return NextResponse.json({
      deletedAlbums: toDelete.length,
      deletedTracks: totalTracks,
      kept: toKeep.length,
    });
  } catch (error) {
    console.error('Error running cleanup-by-ids:', error);
    return NextResponse.json({ error: 'Failed to run cleanup' }, { status: 500 });
  }
}
