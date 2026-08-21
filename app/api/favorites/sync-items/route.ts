import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import {
  favoriteForTrack,
  resolveFavoriteFeeds,
  resolveFavoriteTracks,
} from '@/lib/favorites/resolve-favorite-rows';

/**
 * GET /api/favorites/sync-items
 *
 * The favorites of the signed-in user, as the few fields the cross-app kind
 * 10333 list is built from — and nothing else.
 *
 * **Why this exists rather than reusing `/api/favorites/albums` and
 * `/api/favorites/tracks`.** Those render the `/favorites` page. To do that they
 * include up to 50 full track rows for every favorited feed, call Podcast Index
 * up to ten times to resolve publisher artwork, and scan the whole `Feed` table
 * twice to map artist names to images. `buildLocalItems` then discards all of
 * it: it reads a guid, a medium and a type from each album, and a guid plus the
 * parent feed's guid and medium from each track. It also drops every publisher
 * and playlist row — which is precisely what all that enrichment serves.
 *
 * That payload sat directly in front of the signing prompt. A user favoriting
 * something waited out the whole of it before their signer was even asked.
 *
 * **What must NOT diverge from those routes.** Two things decide which
 * favorites reach the published list, and both are copied deliberately:
 *
 *  1. The id ladders, shared through `resolve-favorite-rows.ts`. Both stored
 *     ids are polymorphic and every rung carries real rows.
 *  2. `favorite.type || feed.type` for albums, and the title+artist dedup for
 *     tracks. These change the SET of favorites, not their presentation, so
 *     dropping them here would quietly change what gets published.
 *
 * User-scoped only. There is no `sessionId` branch, because an anonymous
 * browser has no pubkey and so nothing to publish under.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = requireUser(request);
    if (!userId) {
      return NextResponse.json({ albums: [], tracks: [] });
    }

    const [favoriteAlbums, favoriteTracks] = await Promise.all([
      prisma.favoriteAlbum.findMany({
        where: { userId },
        select: { feedId: true, type: true },
      }),
      prisma.favoriteTrack.findMany({
        where: { userId },
        select: { trackId: true, nostrEventId: true, createdAt: true },
      }),
    ]);

    const [feedMap, trackRows] = await Promise.all([
      resolveFavoriteFeeds(
        favoriteAlbums.map((f) => f.feedId),
        (where) =>
          prisma.feed.findMany({
            where,
            select: { id: true, guid: true, medium: true, type: true },
          })
      ),
      resolveFavoriteTracks(
        favoriteTracks.map((f) => f.trackId),
        (where) =>
          prisma.track.findMany({
            where,
            // `title` and `Feed.artist` are here only to reproduce the dedup
            // below; neither is published.
            select: {
              id: true,
              guid: true,
              audioUrl: true,
              title: true,
              Feed: { select: { guid: true, medium: true, artist: true } },
            },
          })
      ),
    ]);

    // The stored favorite's own type wins over the feed's. It records where the
    // favorite was made — a publisher page, an album page — and it is what
    // decides the tab on `/favorites`. `buildLocalItems` drops publishers and
    // playlists on the strength of it, so reading `Feed.type` instead would
    // publish a favorited publisher as a feed entry on the shared list.
    const albums = favoriteAlbums.flatMap((favorite) => {
      const feed = feedMap.get(favorite.feedId);
      if (!feed?.guid) return [];
      return [{ guid: feed.guid, medium: feed.medium, type: favorite.type || feed.type }];
    });

    // Deduplicate by title + parent artist, exactly as `/api/favorites/tracks`
    // does: prefer the row already published to Nostr, then the oldest.
    const seen = new Map<
      string,
      { guid: string | null; Feed: { guid: string | null; medium: string | null } | null;
        nostrEventId: string | null; favoritedAt: Date | null }
    >();
    for (const track of trackRows) {
      const favorite = favoriteForTrack(track, favoriteTracks);
      const candidate = {
        guid: track.guid,
        Feed: track.Feed ? { guid: track.Feed.guid, medium: track.Feed.medium } : null,
        nostrEventId: favorite?.nostrEventId ?? null,
        favoritedAt: favorite?.createdAt ?? null,
      };
      const key = `${(track.title || '').toLowerCase().trim()}|${(track.Feed?.artist || '').toLowerCase().trim()}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, candidate);
        continue;
      }
      if (candidate.nostrEventId && !existing.nostrEventId) {
        seen.set(key, candidate);
      } else if (!candidate.nostrEventId && existing.nostrEventId) {
        // Keep the one already on Nostr.
      } else if (
        candidate.favoritedAt &&
        existing.favoritedAt &&
        candidate.favoritedAt < existing.favoritedAt
      ) {
        seen.set(key, candidate);
      }
    }

    const tracks = [...seen.values()].map(({ guid, Feed }) => ({ guid, Feed }));

    return NextResponse.json({ albums, tracks });
  } catch (error) {
    console.error('Error building favorite sync items:', error);
    // The caller treats a non-OK response as "no local items", and publishing
    // an empty list would delete the user's shared favorites. Fail loudly.
    return NextResponse.json(
      { error: 'Failed to build favorite sync items' },
      { status: 500 }
    );
  }
}
