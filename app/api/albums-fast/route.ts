import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Track } from '@prisma/client';
import { getPlaylistUrls, getAllPlaylistIds } from '@/lib/playlist/configs';
import { getBlacklistedFeedIds, BLACKLISTED_FEED_URLS, isBowlAfterBowlPodcastEntry } from '@/lib/feed-exclusions';
import {
  CACHE_DURATION,
  PLAYLIST_CACHE_DURATION,
  getAlbumsFastCache,
  invalidateAlbumsFastCache,
  type FeedWithTracks,
} from '@/lib/caches/albums-fast-cache';

const cache = getAlbumsFastCache();

// publisher-stats.json is baked into the build (public/), so parse it once per
// process instead of hitting the filesystem on every DB-cache miss.
let publisherStatsCache: any[] | null = null;

function loadPublisherStats(): any[] {
  if (publisherStatsCache !== null) {
    return publisherStatsCache;
  }
  let stats: any[] = [];
  try {
    const fs = require('fs');
    const path = require('path');
    const publisherDataPath = path.join(process.cwd(), 'public', 'publisher-stats.json');

    if (fs.existsSync(publisherDataPath)) {
      const publisherData = JSON.parse(fs.readFileSync(publisherDataPath, 'utf8'));
      stats = publisherData.publishers || [];
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Loaded ${stats.length} publisher feeds from publisher-stats.json`);
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ No publisher-stats.json found, using empty publisher stats');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error loading publisher stats:', error);
    }
  }
  publisherStatsCache = stats;
  return stats;
}

// Function to get playlist albums
async function getPlaylistAlbums() {
  try {
    const now = Date.now();
    
    // Check if we have cached playlist data and it's still fresh
    if (cache.playlistData && (now - cache.playlistTimestamp) < PLAYLIST_CACHE_DURATION) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Using cached playlist data');
      }
      return cache.playlistData;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Fetching playlist data in parallel...');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const playlists = [
      'upbeats', 'b4ts', 'hgh', 'itdv', 'iam',
      'flowgnar', 'mmm', 'mmt', 'sas'
    ];

    // Fetch all playlists in parallel for better performance
    const results = await Promise.allSettled(
      playlists.map(async (playlist) => {
        const response = await fetch(`${baseUrl}/api/playlist/${playlist}`, {
          next: { revalidate: 300 } // Cache for 5 minutes
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ${playlist}`);
        }

        const data = await response.json();
        if (data.success && data.albums && data.albums.length > 0) {
          return data.albums[0];
        }
        return null;
      })
    );

    // Extract successful results
    const playlistAlbums = results
      .filter((result) => result.status === 'fulfilled' && result.value !== null)
      .map((result) => (result as PromiseFulfilledResult<any>).value);
    
    // Cache the results
    cache.playlistData = playlistAlbums;
    cache.playlistTimestamp = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Cached ${playlistAlbums.length} playlists for fast access`);
    }
    return playlistAlbums;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching playlist albums:', error);
    }
    return cache.playlistData || []; // Return cached data if available, empty array otherwise
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all'; // albums, eps, singles, all
    const sort = searchParams.get('sort') || 'default'; // Sort order: name-asc, added-desc, year-desc, etc.
    const forceRefresh = searchParams.get('refresh') === 'true'; // Force cache refresh

    // Clear cache if refresh requested
    if (forceRefresh) {
      invalidateAlbumsFastCache();
      console.log('🔄 Cache cleared due to refresh=true parameter');
    }

    // Redirect publisher filter requests to the publishers API
    if (filter === 'publishers') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚫 albums-fast: Rejecting ${filter} filter - should use /api/publishers instead`);
      }
      return NextResponse.json({
        albums: [],
        totalCount: 0,
        hasMore: false,
        offset: 0,
        limit: 0,
        publisherStats: [],
        lastUpdated: new Date().toISOString(),
        message: `Use /api/publishers for ${filter} data`
      });
    }
    
    const now = Date.now();
    const shouldRefreshCache = !cache.data || (now - cache.timestamp) > CACHE_DURATION;

    let feeds: FeedWithTracks[];
    let publisherStats: Array<{ name: string; albumCount: number }>;
    
    if (shouldRefreshCache) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Fetching albums from database...');
      }
      
      // Load all feeds to maintain global sort order
      // Pagination happens after sorting, not at the database level
      
      try {
        // Fetch feeds with minimal track data (optimized select)
        feeds = await prisma.feed.findMany({
          where: { status: 'active' },
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
            status: true,
            createdAt: true,
            updatedAt: true,
            oldestItemPubdate: true,
            v4vRecipient: true,
            v4vValue: true,
            persons: true,
            podcastImages: true,
            Track: {
              where: {
                audioUrl: { not: '' },
                status: 'active'
              },
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
                podcastImages: true,
              },
              orderBy: [
                { trackOrder: 'asc' },
                { publishedAt: 'asc' },
                { createdAt: 'asc' }
              ],
              take: 20 // Most albums have <20 tracks
            },
            _count: {
              select: { Track: { where: { status: 'active' } } }
            }
          },
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'desc' }
          ]
        }) as FeedWithTracks[];
      } catch (queryError) {
        console.error('❌ Database query error:', queryError);
        // Return cached data if available, or empty result
        if (cache.data && cache.data.feeds.length > 0) {
          console.log('⚠️ Using cached data due to query error');
          feeds = cache.data.feeds;
          publisherStats = cache.data.publisherStats;
        } else {
          throw new Error(`Failed to load feeds: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
        }
      }
      
      // Load publisher stats from the pre-built publisher data file
      // This contains actual publisher feeds (podcast:publisher references) not individual albums
      publisherStats = loadPublisherStats();
      
      // Cache the results only for 'all' filter with no pagination (first page)
      // This provides fast cache hits for common initial load
      const shouldCache = filter === 'all' && offset === 0 && limit >= 50;
      if (shouldCache) {
        cache.data = { feeds, publisherStats };
        cache.timestamp = now;
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Loaded and cached ${feeds.length} albums from database`);
        }
      } else {
        // Don't cache filtered or paginated results
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Loaded ${feeds.length} albums from database (${filter !== 'all' ? 'filtered' : 'paginated'}, not cached)`);
        }
      }
    } else {
      // Use cached data - no need for count query since cache has all feeds
      // Use cached data - cache contains all feeds, so we can slice after sorting
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚡ Using cached database results (${cache.data!.feeds.length} feeds)`);
      }
      feeds = cache.data!.feeds; // Cache contains all feeds, sorted correctly
      publisherStats = cache.data!.publisherStats;
    }
    
    // Transform feeds into album format for frontend.
    // API contract for sort/display: releaseDate = album release (oldest track date when available); dateAdded = when feed was added to site.
    // Run POST /api/admin/backfill-oldest-pubdate to backfill oldestItemPubdate so "Year" sort uses real release dates.
    const albums = feeds.map((feed: FeedWithTracks) => ({
      id: feed.id,
      title: feed.title,
      type: feed.type || 'album',
      artist: feed.artist || feed.title,
      description: feed.description || '',
      coverArt: feed.image || '',
      releaseDate: feed.oldestItemPubdate || feed.createdAt,
      dateAdded: feed.createdAt,
      feedUrl: feed.originalUrl, // For Helipad TLV
      feedGuid: feed.guid || null, // Real podcast:guid from RSS (for BoostBox feed_guid)
      feedId: feed.id, // Slug-based ID for URLs and Helipad TLV
      remoteFeedGuid: feed.guid || null, // Real podcast:guid (for BoostBox remote_feed_guid)
      guid: feed.Track?.[0]?.guid || feed.id, // Episode GUID for Helipad TLV
      episodeGuid: feed.Track?.[0]?.guid || feed.id, // Alternative field name
      link: feed.originalUrl, // For feedUrl fallback
      priority: feed.priority,
      tracks: feed.Track
        .filter((track: Track, index: number, self: Track[]) => {
          // Deduplicate tracks by URL and title
          return self.findIndex((t: Track) =>
            t.audioUrl === track.audioUrl && t.title === track.title
          ) === index;
        })
        .map((track: Track) => ({
          id: track.id,
          title: track.title,
          duration: track.duration || 180,
          url: track.audioUrl,
          image: track.image,
          publishedAt: track.publishedAt,
          guid: track.guid,
          // Include V4V fields for Lightning payments
          v4vRecipient: track.v4vRecipient,
          v4vValue: track.v4vValue,
          startTime: track.startTime,
          endTime: track.endTime,
          mediaType: track.mediaType || 'audio',
          alternateEnclosures: track.alternateEnclosures,
          chaptersUrl: (track as any).chaptersUrl || undefined,
          chapters: (track as any).chapters || undefined,
          valueTimeSplits: (track as any).valueTimeSplits || undefined,
          persons: (track as any).persons || undefined,
          podcastImages: (track as any).podcastImages || undefined,
        })),
      // Include V4V payment data from feed (preferred) or first track (fallback)
      v4vRecipient: feed.v4vRecipient || feed.Track?.[0]?.v4vRecipient || null,
      v4vValue: feed.v4vValue || feed.Track?.[0]?.v4vValue || null,
      persons: (feed as any).persons || undefined,
      podcastImages: (feed as any).podcastImages || undefined,
      // Actual track count from database (tracks array may be limited)
      trackCount: feed._count.Track
    }));
    
    // Filter out Bowl After Bowl podcast (mis-imported as type='album') but keep
    // Bowl Covers (legit music). Shared helper keeps /api/feeds/recent in sync.
    const podcastFilteredAlbums = albums.filter(album => {
      const isBab = isBowlAfterBowlPodcastEntry({
        id: album.id,
        title: album.title,
        artist: album.artist,
        feedUrl: album.feedUrl,
      });
      if (isBab && process.env.NODE_ENV === 'development') {
        console.log(`🚫 Filtering out Bowl After Bowl podcast: ${album.title} by ${album.artist}`);
      }
      return !isBab;
    });

    // Filter out unresolved feed GUID placeholders - these have no usable data
    const unresolvedFilteredAlbums = podcastFilteredAlbums.filter(album => {
      const albumTitle = album.title?.toLowerCase() || '';

      // Filter out unresolved feed GUID placeholders
      if (albumTitle.startsWith('unresolved-feed-guid-')) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🚫 Filtering out unresolved feed GUID: ${album.title}`);
        }
        return false;
      }

      return true;
    });

    // Music-show-only artist gate. The MSO flag means "don't show this
    // artist's albums in catalog views, but keep tracks reachable via
    // any curated music show that played them." Curated playlists pull
    // from SystemPlaylistTrack and don't go through albums-fast, so
    // hiding album feeds here doesn't break playlist playback. Match the
    // artist-key shape used by the publisher-album cron (artist || title,
    // case-insensitive trim) so orphan albums (publisherId=null) are
    // caught alongside linked ones. Query runs every request — small
    // enough (<100 publishers typically), and we need it to react to
    // PATCH flag flips without waiting on the 15-min feeds cache.
    const msoPublishers = await prisma.feed.findMany({
      where: { type: 'publisher', musicShowOnly: true },
      select: { artist: true, title: true },
    });
    const msoArtistKeys = new Set<string>();
    for (const p of msoPublishers) {
      const key = (p.artist || p.title || '').trim().toLowerCase();
      if (key) msoArtistKeys.add(key);
    }
    const msoFilteredAlbums = msoArtistKeys.size === 0
      ? unresolvedFilteredAlbums
      : unresolvedFilteredAlbums.filter(album => {
          const artistKey = (album.artist || '').trim().toLowerCase();
          return !msoArtistKeys.has(artistKey);
        });

    // Deduplicate albums with same title and artist (keep the one with more tracks or from preferred source)
    const deduplicatedAlbums = (() => {
      const seen = new Map<string, typeof msoFilteredAlbums[0]>();

      for (const album of msoFilteredAlbums) {
        // Create a key from normalized title + artist
        const key = `${album.title?.toLowerCase().trim()}|${album.artist?.toLowerCase().trim()}`;
        const existing = seen.get(key);

        if (!existing) {
          seen.set(key, album);
        } else {
          // Keep the one with more tracks, or prefer non-Wavlake (artist's own site) as tiebreaker
          const existingTrackCount = existing.tracks?.length || 0;
          const newTrackCount = album.tracks?.length || 0;
          const existingIsWavlake = existing.feedUrl?.includes('wavlake.com');
          const newIsWavlake = album.feedUrl?.includes('wavlake.com');

          // Prefer more tracks, then non-Wavlake (artist's own hosting) as tiebreaker
          const shouldReplace =
            newTrackCount > existingTrackCount ||
            (existingIsWavlake && !newIsWavlake && newTrackCount >= existingTrackCount);

          if (shouldReplace) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Dedup: Replacing "${existing.title}" (${existingTrackCount} tracks, wavlake: ${existingIsWavlake}) with (${newTrackCount} tracks, wavlake: ${newIsWavlake})`);
            }
            seen.set(key, album);
          } else if (process.env.NODE_ENV === 'development') {
            console.log(`🔄 Dedup: Keeping "${existing.title}" (${existingTrackCount} tracks), skipping duplicate (${newTrackCount} tracks)`);
          }
        }
      }

      return Array.from(seen.values());
    })();

    // Filter out playlist feeds, blacklisted feeds, and podcast feeds from album grid
    const playlistUrls = getPlaylistUrls();
    const playlistIds = getAllPlaylistIds();
    const blacklistedIds = getBlacklistedFeedIds();
    const nonPlaylistAlbums = deduplicatedAlbums.filter(album =>
      !playlistIds.includes(album.id) &&
      !blacklistedIds.includes(album.id) &&
      album.type !== 'podcast' &&
      (!album.feedUrl || !playlistUrls.includes(album.feedUrl)) &&
      (!album.feedUrl || !BLACKLISTED_FEED_URLS.includes(album.feedUrl))
    );

    // Apply filtering
    let filteredAlbums = nonPlaylistAlbums;
    if (filter !== 'all') {
      switch (filter) {
        case 'albums':
          filteredAlbums = deduplicatedAlbums.filter(album =>
            album.tracks && album.tracks.length >= 6
          );
          break;
        case 'eps':
          filteredAlbums = deduplicatedAlbums.filter(album =>
            album.tracks && album.tracks.length >= 2 && album.tracks.length <= 5
          );
          break;
        case 'singles':
          filteredAlbums = deduplicatedAlbums.filter(album =>
            album.tracks && album.tracks.length === 1
          );
          break;
        case 'playlist':
          // Start with empty array for playlist filter - playlists will be added after this
          filteredAlbums = [];
          break;
        case 'podcasts': {
          // Show all podcast-type feeds (type='podcast' in DB)
          const podcastFeeds = await prisma.feed.findMany({
            where: {
              status: 'active',
              type: 'podcast',
            },
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
              status: true,
              createdAt: true,
              updatedAt: true,
              oldestItemPubdate: true,
              v4vRecipient: true,
              v4vValue: true,
              persons: true,
              podcastImages: true,
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
                  podcastImages: true,
                },
                orderBy: [
                  { trackOrder: 'asc' },
                  { publishedAt: 'asc' },
                  { createdAt: 'asc' }
                ]
              },
              _count: { select: { Track: { where: { status: 'active' } } } }
            }
          });
          filteredAlbums = podcastFeeds.map((feed: any) => {
            // Sort podcast episodes newest-first
            const sortedTracks = [...(feed.Track || [])].sort((a: any, b: any) => {
              const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
              const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
              return dateB - dateA;
            });
            return {
            id: feed.id,
            title: feed.title,
            type: feed.type || 'podcast',
            isPodcast: true,
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
            tracks: sortedTracks.map((track: any) => ({
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
              persons: (track as any).persons || undefined,
              podcastImages: (track as any).podcastImages || undefined,
            })),
            totalTracks: feed._count?.Track || feed.Track?.length || 0,
            trackCount: feed._count?.Track || feed.Track?.length || 0,
            v4vRecipient: feed.v4vRecipient,
            v4vValue: feed.v4vValue,
            persons: (feed as any).persons || undefined,
            podcastImages: (feed as any).podcastImages || undefined,
          };
          });
          break;
        }
        case 'videos':
          // Filter albums that have at least one video track (either mediaType is video or has video in alternateEnclosures)
          filteredAlbums = deduplicatedAlbums.filter(album =>
            album.tracks && album.tracks.some((track: any) =>
              track.mediaType === 'video' ||
              (track.alternateEnclosures && track.alternateEnclosures.some((enc: any) =>
                enc.type?.includes('video')
              ))
            )
          );
          break;
      }
    }
    
    // Sort albums based on requested sort order
    switch (sort) {
      case 'added-desc':
        filteredAlbums.sort((a, b) => new Date(b.dateAdded || b.releaseDate || 0).getTime() - new Date(a.dateAdded || a.releaseDate || 0).getTime());
        break;
      case 'added-asc':
        filteredAlbums.sort((a, b) => new Date(a.dateAdded || a.releaseDate || 0).getTime() - new Date(b.dateAdded || b.releaseDate || 0).getTime());
        break;
      case 'year-desc':
        filteredAlbums.sort((a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime());
        break;
      case 'year-asc':
        filteredAlbums.sort((a, b) => new Date(a.releaseDate || 0).getTime() - new Date(b.releaseDate || 0).getTime());
        break;
      case 'name-desc':
        filteredAlbums.sort((a, b) => b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
        break;
      case 'name-asc':
        filteredAlbums.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        break;
      case 'tracks-desc':
        filteredAlbums.sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));
        break;
      case 'tracks-asc':
        filteredAlbums.sort((a, b) => (a.trackCount || 0) - (b.trackCount || 0));
        break;
      default: {
        // Default: format (Albums → EPs → Singles) then alphabetically by title
        // Build a Map for O(1) feed lookups instead of O(n) .find() per album
        const feedMap = new Map(feeds.map(f => [f.id, f]));

        const getFormatOrder = (trackCount: number) => {
          if (trackCount >= 6) return 1; // Albums first
          if (trackCount >= 2) return 2; // EPs second
          return 3; // Singles last
        };

        filteredAlbums.sort((a, b) => {
          const aCount = feedMap.get(a.id)?._count?.Track || 0;
          const bCount = feedMap.get(b.id)?._count?.Track || 0;

          const aFormatOrder = getFormatOrder(aCount);
          const bFormatOrder = getFormatOrder(bCount);

          if (aFormatOrder !== bFormatOrder) {
            return aFormatOrder - bFormatOrder;
          }

          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        break;
      }
    }
    
    // Add playlist albums only when specifically requesting playlists
    if (filter === 'playlist') {
      const playlistAlbums = await getPlaylistAlbums();
      if (playlistAlbums.length > 0) {
        filteredAlbums.push(...playlistAlbums);
      }
    }
    
    // Get accurate total count of filtered results
    // Since we always load all feeds, filteredAlbums.length is the accurate total count
    let totalCount = filteredAlbums.length;

    // Calculate format counts for "all" filter (helps frontend with format-aware pagination)
    let formatCounts = { albums: 0, eps: 0, singles: 0 };
    if (filter === 'all') {
      filteredAlbums.forEach(album => {
        const trackCount = album.trackCount || album.tracks?.length || 0;
        if (trackCount >= 6) formatCounts.albums++;
        else if (trackCount >= 2) formatCounts.eps++;
        else formatCounts.singles++;
      });
    }

    // Apply final pagination to filtered results
    const paginatedAlbums = filteredAlbums.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      albums: paginatedAlbums,
      totalCount, // Total count of filtered results (for pagination)
      publisherStats,
      metadata: {
        returnedAlbums: paginatedAlbums.length,
        totalAlbums: totalCount,
        offset,
        limit,
        filter,
        sort,
        cached: !shouldRefreshCache,
        cacheAge: now - cache.timestamp,
        source: 'database',
        formatCounts: filter === 'all' ? formatCounts : undefined
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'CDN-Cache-Control': 'public, s-maxage=60',
      }
    });
    
  } catch (error) {
    // Always log errors, even in production
    console.error('❌ Albums Fast API Error:', error);
    return NextResponse.json({
      error: 'Failed to load albums',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}