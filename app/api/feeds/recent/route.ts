import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlaylistUrls, getAllPlaylistIds } from '@/lib/playlist/configs';
import { getBlacklistedFeedIds, BLACKLISTED_FEED_URLS } from '@/lib/feed-exclusions';

// Feeds ranked by MAX(latest Track.createdAt, Feed.createdAt) — surfaces both
// brand-new feed mints and feeds that just got new tracks (e.g., a podcast
// publishing a new episode). Used by the home page's "New" section.
//
// Includes both type='album' and type='podcast' rows: the whole point of using
// the track-createdAt signal is catching new episodes on long-running podcast
// feeds, which the main /api/albums-fast 'all' view filters out by design.
//
// 3-query plan keeps the dataset traversal light: aggregate once, sort lightweight
// rows, then heavily fetch only the top N. Computing MAX from a feed.Track[] capped
// at 20 (albums-fast pattern) is wrong here — that select orders trackOrder asc,
// so newest tracks on long feeds fall outside the window.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50);

    const [lightFeeds, trackAggs] = await Promise.all([
      prisma.feed.findMany({
        where: {
          status: 'active',
          type: { in: ['album', 'podcast'] },
        },
        select: {
          id: true,
          createdAt: true,
          originalUrl: true,
        },
      }),
      prisma.track.groupBy({
        by: ['feedId'],
        where: { status: 'active', audioUrl: { not: '' } },
        _max: { createdAt: true },
      }),
    ]);

    const lastTrackByFeed = new Map<string, number>(
      trackAggs.map((r) => [
        r.feedId,
        r._max.createdAt ? r._max.createdAt.getTime() : 0,
      ])
    );

    const playlistUrls = new Set(getPlaylistUrls());
    const playlistIds = new Set(getAllPlaylistIds());
    const blacklistedIds = new Set(getBlacklistedFeedIds());
    const blacklistedUrls = new Set(BLACKLISTED_FEED_URLS);

    const ranked = lightFeeds
      .filter(
        (f) =>
          !playlistIds.has(f.id) &&
          !blacklistedIds.has(f.id) &&
          (!f.originalUrl || !playlistUrls.has(f.originalUrl)) &&
          (!f.originalUrl || !blacklistedUrls.has(f.originalUrl))
      )
      .map((f) => ({
        id: f.id,
        sortKey: Math.max(
          lastTrackByFeed.get(f.id) ?? 0,
          new Date(f.createdAt).getTime()
        ),
      }))
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, limit);

    if (ranked.length === 0) {
      return NextResponse.json(
        { albums: [], count: 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
      );
    }

    const topIds = ranked.map((r) => r.id);

    const fullFeeds = await prisma.feed.findMany({
      where: { id: { in: topIds } },
      select: {
        id: true,
        guid: true,
        title: true,
        description: true,
        originalUrl: true,
        type: true,
        artist: true,
        image: true,
        priority: true,
        createdAt: true,
        oldestItemPubdate: true,
        v4vRecipient: true,
        v4vValue: true,
        persons: true,
        Track: {
          where: { audioUrl: { not: '' }, status: 'active' },
          select: {
            id: true,
            guid: true,
            title: true,
            duration: true,
            audioUrl: true,
            image: true,
            publishedAt: true,
            v4vRecipient: true,
            v4vValue: true,
            startTime: true,
            endTime: true,
            trackOrder: true,
            mediaType: true,
            alternateEnclosures: true,
            chaptersUrl: true,
            chapters: true,
            valueTimeSplits: true,
            persons: true,
          },
          orderBy: [
            { trackOrder: 'asc' },
            { publishedAt: 'asc' },
            { createdAt: 'asc' },
          ],
          take: 20,
        },
        _count: { select: { Track: { where: { status: 'active' } } } },
      },
    });

    const feedById = new Map(fullFeeds.map((f) => [f.id, f]));

    const albums = ranked
      .map((r) => feedById.get(r.id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .map((feed) => {
        const isPodcast = feed.type === 'podcast';
        // Podcasts: episodes newest-first (matches /api/albums-fast podcasts path).
        const sortedTracks = isPodcast
          ? [...feed.Track].sort((a, b) => {
              const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
              const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
              return db - da;
            })
          : feed.Track;
        return {
          id: feed.id,
          title: feed.title,
          type: feed.type || 'album',
          ...(isPodcast ? { isPodcast: true } : {}),
          artist: feed.artist || feed.title,
          description: feed.description || '',
          coverArt: feed.image || '',
          releaseDate: feed.oldestItemPubdate || feed.createdAt,
          dateAdded: feed.createdAt,
          feedUrl: feed.originalUrl,
          feedGuid: feed.guid || null,
          feedId: feed.id,
          remoteFeedGuid: feed.guid || null,
          guid: feed.Track?.[0]?.guid || feed.id,
          episodeGuid: feed.Track?.[0]?.guid || feed.id,
          link: feed.originalUrl,
          priority: feed.priority,
          tracks: sortedTracks.map((track) => ({
            id: track.id,
            title: track.title,
            duration: track.duration || 180,
            url: track.audioUrl,
            image: track.image,
            publishedAt: track.publishedAt,
            guid: track.guid,
            v4vRecipient: track.v4vRecipient,
            v4vValue: track.v4vValue,
            startTime: track.startTime,
            endTime: track.endTime,
            mediaType: track.mediaType || 'audio',
            alternateEnclosures: track.alternateEnclosures,
            chaptersUrl: track.chaptersUrl || undefined,
            chapters: track.chapters || undefined,
            valueTimeSplits: track.valueTimeSplits || undefined,
            persons: (track as { persons?: unknown }).persons || undefined,
          })),
          v4vRecipient: feed.v4vRecipient,
          v4vValue: feed.v4vValue,
          persons: (feed as { persons?: unknown }).persons || undefined,
          trackCount: feed._count?.Track || 0,
          ...(isPodcast ? { totalTracks: feed._count?.Track || 0 } : {}),
        };
      });

    return NextResponse.json(
      { albums, count: albums.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    console.error('Error in /api/feeds/recent:', err);
    return NextResponse.json(
      { albums: [], count: 0, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
