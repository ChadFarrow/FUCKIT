import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAlbumSlug } from '@/lib/url-utils';

// Cache the parsed data to avoid reading the file on every request
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tier = searchParams.get('tier') || 'all';
    const feedId = searchParams.get('feedId');
    
    // Use cached data if available and fresh
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Using cached parsed feeds data');
    } else {
      const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
      
      if (!fs.existsSync(parsedFeedsPath)) {
        console.warn('Parsed feeds data not found at:', parsedFeedsPath);
        return NextResponse.json({ 
          albums: [], 
          totalCount: 0, 
          lastUpdated: new Date().toISOString(),
          error: 'Parsed feeds data not found' 
        }, { status: 404 });
      }

      const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
      
      // Validate JSON before parsing
      try {
        cachedData = JSON.parse(fileContent);
        cacheTimestamp = now;
        console.log('Refreshed cached parsed feeds data');
      } catch (parseError) {
        console.error('Failed to parse parsed-feeds.json:', parseError);
        return NextResponse.json({ 
          albums: [], 
          totalCount: 0, 
          lastUpdated: new Date().toISOString(),
          error: 'Invalid JSON in parsed feeds data' 
        }, { status: 500 });
      }
    }
    
    let parsedData = cachedData;
    
    // Validate data structure
    if (!parsedData || !Array.isArray(parsedData.feeds)) {
      console.warn('Invalid parsed feeds data structure:', parsedData);
      return NextResponse.json({ 
        albums: [], 
        totalCount: 0, 
        lastUpdated: new Date().toISOString(),
        error: 'Invalid data structure' 
      }, { status: 500 });
    }
    
    // Extract albums from parsed feeds with proper type checking
    let albums = parsedData.feeds
      .filter((feed: any) => feed.parseStatus === 'success' && feed.parsedData?.album)
      .map((feed: any) => {
        const album = feed.parsedData.album;
        
        // Ensure all string fields are properly typed
        const title = typeof album.title === 'string' ? album.title : '';
        const artist = typeof album.artist === 'string' ? album.artist : '';
        const description = typeof album.description === 'string' ? album.description : '';
        const coverArt = typeof album.coverArt === 'string' ? album.coverArt : '';
        
        return {
          id: generateAlbumSlug(title),
          title,
          artist,
          description,
          coverArt,
          tracks: (album.tracks || []).map((track: any) => ({
            title: typeof track.title === 'string' ? track.title : '',
            duration: typeof track.duration === 'string' ? track.duration : '0:00',
            url: typeof track.url === 'string' ? track.url : '',
            trackNumber: typeof track.trackNumber === 'number' ? track.trackNumber : 0,
            subtitle: typeof track.subtitle === 'string' ? track.subtitle : '',
            summary: typeof track.summary === 'string' ? track.summary : '',
            image: typeof track.image === 'string' ? track.image : '',
            explicit: typeof track.explicit === 'boolean' ? track.explicit : false,
            keywords: Array.isArray(track.keywords) ? track.keywords.filter((k: any) => typeof k === 'string') : []
          })),
          podroll: album.podroll || null,
          publisher: album.publisher || null,
          funding: album.funding || null,
          feedId: typeof feed.id === 'string' ? feed.id : '',
          feedUrl: typeof feed.originalUrl === 'string' ? feed.originalUrl : '',
          lastUpdated: typeof feed.lastParsed === 'string' ? feed.lastParsed : new Date().toISOString()
        };
      });

    // Apply filtering by tier if specified
    if (tier !== 'all') {
      try {
        const feedsResponse = await fetch(`${request.headers.get('origin') || 'http://localhost:3000'}/api/feeds`);
        if (feedsResponse.ok) {
          const feedsConfig = await feedsResponse.json();
          const tierFeedIds = new Set(
            feedsConfig[tier]?.map((feed: any) => feed.id) || []
          );
          albums = albums.filter((album: any) => tierFeedIds.has(album.feedId));
        }
      } catch (error) {
        console.warn('Failed to load feeds configuration for tier filtering:', error);
      }
    }

    // Apply feed ID filtering if specified
    if (feedId) {
      albums = albums.filter((album: any) => album.feedId === feedId);
    }

    // Deduplicate albums
    const albumMap = new Map<string, any>();
    albums.forEach((album: any) => {
      const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
      if (!albumMap.has(key)) {
        albumMap.set(key, album);
      }
    });
    
    const uniqueAlbums = Array.from(albumMap.values());
    const totalCount = uniqueAlbums.length;

    // Apply pagination (limit=0 means return all)
    const paginatedAlbums = limit === 0 ? uniqueAlbums.slice(offset) : uniqueAlbums.slice(offset, offset + limit);

    console.log(`✅ Albums API: Returning ${paginatedAlbums.length}/${totalCount} albums (tier: ${tier}, offset: ${offset}, limit: ${limit})`);
    
    return NextResponse.json({
      albums: paginatedAlbums,
      totalCount,
      hasMore: limit === 0 ? false : offset + limit < totalCount,
      offset,
      limit,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=180, s-maxage=180, stale-while-revalidate=300', // Faster cache with stale-while-revalidate
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'ETag': `"${cacheTimestamp}-${totalCount}"` // Add ETag for better caching
      }
    });

  } catch (error) {
    console.error('Error in albums API:', error);
    return NextResponse.json({ 
      albums: [], 
      totalCount: 0, 
      lastUpdated: new Date().toISOString(),
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 