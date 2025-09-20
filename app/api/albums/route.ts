import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAlbumSlug } from '@/lib/url-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tier = searchParams.get('tier') || 'all';
    const feedId = searchParams.get('feedId');
    const filter = searchParams.get('filter') || 'all'; // albums, eps, singles, all, playlist
    
    console.log(`🎵 Albums API request: limit=${limit}, offset=${offset}, tier=${tier}, feedId=${feedId}, filter=${filter}`);
    
    // Build where clause for feeds
    const feedWhere: any = { status: 'active' };
    
    // Apply tier filtering if specified
    if (tier !== 'all') {
      const tierPriorityMap: Record<string, string[]> = {
        'core': ['core'],
        'high': ['core', 'high'],
        'extended': ['core', 'high', 'normal'],
        'lowPriority': ['low']
      };
      
      if (tierPriorityMap[tier]) {
        feedWhere.priority = { in: tierPriorityMap[tier] };
      }
    }
    
    // Apply feed ID filtering if specified
    if (feedId) {
      feedWhere.id = feedId;
    }
    
    // OPTIMIZED: Single query with include for better performance
    const feeds = await prisma.feed.findMany({
      where: feedWhere,
      include: {
        tracks: {
          where: {
            audioUrl: { not: '' }
          },
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' }
          ],
          take: 50 // Limit tracks per feed for performance
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 200 // Increased limit to ensure all albums are available
    });
    
    // Extract tracks from the included data
    const tracks = feeds.flatMap(feed => feed.tracks);
    
    console.log(`📊 Loaded ${feeds.length} feeds from database`);
    
    // Group tracks by feed
    const tracksByFeed = tracks.reduce((acc, track) => {
      if (!acc[track.feedId]) {
        acc[track.feedId] = [];
      }
      acc[track.feedId].push(track);
      return acc;
    }, {} as Record<string, any[]>);
    
    // Transform feeds into album format
    let albums = feeds.map(feed => {
      const feedTracks = tracksByFeed[feed.id] || [];
      
      // Group tracks by album or treat each feed as an album
      const albumMap = new Map<string, any>();
      
      if (feed.type === 'album' || feedTracks.length <= 10) {
        // Treat entire feed as single album
        const albumKey = feed.title;
        albumMap.set(albumKey, {
          title: feed.title,
          artist: feed.artist || 'Unknown Artist',
          description: feed.description || '',
          image: feed.image || '',
          tracks: feedTracks,
          feed: feed
        });
      } else {
        // Group tracks by album field or artist
        feedTracks.forEach(track => {
          const albumKey = track.album || track.artist || feed.title;
          
          if (!albumMap.has(albumKey)) {
            albumMap.set(albumKey, {
              title: track.album || feed.title,
              artist: track.artist || feed.artist || 'Unknown Artist',
              description: track.description || feed.description || '',
              image: track.image || feed.image || '',
              tracks: [],
              feed: feed
            });
          }
          
          albumMap.get(albumKey).tracks.push(track);
        });
      }
      
      return Array.from(albumMap.values());
    }).flat();
    
    // Transform to consistent album format
    const transformedAlbums = albums.map((album: any) => {
      const feed = album.feed;
      const tracks = album.tracks.map((track: any, index: number) => ({
        title: track.title,
        duration: track.duration ? 
          Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : 
          track.itunesDuration || '0:00',
        url: track.audioUrl,
        trackNumber: index + 1,
        subtitle: track.subtitle || '',
        summary: track.description || '',
        image: track.image || album.image,
        explicit: track.explicit || false,
        keywords: track.itunesKeywords || []
      }));
      
      // Determine if this is a playlist based on track variety
      const isPlaylist = tracks.length > 1 && 
        new Set(tracks.map((t: any) => t.artist || album.artist)).size > 1;
      
      // Create publisher info for artist feeds
      let publisher = null;
      if (feed.type === 'album' && feed.artist) {
        // For artist feeds, create publisher info
        publisher = {
          feedGuid: feed.id,
          feedUrl: feed.originalUrl,
          title: feed.artist,
          artistImage: feed.image
        };
      }
      
      return {
        id: generateAlbumSlug(album.title) + '-' + feed.id.split('-')[0],
        title: album.title,
        artist: album.artist,
        description: album.description,
        coverArt: album.image || `/api/placeholder-image?title=${encodeURIComponent(album.title)}&artist=${encodeURIComponent(album.artist)}`,
        tracks: tracks,
        releaseDate: feed.lastFetched || feed.createdAt,
        podroll: isPlaylist ? { enabled: true } : null,
        publisher: publisher,
        funding: null, // Can be enhanced with V4V data from tracks
        feedId: feed.id,
        feedUrl: feed.originalUrl,
        lastUpdated: feed.updatedAt,
        explicit: tracks.some((t: any) => t.explicit) || feed.explicit
      };
    });
    
    // Apply filtering by type
    let filteredAlbums = transformedAlbums;
    if (filter !== 'all') {
      switch (filter) {
        case 'albums':
          filteredAlbums = transformedAlbums.filter(album => album.tracks.length > 6);
          break;
        case 'eps':
          filteredAlbums = transformedAlbums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6);
          break;
        case 'singles':
          filteredAlbums = transformedAlbums.filter(album => album.tracks.length === 1);
          break;
        case 'playlist':
          filteredAlbums = transformedAlbums.filter(album => album.podroll !== null);
          break;
        default:
          filteredAlbums = transformedAlbums;
      }
    }
    
    // Sort albums: Albums first (7+ tracks), then EPs (2-6 tracks), then Singles (1 track)
    const sortedAlbums = [
      ...filteredAlbums.filter(album => album.tracks.length > 6)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
      ...filteredAlbums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
      ...filteredAlbums.filter(album => album.tracks.length === 1)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
    ];
    
    const totalCount = sortedAlbums.length;
    
    // Apply pagination
    const paginatedAlbums = limit === 0 ? 
      sortedAlbums.slice(offset) : 
      sortedAlbums.slice(offset, offset + limit);
    
    // Pre-compute publisher statistics for the sidebar
    const publisherStats = new Map<string, { name: string; feedGuid: string; albumCount: number }>();
    
    sortedAlbums
      .filter(album => album.publisher && album.publisher.feedGuid)
      .forEach(album => {
        const key = album.publisher!.feedGuid;
        if (!publisherStats.has(key)) {
          publisherStats.set(key, {
            name: album.artist,
            feedGuid: album.publisher!.feedGuid,
            albumCount: 1
          });
        } else {
          publisherStats.get(key)!.albumCount++;
        }
      });

    const publisherStatsArray = Array.from(publisherStats.values()).sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    console.log(`✅ Database Albums API: Returning ${paginatedAlbums.length}/${totalCount} albums with ${publisherStatsArray.length} publisher feeds`);
    
    return NextResponse.json({
      albums: paginatedAlbums,
      totalCount,
      hasMore: limit === 0 ? false : offset + limit < totalCount,
      offset,
      limit,
      publisherStats: publisherStatsArray,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'ETag': `"db-${totalCount}-${offset}-${limit}"`
      }
    });

  } catch (error) {
    console.error('Error in database albums API:', error);
    return NextResponse.json({ 
      albums: [], 
      totalCount: 0, 
      lastUpdated: new Date().toISOString(),
      error: 'Database error' 
    }, { status: 500 });
  }
}