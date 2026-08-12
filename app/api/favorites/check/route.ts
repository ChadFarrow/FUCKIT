import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionIdFromRequest } from '@/lib/session-utils';
import { normalizePubkey } from '@/lib/nostr/normalize';
import { buildFeedIdEquivalence, feedLookupWhere, flattenFeedIdEquivalence, isFeedIdFavorited } from '@/lib/favorite-feed-ids';

/**
 * POST /api/favorites/check
 * Check if tracks/albums are favorited for the current session
 * Body: { trackIds?: string[], feedIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const userId = request.headers.get('x-nostr-user-id');
    
    if (!sessionId && !userId) {
      return NextResponse.json({
        success: true,
        data: {
          tracks: {},
          albums: {}
        }
      });
    }

    const body = await request.json();
    const { trackIds = [], feedIds = [] } = body;

    const results: {
      tracks: Record<string, boolean>;
      albums: Record<string, boolean>;
    } = {
      tracks: {},
      albums: {}
    };

    // Note: both branches below build their own where clause over the EXPANDED
    // identifier set. An exact-match clause here would be dead code that reads
    // like the real one — which is how the albums branch stayed exact while
    // the tracks branch grew its expansion.

    // Check tracks
    if (trackIds.length > 0) {
      try {
        // First, look up tracks to get all their identifiers (id, guid, audioUrl)
        // This allows us to match favorites stored with different identifiers
        const tracks = await prisma.track.findMany({
          where: {
            OR: [
              { id: { in: trackIds } },
              { guid: { in: trackIds } },
              { audioUrl: { in: trackIds } }
            ]
          },
          select: { id: true, guid: true, audioUrl: true }
        });

        // Build a map: input trackId -> all possible identifiers for that track
        const trackIdToAllIds = new Map<string, string[]>();
        for (const inputId of trackIds) {
          const possibleIds = [inputId];
          // Find if this inputId matches any track
          const matchedTrack = tracks.find(t =>
            t.id === inputId || t.guid === inputId || t.audioUrl === inputId
          );
          if (matchedTrack) {
            if (matchedTrack.id && !possibleIds.includes(matchedTrack.id)) possibleIds.push(matchedTrack.id);
            if (matchedTrack.guid && !possibleIds.includes(matchedTrack.guid)) possibleIds.push(matchedTrack.guid);
            if (matchedTrack.audioUrl && !possibleIds.includes(matchedTrack.audioUrl)) possibleIds.push(matchedTrack.audioUrl);
          }
          trackIdToAllIds.set(inputId, possibleIds);
        }

        // Get all possible trackIds to check
        const allPossibleIds = [...new Set(Array.from(trackIdToAllIds.values()).flat())];

        // Check favorites with expanded identifier list
        const expandedWhere: any = { trackId: { in: allPossibleIds } };
        if (userId) {
          expandedWhere.userId = userId;
        } else if (sessionId) {
          expandedWhere.sessionId = sessionId;
        }

        const favoriteTracks = await prisma.favoriteTrack.findMany({
          where: expandedWhere,
          select: { trackId: true }
        });

        const favoritedTrackIds = new Set(favoriteTracks.map(ft => ft.trackId));

        // Check if ANY of the possible identifiers for each input trackId is favorited
        trackIds.forEach((trackId: string) => {
          const possibleIds = trackIdToAllIds.get(trackId) || [trackId];
          results.tracks[trackId] = possibleIds.some(id => favoritedTrackIds.has(id));
        });
      } catch (trackError) {
        // If tables don't exist, just set all to false
        console.warn('Error checking favorite tracks (tables may not exist):', trackError);
        trackIds.forEach((trackId: string) => {
          results.tracks[trackId] = false;
        });
      }
    }

    // Check albums.
    //
    // FavoriteAlbum.feedId is POLYMORPHIC — a row may hold a Feed.id, a
    // Feed.guid, or a synthetic artist id, because the call sites write
    // whichever the album object in hand carried (the home list rows send
    // `album.feedId || album.feedGuid`). The favorites LIST resolves all of
    // those, so the album shows up there; this check used to compare the one
    // string it was handed, so the same album's heart read as unfavorited on
    // its own page. Present in your favorites, unfilled heart — reported
    // against a 14-track album, so it is unrelated to the single-track rule.
    //
    // Expand the way the tracks branch above already does: resolve each input
    // to every identifier its Feed answers to, and count a hit on any of them.
    if (feedIds.length > 0) {
      try {
        const feeds = await prisma.feed.findMany({
          where: feedLookupWhere(feedIds),
          select: { id: true, guid: true }
        });

        // All matches, not the first. One input string can match two rows —
        // feed A by `id`, feed B by `guid` — and taking one dropped the other's
        // identifiers, so a favorite stored under them missed. See
        // `lib/favorite-feed-ids.ts`.
        const feedIdToAllIds = buildFeedIdEquivalence(feedIds, feeds);
        const allPossibleFeedIds = flattenFeedIdEquivalence(feedIdToAllIds);

        const expandedAlbumWhere: any = { feedId: { in: allPossibleFeedIds } };
        if (userId) {
          expandedAlbumWhere.userId = userId;
        } else if (sessionId) {
          expandedAlbumWhere.sessionId = sessionId;
        }

        const favoriteAlbums = await prisma.favoriteAlbum.findMany({
          where: expandedAlbumWhere,
          select: {
            feedId: true
          }
        });

        const favoritedFeedIds = new Set(favoriteAlbums.map(fa => fa.feedId));

        feedIds.forEach((feedId: string) => {
          results.albums[feedId] = isFeedIdFavorited(feedId, feedIdToAllIds, favoritedFeedIds);
        });
      } catch (albumError) {
        // If tables don't exist, just set all to false
        console.warn('Error checking favorite albums (tables may not exist):', albumError);
        feedIds.forEach((feedId: string) => {
          results.albums[feedId] = false;
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error checking favorites:', error);
    
    // Return empty results if there's any error (tables may not exist yet)
    return NextResponse.json({
      success: true,
      data: {
        tracks: {},
        albums: {}
      }
    });
  }
}

