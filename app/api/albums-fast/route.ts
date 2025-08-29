import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Fast albums API using pre-computed cache
let cachedAlbums: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Force cache refresh if cache file is newer than our cached data
function shouldForceRefresh(cachePath: string): boolean {
  try {
    const stats = fs.statSync(cachePath);
    const fileModified = stats.mtime.getTime();
    return fileModified > cacheTimestamp;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all'; // albums, eps, singles, all
    
    const now = Date.now();
    const apiCachePath = path.join(process.cwd(), 'data', 'albums-api-cache.json');
    const shouldRefreshCache = !cachedAlbums || 
                              (now - cacheTimestamp) > CACHE_DURATION ||
                              shouldForceRefresh(apiCachePath);
    
    if (shouldRefreshCache) {
      console.log('🚀 Loading optimized album cache...');
      
      if (!fs.existsSync(apiCachePath)) {
        console.error('❌ Optimized cache not found. Please run: node scripts/create-optimized-cache.js');
        return NextResponse.json({
          error: 'Optimized cache not available',
          message: 'Please regenerate the album cache'
        }, { status: 500 });
      }
      
      const cacheContent = fs.readFileSync(apiCachePath, 'utf8');
      cachedAlbums = JSON.parse(cacheContent);
      cacheTimestamp = now;
      
      console.log(`✅ Loaded ${cachedAlbums.albums.length} albums from optimized cache`);
    } else {
      console.log(`⚡ Using cached albums (${cachedAlbums.albums.length} albums)`);
    }
    
    // Apply filtering
    let filteredAlbums = cachedAlbums.albums;
    if (filter !== 'all') {
      switch (filter) {
        case 'albums':
          filteredAlbums = cachedAlbums.albums.filter((album: any) => album.trackCount > 6);
          break;
        case 'eps':
          filteredAlbums = cachedAlbums.albums.filter((album: any) => album.trackCount > 1 && album.trackCount <= 6);
          break;
        case 'singles':
          filteredAlbums = cachedAlbums.albums.filter((album: any) => album.trackCount === 1);
          break;
        case 'playlist':
          // For now, treat as all albums since we don't have podroll data in the cache
          filteredAlbums = cachedAlbums.albums.filter((album: any) => album.trackCount > 1);
          break;
        default:
          filteredAlbums = cachedAlbums.albums;
      }
    }
    
    const totalCount = filteredAlbums.length;
    
    // Apply pagination
    const paginatedAlbums = limit === 0 
      ? filteredAlbums.slice(offset) 
      : filteredAlbums.slice(offset, offset + limit);
    
    // Convert to expected format
    const responseAlbums = paginatedAlbums.map((album: any) => ({
      id: album.id,
      title: album.title,
      artist: album.artist,
      description: album.description,
      coverArt: album.coverArt,
      releaseDate: album.releaseDate,
      tracks: album.tracks,
      publisher: null, // Not included in fast cache for performance
      podroll: null,
      funding: null,
      feedId: album.feedId,
      feedUrl: album.feedUrl,
      lastUpdated: album.lastUpdated
    }));
    
    console.log(`✅ Fast Albums API: Returning ${paginatedAlbums.length}/${totalCount} albums (filter: ${filter}, offset: ${offset}, limit: ${limit})`);
    
    return NextResponse.json({
      albums: responseAlbums,
      totalCount,
      hasMore: limit === 0 ? false : offset + limit < totalCount,
      offset,
      limit,
      publisherStats: [], // Empty for performance
      lastUpdated: cachedAlbums.lastUpdated,
      source: 'optimized-cache'
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
        'Content-Type': 'application/json',
        'X-Cache-Source': 'optimized-albums-cache',
        'ETag': `"${cacheTimestamp}-${totalCount}"`
      }
    });

  } catch (error) {
    console.error('Error in fast albums API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      albums: [], 
      totalCount: 0 
    }, { status: 500 });
  }
}