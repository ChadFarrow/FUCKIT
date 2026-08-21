import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildFeedIdEquivalence, feedLookupWhere, flattenFeedIdEquivalence, pickFavoriteRowForWrite } from '@/lib/favorite-feed-ids';
import { getSessionIdFromRequest } from '@/lib/session-utils';
import { requireUser } from '@/lib/auth/require-user';
import { getPublisherInfo } from '@/lib/url-utils';
import { podcastIndexAPI } from '@/lib/podcast-index-api';
import { normalizePubkey } from '@/lib/nostr/normalize';
import { resolveFavoriteFeeds } from '@/lib/favorites/resolve-favorite-rows';
import { Prisma } from '@prisma/client';

/**
 * GET /api/favorites/albums
 * Get all favorite albums for the current session
 */

/**
 * Every `feedId` one album favorite could be stored under.
 *
 * `FavoriteAlbum.feedId` is polymorphic with no migration, so POST, DELETE and
 * PATCH all have to look across the equivalence set rather than the one string
 * the caller sent. The expansion itself lives in `lib/favorite-feed-ids.ts` —
 * this is just the query half. See #192.
 */
async function expandFeedIdCandidates(feedId: string): Promise<string[]> {
  const feeds = await prisma.feed.findMany({
    where: feedLookupWhere([feedId]),
    select: { id: true, guid: true },
  });
  return flattenFeedIdEquivalence(buildFeedIdEquivalence([feedId], feeds));
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const userId = requireUser(request);

    // Build where clause - support both session and user
    const where: any = {};
    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    } else {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No session ID or user ID provided'
      });
    }

    const favoriteAlbums = await prisma.favoriteAlbum.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Get feed details for each favorite. `FavoriteAlbum.feedId` is polymorphic
    // — `Feed.id` for some rows, `Feed.guid` for others — so the lookup goes
    // through the shared ladder, which `/api/favorites/sync-items` also uses.
    // Keep them on one ladder: a rung added or lost on only one side is how a
    // favorite ends up visible on the page and missing from the shared list.
    const feedIds = favoriteAlbums.map(fa => fa.feedId);
    //
    // The `Track` include is the largest thing this route sends — 593 KB of a
    // 1.27 MB page load, measured on a 94-feed account (1,007 track rows).
    // It is NOT removable on its own, and this comment exists so the next
    // person does not try: `AlbumCard` reads `album.tracks` at render time for
    // the album download button, which needs the track list to show whether
    // the album is downloaded, and for the "videos" vs "tracks" label. Dropping
    // it makes the download button vanish from every card here. Shrinking that
    // payload means giving the downloads context a way to resolve an album's
    // tracks by feed id, which is a change to `lib/downloads/`, not to this
    // select.
    const feedMap = await resolveFavoriteFeeds(feedIds, (where) =>
      prisma.feed.findMany({
        where,
        include: {
          Track: {
            where: { audioUrl: { not: '' }, status: 'active' },
            take: 50,
            orderBy: { trackOrder: 'asc' },
            select: {
              id: true,
              guid: true,
              title: true,
              artist: true,
              duration: true,
              image: true,
              audioUrl: true,
              mediaType: true,
              trackOrder: true
            }
          },
          _count: {
            select: { Track: true }
          }
        }
      })
    );

    // Collect synthetic artist IDs (from /api/publishers) that need DB resolution
    const syntheticArtistIds = new Set<string>();
    for (const fav of favoriteAlbums) {
      if (!feedMap.has(fav.feedId) && fav.feedId.startsWith('artist-')) {
        syntheticArtistIds.add(fav.feedId);
      }
    }

    // Resolve synthetic artist IDs by looking up album feeds by artist name
    const syntheticPublisherData = new Map<string, { title: string; image: string | null; itemCount: number }>();
    if (syntheticArtistIds.size > 0) {
      // Query all album/music feeds to match against artist names
      const albumFeeds = await prisma.feed.findMany({
        where: {
          type: { in: ['album', 'music'] },
          status: 'active',
          artist: { not: null }
        },
        select: { artist: true, image: true }
      });

      // Group by lowercased artist name and build synthetic ID -> data map
      // Build the same synthetic ID that /api/publishers creates:
      //   `artist-${artist.toLowerCase().trim().replace(/\s+/g, '-')}`
      const artistAlbums = new Map<string, { count: number; image: string | null; name: string }>();
      for (const album of albumFeeds) {
        if (!album.artist) continue;
        const key = album.artist.toLowerCase().trim();
        const existing = artistAlbums.get(key);
        if (existing) {
          existing.count++;
          if (!existing.image && album.image) existing.image = album.image;
        } else {
          artistAlbums.set(key, { count: 1, image: album.image, name: album.artist });
        }
      }

      // Match synthetic IDs by rebuilding them from artist names
      for (const [key, data] of artistAlbums) {
        const syntheticId = `artist-${key.replace(/\s+/g, '-')}`;
        if (syntheticArtistIds.has(syntheticId)) {
          syntheticPublisherData.set(syntheticId, {
            title: data.name,
            image: data.image,
            itemCount: data.count
          });
        }
      }
    }

    // Map all favorites, including those without feeds (e.g., publishers not yet indexed)
    const feedsWithFavorites = favoriteAlbums.map(favorite => {
      const feed = feedMap.get(favorite.feedId);
      if (feed) {
        // Feed exists in database
        let artistName = feed.artist;

        // Use the stored favorite type - this determines which tab it appears in
        // The type is set when the favorite is created based on where it was favorited from
        // (publisher page -> 'publisher', album page -> 'album', etc.)
        // For legacy favorites without a type, fall back to the Feed's type
        const feedType = favorite.type || feed.type;

        // Resolve artist name for display
        if (!artistName || artistName === 'Unknown Artist') {
          // Try to get artist name from publisher info for display purposes only
          const publisherInfo = getPublisherInfo(favorite.feedId);
          if (publisherInfo?.name) {
            artistName = publisherInfo.name;
          } else {
            artistName = feed.title;
          }
        }

        return {
          ...feed,
          type: feedType,
          artist: artistName || feed.artist,
          favoritedAt: favorite.createdAt,
          trackCount: (feed as any)._count?.Track || 0
        };
      } else if (syntheticPublisherData.has(favorite.feedId)) {
        // Synthetic artist ID from /api/publishers — resolve from album feeds
        const data = syntheticPublisherData.get(favorite.feedId)!;
        return {
          id: favorite.feedId,
          title: data.title,
          artist: data.title,
          type: 'publisher' as const,
          image: data.image,
          itemCount: data.itemCount,
          favoritedAt: favorite.createdAt,
          createdAt: favorite.createdAt,
          updatedAt: favorite.createdAt
        };
      } else {
        // Feed doesn't exist (e.g., not yet indexed)
        // Use the stored favorite type, or try to infer from publisher mapping
        const publisherInfo = getPublisherInfo(favorite.feedId);
        const resolvedTitle = publisherInfo?.name || favorite.feedId;
        const resolvedArtist = publisherInfo?.name ?? null;

        // Use stored type, fall back to 'publisher' only if publisher info exists
        const feedType = favorite.type || (publisherInfo ? 'publisher' : 'album');

        return {
          id: favorite.feedId,
          title: resolvedTitle,
          artist: resolvedArtist,
          type: feedType,
          image: null as string | null, // Will be populated below
          itemCount: 0, // Will be populated below
          favoritedAt: favorite.createdAt,
          createdAt: favorite.createdAt,
          updatedAt: favorite.createdAt
        };
      }
    });

    // For publisher favorites missing data (image, title), resolve from Podcast Index
    // The feedId IS the feed GUID, so we can look it up directly
    const unresolvedPublishers = feedsWithFavorites.filter(f =>
      f.type === 'publisher' && (!f.image || f.title === f.id)
    );
    if (unresolvedPublishers.length > 0) {
      const lookups = unresolvedPublishers.slice(0, 10).map(p => {
        const info = getPublisherInfo(p.id);
        // Use feedGuid from KNOWN_PUBLISHERS if available, otherwise use the feedId directly
        const guid = info?.feedGuid || p.id;
        return { id: p.id, guid };
      });

      const results = await Promise.allSettled(
        lookups.map(async ({ id, guid }) => {
          try {
            const feed = await podcastIndexAPI.getFeedByGuid(guid);
            return {
              id,
              title: feed?.title || null,
              artist: feed?.author || feed?.title || null,
              image: feed?.artwork || feed?.image || null,
            };
          } catch {
            return { id, title: null, artist: null, image: null };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const pub = unresolvedPublishers.find(p => p.id === result.value.id);
          if (pub) {
            if (result.value.image && !pub.image) {
              (pub as any).image = result.value.image;
            }
            if (result.value.title && pub.title === pub.id) {
              (pub as any).title = result.value.title;
            }
            if (result.value.artist && !pub.artist) {
              (pub as any).artist = result.value.artist;
            }
          }
        }
      }
    }

    // Clean up any publishers still showing raw GUIDs as titles
    for (const pub of feedsWithFavorites) {
      if (pub.type === 'publisher' && pub.title === pub.id && /^[0-9a-f-]{8,}$/i.test(pub.id)) {
        (pub as any).title = 'Unknown Publisher';
        if (!pub.artist) (pub as any).artist = 'Unknown Publisher';
      }
    }

    // Resolve missing images from album feeds by artist name
    // Publisher feeds often don't store artwork, but their album feeds do
    const publishersMissingImages = feedsWithFavorites.filter(f =>
      f.type === 'publisher' && !f.image && f.artist && f.artist !== 'Unknown Publisher'
    );
    if (publishersMissingImages.length > 0) {
      const albumsWithImages = await prisma.feed.findMany({
        where: {
          type: { not: 'publisher' },
          image: { not: null },
          artist: { not: null }
        },
        select: { artist: true, image: true }
      });

      // Build case-insensitive artist -> image map (first non-null image wins)
      const imageByArtist = new Map<string, string>();
      for (const album of albumsWithImages) {
        if (!album.artist || !album.image) continue;
        const key = album.artist.toLowerCase().trim();
        if (!imageByArtist.has(key)) {
          imageByArtist.set(key, album.image);
        }
      }

      for (const pub of publishersMissingImages) {
        const key = (pub.artist as string).toLowerCase().trim();
        const albumImage = imageByArtist.get(key);
        if (albumImage) {
          (pub as any).image = albumImage;
        }
      }
    }

    // Calculate album count for publisher favorites that don't have itemCount yet
    // (Synthetic artist IDs already have itemCount from the resolution above)
    const allPublisherFavorites = feedsWithFavorites.filter(f => f.type === 'publisher');
    const publishersNeedingCount = allPublisherFavorites.filter(
      p => p.artist && (p as any).itemCount === undefined
    );

    if (publishersNeedingCount.length > 0) {
      // Query all non-publisher feeds to match artist names case-insensitively
      const albumFeeds = await prisma.feed.findMany({
        where: {
          type: { not: 'publisher' },
          artist: { not: null }
        },
        select: { artist: true }
      });

      // Build case-insensitive count map
      const countByArtistLower = new Map<string, number>();
      for (const album of albumFeeds) {
        if (!album.artist) continue;
        const key = album.artist.toLowerCase().trim();
        countByArtistLower.set(key, (countByArtistLower.get(key) || 0) + 1);
      }

      // Apply counts to publishers using case-insensitive matching
      for (const publisher of publishersNeedingCount) {
        const key = (publisher.artist as string).toLowerCase().trim();
        (publisher as any).itemCount = countByArtistLower.get(key) || 0;
      }
    }

    // Fall back to Track count from the DB when artist matching found 0
    // Publisher feeds store album references as Track records
    for (const publisher of allPublisherFavorites) {
      if ((publisher as any).itemCount === undefined || (publisher as any).itemCount === 0) {
        const trackCount = (publisher as any)._count?.Track || (publisher as any).trackCount || 0;
        if (trackCount > 0) {
          (publisher as any).itemCount = trackCount;
        }
      }
      // Ensure itemCount is always defined
      if ((publisher as any).itemCount === undefined) {
        (publisher as any).itemCount = 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: feedsWithFavorites,
      count: feedsWithFavorites.length
    });
  } catch (error) {
    console.error('Error fetching favorite albums:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If tables don't exist yet, return empty array
    if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown model')) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Favorites tables not initialized yet'
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch favorite albums'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites/albums
 * Add an album (feed) to favorites
 * Body: { feedId: string, nostrEventId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const userId = requireUser(request, { write: true });

    if (!sessionId && !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID or user ID required'
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { feedId, nostrEventId, type } = body;
    // Validate type if provided, default to 'album'
    const favoriteType = ['album', 'publisher', 'playlist'].includes(type) ? type : 'album';

    if (!feedId || typeof feedId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'feedId is required and must be a string'
        },
        { status: 400 }
      );
    }

    // Verify feed exists (but allow publisher feeds and be lenient)
    const feed = await prisma.feed.findUnique({
      where: { id: feedId }
    });

    // If feed not found, check if it's a publisher feed (type === 'publisher')
    // Allow favoriting even if feed doesn't exist - favorites are user preferences
    // and don't necessarily require the feed to be in the database
    if (!feed) {
      // Try to find by checking if it's a publisher feed
      const publisherFeed = await prisma.feed.findFirst({
        where: {
          id: feedId,
          type: 'publisher'
        }
      });

      // If it's not a publisher feed either, still allow favoriting
      // (user might be favoriting something that hasn't been indexed yet)
      // We'll just skip the feed validation and proceed
    }

    // Check if already favorited.
    //
    // Across the equivalence set, not the exact string (#192). An exact-match
    // dedupe creates a SECOND row for the same album under a different format
    // whenever one already exists under another — which is where the
    // divergence the other paths have to compensate for comes from in the
    // first place. `findUnique` on the composite key can't express this, so
    // this queries the candidates.
    //
    // Narrowed to one row deterministically, for the same reason as the PATCH
    // below: this branch may write `nostrEventId` onto whatever it picks, and
    // an arbitrary pick between duplicates puts it on the wrong one.
    const existingCandidates = await expandFeedIdCandidates(feedId);
    const existingWhere: any = { feedId: { in: existingCandidates } };
    if (userId) {
      existingWhere.userId = userId;
    } else if (sessionId) {
      existingWhere.sessionId = sessionId;
    }

    const existing = (userId || sessionId)
      ? pickFavoriteRowForWrite(
          await prisma.favoriteAlbum.findMany({ where: existingWhere }),
          feedId
        )
      : null;

    if (existing) {
      // If it exists and we have a nostrEventId, update it
      if (nostrEventId && !existing.nostrEventId) {
        const updated = await prisma.favoriteAlbum.update({
          where: { id: existing.id },
          data: { nostrEventId, nip51Format: true }
        });
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Album already in favorites, updated with Nostr event ID'
        });
      }
      return NextResponse.json({
        success: true,
        data: existing,
        message: 'Album already in favorites'
      });
    }

    // Add to favorites
    const createData: any = {
      feedId,
      type: favoriteType
    };
    
    if (userId) {
      createData.userId = userId;
    }
    if (sessionId) {
      createData.sessionId = sessionId;
    }
    if (nostrEventId) {
      createData.nostrEventId = nostrEventId;
      createData.nip51Format = true;
    }
    
    const favorite = await prisma.favoriteAlbum.create({
      data: createData
    });

    return NextResponse.json({
      success: true,
      data: favorite
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding album to favorites:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If tables don't exist yet, return a helpful message
    if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown model')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Favorites tables not initialized. Please run database migration.'
        },
        { status: 503 } // Service Unavailable
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add album to favorites'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorites/albums
 * Remove an album from favorites (using body instead of path param for URL feedIds)
 * Body: { feedId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const userId = requireUser(request, { write: true });

    if (!sessionId && !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID or user ID required'
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const feedId = body.feedId;

    if (!feedId || typeof feedId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'feedId is required and must be a string'
        },
        { status: 400 }
      );
    }

    // feedId is polymorphic — a row may hold a Feed.id, a Feed.guid or a
    // synthetic artist id, depending on which surface wrote it. The GET above
    // already resolves all of those, so an exact-match delete could 404 on a
    // favorite the user can plainly see in their list: the heart would turn on
    // and then refuse to turn off. Resolve the same equivalence set here.
    const candidateFeedIds = await expandFeedIdCandidates(feedId);

    // Build where clause - support both session and user
    const where: any = { feedId: { in: candidateFeedIds } };
    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    }

    // Get the favorites first to retrieve their nostrEventIds before deleting.
    //
    // ALL of them, not one: the `deleteMany` below removes every row in the
    // widened candidate set, so returning a single id lets the caller publish
    // one kind-5 and leaves the other rows' kind-30001 events live on relays —
    // still surfacing in the Community tab for an item the user unfavorited.
    // Widening the delete without widening this would manufacture orphans.
    const favorites = await prisma.favoriteAlbum.findMany({ where });

    if (favorites.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Favorite not found'
        },
        { status: 404 }
      );
    }

    const nostrEventIds = favorites
      .map((row) => row.nostrEventId)
      .filter((id): id is string => !!id);

    // Remove from favorites
    await prisma.favoriteAlbum.deleteMany({
      where
    });

    return NextResponse.json({
      success: true,
      message: 'Album removed from favorites',
      // Kept for callers reading the single-id shape; `nostrEventIds` is the
      // complete set and is what the deletion publisher should use.
      nostrEventIds,
      nostrEventId: nostrEventIds[0] ?? null
    });
  } catch (error) {
    console.error('Error removing album from favorites:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove album from favorites'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/favorites/albums
 * Update a favorite album (e.g., add nostrEventId)
 * Body: { feedId: string, nostrEventId?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const userId = requireUser(request, { write: true });

    if (!sessionId && !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID or user ID required'
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { feedId, nostrEventId } = body;

    if (!feedId || typeof feedId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'feedId is required and must be a string'
        },
        { status: 400 }
      );
    }

    // Find the existing favorite.
    //
    // Expanded like every other path (#192). This was the last exact-match
    // lookup, and its failure is silent with a tail: a row stored under a
    // different format than the string this surface holds never receives its
    // `nostrEventId`, and `queueFavoriteDeletion` needs that id to publish the
    // kind-5 — so unfavoriting can never propagate on the 30001 channel for
    // that row. The cross-app kind-30078 list is unaffected (removal there is
    // absence from the next revision), which is exactly the kind of split that
    // is hard to notice: one channel keeps working.
    const feedIdCandidates = await expandFeedIdCandidates(feedId);

    const where: any = { feedId: { in: feedIdCandidates } };
    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    }

    // This is a WRITE, so the widened set has to be narrowed back down to one
    // deterministic row — `findFirst` over the `IN` would pick arbitrarily and
    // relocate the bug this expansion exists to fix. `syncFavoritesToNostr`
    // PATCHes once per row with that row's own `feedId`, so an arbitrary pick
    // would give one row the event id published for another's d-tag and leave
    // the other with none. See `pickFavoriteRowForWrite`.
    const candidateRows = await prisma.favoriteAlbum.findMany({ where });
    const existing = pickFavoriteRowForWrite(candidateRows, feedId);

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Favorite not found'
        },
        { status: 404 }
      );
    }

    // If this row already carried a DIFFERENT event id, the one it held is now
    // superseded and must be reported back, not silently dropped.
    //
    // Reachable since the lookup was widened: this PATCH sends the surface's
    // own `itemId`, so it can now land on a row written under another format
    // that already published under a different `d` tag. Kind 30001 is
    // addressable, so a republish only replaces the event at the SAME `d` —
    // two different d tags are two live events. Overwriting the id blindly
    // left the older one unreachable by `queueFavoriteDeletion` forever, still
    // showing in the Community tab; keeping the older one instead would strand
    // the newer. Keep the newest and hand the caller the one to kind-5.
    const supersededEventId =
      nostrEventId && existing.nostrEventId && existing.nostrEventId !== nostrEventId
        ? existing.nostrEventId
        : null;

    // Update with nostrEventId if provided
    const updated = await prisma.favoriteAlbum.update({
      where: { id: existing.id },
      data: {
        ...(nostrEventId ? { nostrEventId, nip51Format: true } : {})
      }
    });

    return NextResponse.json({
      success: true,
      supersededEventId,
      data: updated
    });
  } catch (error) {
    console.error('Error updating favorite album:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update favorite album'
      },
      { status: 500 }
    );
  }
}
