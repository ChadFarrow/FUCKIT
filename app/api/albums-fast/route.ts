import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// In-memory cache for better performance (cache the database results, not files)
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for database results

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all'; // albums, eps, singles, all
    
    const now = Date.now();
    const shouldRefreshCache = !cachedData || (now - cacheTimestamp) > CACHE_DURATION;
    
    let feeds;
    let publisherStats;
    
    if (shouldRefreshCache) {
      console.log('🔄 Fetching albums from database...');
      
      // Get all active feeds with their tracks directly from database
      feeds = await prisma.feed.findMany({
        where: { status: 'active' },
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
          },
          _count: {
            select: { tracks: true }
          }
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' }
        ]
      });
      
      // Calculate publisher stats
      const publisherMap = new Map();
      feeds.forEach(feed => {
        const artist = feed.artist || feed.title;
        if (!publisherMap.has(artist)) {
          publisherMap.set(artist, 0);
        }
        publisherMap.set(artist, publisherMap.get(artist) + 1);
      });
      
      publisherStats = Array.from(publisherMap.entries())
        .map(([name, count]) => ({ name, albumCount: count }))
        .sort((a, b) => b.albumCount - a.albumCount);
      
      // Cache the results
      cachedData = { feeds, publisherStats };
      cacheTimestamp = now;
      
      console.log(`✅ Loaded ${feeds.length} albums from database`);
    } else {
      console.log(`⚡ Using cached database results (${cachedData.feeds.length} albums)`);
      feeds = cachedData.feeds;
      publisherStats = cachedData.publisherStats;
    }
    
    // Transform feeds into album format for frontend
    const albums = feeds.map(feed => ({
      id: feed.id,
      title: feed.title,
      artist: feed.artist || feed.title,
      description: feed.description || '',
      coverArt: feed.image || '',
      releaseDate: feed.updatedAt || feed.createdAt,
      feedUrl: feed.originalUrl,
      feedGuid: feed.id,
      priority: feed.priority,
      tracks: feed.tracks.map(track => ({
        id: track.id,
        title: track.title,
        duration: track.duration || 180,
        url: track.audioUrl,
        publishedAt: track.publishedAt,
        guid: track.guid
      }))
    }));
    
    // Apply filtering
    let filteredAlbums = albums;
    if (filter !== 'all') {
      switch (filter) {
        case 'albums':
          filteredAlbums = albums.filter(album => 
            album.tracks && album.tracks.length >= 8
          );
          break;
        case 'eps':
          filteredAlbums = albums.filter(album => 
            album.tracks && album.tracks.length >= 3 && album.tracks.length < 8
          );
          break;
        case 'singles':
          filteredAlbums = albums.filter(album => 
            album.tracks && album.tracks.length < 3
          );
          break;
      }
    }
    
    // Sort albums by priority and release date
    filteredAlbums.sort((a, b) => {
      const priorityOrder: Record<string, number> = { 
        'core': 1, 
        'high': 2, 
        'normal': 3, 
        'low': 4 
      };
      const aPriority = priorityOrder[a.priority] || 5;
      const bPriority = priorityOrder[b.priority] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
    });
    
    // Apply pagination
    const totalCount = filteredAlbums.length;
    const paginatedAlbums = filteredAlbums.slice(offset, offset + limit);
    
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
        cached: !shouldRefreshCache,
        cacheAge: now - cacheTimestamp,
        source: 'database'
      }
    });
    
  } catch (error) {
    console.error('❌ Albums Fast API Error:', error);
    return NextResponse.json({
      error: 'Failed to load albums',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}