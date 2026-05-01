import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePodcastIndexHeaders } from '@/lib/podcast-index-api';
import { getEpisodesFromAPI, parseDuration } from '@/lib/feed-parsing';
import { calculateTrackOrder } from '@/lib/rss-parser-db';
import { generateAlbumSlug, normalizeUrl } from '@/lib/url-utils';
import { invalidateAlbumsFastCache } from '@/lib/caches/albums-fast-cache';
import { invalidateSearchCache } from '@/lib/caches/search-cache';

const API_BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * POST /api/admin/feeds/import-from-pi
 *
 * PI-API-only feed import. Use when rss-parser chokes on a feed (e.g.
 * Oncetold-hosted feeds where Railway's parser intermittently fails
 * with "Unencoded <" or "Feed not recognized as RSS 1 or 2" while the
 * same XML parses cleanly elsewhere). PI's parser handles those feeds,
 * so we lift episodes via PI's REST API and skip our parser entirely.
 *
 * Body: { piFeedId?: number, podcastGuid?: string, type?: 'album'|'podcast'|'music' }
 * One of piFeedId or podcastGuid required. Type defaults to 'podcast'.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { piFeedId, podcastGuid, type = 'podcast' } = body as {
      piFeedId?: number;
      podcastGuid?: string;
      type?: string;
    };

    if (!piFeedId && !podcastGuid) {
      return NextResponse.json(
        { error: 'Body must include piFeedId (number) or podcastGuid (string)' },
        { status: 400 }
      );
    }

    const headers = await generatePodcastIndexHeaders();
    const lookupUrl = piFeedId
      ? `${API_BASE_URL}/podcasts/byfeedid?id=${piFeedId}`
      : `${API_BASE_URL}/podcasts/byguid?guid=${encodeURIComponent(podcastGuid!)}`;
    const lookupRes = await fetch(lookupUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!lookupRes.ok) {
      return NextResponse.json(
        { error: `Podcast Index lookup failed: ${lookupRes.status}` },
        { status: 502 }
      );
    }
    const lookupData = await lookupRes.json();
    const piFeed = lookupData.feed;
    if (!piFeed?.id) {
      return NextResponse.json(
        { error: 'Podcast Index has no record for that feed' },
        { status: 404 }
      );
    }

    const feedUrl = normalizeUrl(piFeed.url || piFeed.originalUrl || '');
    if (!feedUrl) {
      return NextResponse.json(
        { error: 'PI returned no feed URL — cannot import' },
        { status: 502 }
      );
    }

    // Refuse if already in DB so callers don't accidentally clobber an
    // existing healthy row. Caller must delete the prior row first.
    const dedupConditions: any[] = [{ originalUrl: feedUrl }];
    if (piFeed.podcastGuid) {
      dedupConditions.push({ guid: piFeed.podcastGuid });
      dedupConditions.push({ id: piFeed.podcastGuid });
    }
    const existing = await prisma.feed.findFirst({
      where: { OR: dedupConditions },
      select: { id: true, type: true, status: true, title: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'Feed already exists in DB',
          existing,
        },
        { status: 409 }
      );
    }

    // Slug-based ID, same pattern as publishers/import-albums.
    const baseSlug = (() => {
      const parts: string[] = [];
      if (piFeed.author) parts.push(generateAlbumSlug(piFeed.author));
      if (piFeed.title) parts.push(generateAlbumSlug(piFeed.title));
      let slug = parts.join('-');
      if (!slug || slug.length < 2) slug = `feed-${Date.now()}`;
      return slug;
    })();
    let feedId = baseSlug;
    if (await prisma.feed.findUnique({ where: { id: feedId } })) {
      feedId = `${baseSlug}-${Date.now()}`;
    }

    // Format feed-level v4v from PI shape.
    let v4vValue: any = null;
    let v4vRecipient: string | null = null;
    if (piFeed.value?.model && piFeed.value?.destinations) {
      v4vValue = {
        type: piFeed.value.model.type || 'lightning',
        method: piFeed.value.model.method || 'keysend',
        suggested: piFeed.value.model.suggested,
        recipients: piFeed.value.destinations.map((r: any) => ({
          name: r.name,
          type: r.type,
          address: r.address,
          split: r.split,
          customKey: r.customKey,
          customValue: r.customValue,
          fee: r.fee || false,
        })),
      };
      v4vRecipient = piFeed.value.destinations[0]?.address || null;
    }

    const episodes = await getEpisodesFromAPI(piFeed.id);
    if (!episodes || episodes.length === 0) {
      return NextResponse.json(
        { error: 'PI API returned zero episodes for this feed' },
        { status: 502 }
      );
    }

    const feed = await prisma.feed.create({
      data: {
        id: feedId,
        guid: piFeed.podcastGuid || null,
        originalUrl: feedUrl,
        cdnUrl: feedUrl,
        type,
        priority: 'normal',
        title: piFeed.title,
        description: piFeed.description || null,
        artist: piFeed.author || null,
        image: piFeed.artwork || piFeed.image || null,
        language: piFeed.language || null,
        category: piFeed.categories
          ? (Object.values(piFeed.categories)[0] as string)
          : null,
        explicit: piFeed.explicit === 1 || piFeed.explicit === true,
        ...(v4vValue && { v4vValue }),
        ...(v4vRecipient && { v4vRecipient }),
        lastFetched: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const tracksData = episodes.map((ep, index) => {
      let trackV4v: any = null;
      let trackV4vRecipient: string | null = null;
      if (ep.v4vValue?.destinations) {
        trackV4v = {
          type: ep.v4vValue.model?.type || 'lightning',
          method: ep.v4vValue.model?.method || 'keysend',
          suggested: ep.v4vValue.model?.suggested,
          recipients: ep.v4vValue.destinations.map((r: any) => ({
            name: r.name,
            type: r.type,
            address: r.address,
            split: r.split,
            customKey: r.customKey,
            customValue: r.customValue,
            fee: r.fee || false,
          })),
        };
        trackV4vRecipient = ep.v4vValue.destinations[0]?.address || null;
      }

      return {
        id: `${feed.id}-${ep.guid || `track-${index}-${Date.now()}`}`,
        feedId: feed.id,
        guid: ep.guid,
        title: ep.title,
        description: ep.description || null,
        audioUrl: ep.audioUrl,
        duration: parseDuration(ep.duration),
        image: ep.image || null,
        publishedAt: ep.pubDate ? new Date(ep.pubDate) : new Date(),
        trackOrder: ep.episode
          ? calculateTrackOrder(ep.episode, ep.season)
          : index + 1,
        ...(trackV4v && { v4vValue: trackV4v }),
        ...(trackV4vRecipient && { v4vRecipient: trackV4vRecipient }),
        updatedAt: new Date(),
      };
    });

    await prisma.track.createMany({
      data: tracksData,
      skipDuplicates: true,
    });

    const oldestPubDate = episodes
      .filter(e => e.pubDate)
      .map(e => new Date(e.pubDate))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (oldestPubDate) {
      await prisma.feed.update({
        where: { id: feed.id },
        data: { oldestItemPubdate: oldestPubDate },
      });
    }

    invalidateAlbumsFastCache();
    invalidateSearchCache();

    return NextResponse.json({
      success: true,
      feed: {
        id: feed.id,
        title: feed.title,
        type: feed.type,
        artist: feed.artist,
        guid: feed.guid,
        originalUrl: feed.originalUrl,
      },
      trackCount: episodes.length,
    });
  } catch (error) {
    console.error('Error importing feed from PI:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
