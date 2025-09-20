import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// In-memory cache for better performance
let cachedAlbums: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function shouldForceRefresh(cachePath: string): boolean {
  try {
    const fileModified = fs.statSync(cachePath).mtime.getTime();
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
          filteredAlbums = cachedAlbums.albums.filter((album: any) => 
            album.tracks && album.tracks.length >= 8
          );
          break;
        case 'eps':
          filteredAlbums = cachedAlbums.albums.filter((album: any) => 
            album.tracks && album.tracks.length >= 3 && album.tracks.length < 8
          );
          break;
        case 'singles':
          filteredAlbums = cachedAlbums.albums.filter((album: any) => 
            album.tracks && album.tracks.length < 3
          );
          break;
      }
    }
    
    // Apply pagination
    const totalCount = filteredAlbums.length;
    const paginatedAlbums = filteredAlbums.slice(offset, offset + limit);
    
    // Calculate publisher stats
    const publisherStats = cachedAlbums.publisherStats || [];
    
    return NextResponse.json({
      success: true,
      albums: paginatedAlbums,
      totalCount,
      publisherStats,
      metadata: {
        returnedAlbums: paginatedAlbums.length,
        totalAlbums: totalCount,
        offset,
        limit,
        filter,
        cached: true,
        cacheAge: now - cacheTimestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Albums Fast API Error:', error);
    return NextResponse.json({
      error: 'Failed to load albums',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}