import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeUrl } from '@/lib/url-utils';
import { invalidateAlbumsFastCache } from '@/lib/caches/albums-fast-cache';
import { invalidateSearchCache } from '@/lib/caches/search-cache';

/**
 * POST /api/admin/feeds/mark-dead
 *
 * Manually flag a feed as dead (e.g. taken down upstream / removed from
 * Wavlake) or restore it. The row stays in the DB — `markedDead` hides it from
 * every read surface (grid, New, search, publisher pages) and makes the Step 5b
 * cron skip it, so a dead feed can't be re-minted. `markedDead` is orthogonal
 * to `status`, so refresh/parse status transitions never clobber the flag.
 *
 * Body: { url?: string, id?: string, dead?: boolean (default true), preview?: boolean }
 * Provide either `id` (exact feed ID) or `url` (feed's originalUrl).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, id, dead = true, preview = false } = body ?? {};

    if (!url && !id) {
      return NextResponse.json(
        { error: 'Provide a feed `id` or `url`' },
        { status: 400 }
      );
    }

    // Resolve the feed: exact ID first, then originalUrl (normalized + raw).
    let feed = null;
    if (id) {
      feed = await prisma.feed.findUnique({ where: { id } });
    }
    if (!feed && url) {
      const normalized = normalizeUrl(url);
      feed = await prisma.feed.findFirst({
        where: { OR: [{ originalUrl: normalized }, { originalUrl: url }] },
      });
    }

    if (!feed) {
      return NextResponse.json(
        { found: false, message: `No feed found for ${id || url}` },
        { status: 404 }
      );
    }

    if (preview) {
      return NextResponse.json({
        found: true,
        feed: {
          id: feed.id,
          title: feed.title,
          artist: feed.artist,
          originalUrl: feed.originalUrl,
          markedDead: feed.markedDead,
        },
      });
    }

    const updated = await prisma.feed.update({
      where: { id: feed.id },
      data: { markedDead: Boolean(dead) },
      select: { id: true, title: true, artist: true, originalUrl: true, markedDead: true },
    });

    // A dead/restored feed changes the grid + search results.
    invalidateAlbumsFastCache();
    invalidateSearchCache();

    return NextResponse.json({
      success: true,
      action: updated.markedDead ? 'marked-dead' : 'restored',
      feed: updated,
    });
  } catch (error) {
    console.error('Error in mark-dead:', error);
    return NextResponse.json(
      { error: 'Failed to update feed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
