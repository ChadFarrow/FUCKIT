import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAlbumSlug } from '@/lib/url-utils';

export async function GET() {
  try {
    console.log('🔍 Database Publishers API: Getting all publishers from database');
    
    // Get all feeds from database that have tracks and could be publishers
    const feeds = await prisma.feed.findMany({
      where: { 
        status: 'active',
        OR: [
          { type: 'publisher' },
          { type: 'album', artist: { not: null } }
        ]
      },
      include: {
        tracks: {
          where: {
            audioUrl: { not: '' }
          },
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' }
          ]
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log(`📊 Loaded ${feeds.length} feeds from database for publishers API`);
    
    // Group feeds by artist/publisher to create publisher data
    const publishersMap = new Map<string, any>();
    
    feeds.forEach(feed => {
      // Skip feeds without tracks
      if (feed.tracks.length === 0) return;
      
      // Determine publisher identity - use artist for album feeds, title for publisher feeds
      const publisherName = feed.artist || feed.title;
      const publisherKey = generateAlbumSlug(publisherName);
      
      if (!publishersMap.has(publisherKey)) {
        publishersMap.set(publisherKey, {
          id: publisherKey,
          title: publisherName,
          feedGuid: feed.type === 'publisher' ? feed.id : publisherKey,
          originalUrl: feed.originalUrl,
          image: feed.image,
          description: feed.description,
          albums: [],
          itemCount: 0,
          totalTracks: 0
        });
      }
      
      const publisher = publishersMap.get(publisherKey);
      
      // For publisher feeds, tracks might represent different albums
      if (feed.type === 'publisher') {
        // Group tracks by album if available, otherwise treat as one album
        const albumMap = new Map<string, any>();
        
        feed.tracks.forEach(track => {
          const albumKey = track.album || track.title || feed.title;
          if (!albumMap.has(albumKey)) {
            albumMap.set(albumKey, {
              title: track.album || track.title || feed.title,
              artist: track.artist || feed.artist || publisherName,
              trackCount: 0,
              feedGuid: feed.id,
              feedUrl: feed.originalUrl,
              albumSlug: generateAlbumSlug(albumKey) + '-' + feed.id.split('-')[0],
              image: track.image || feed.image,
              explicit: track.explicit || false
            });
          }
          albumMap.get(albumKey)!.trackCount++;
        });
        
        // Add all albums from this publisher feed
        Array.from(albumMap.values()).forEach(album => {
          publisher.albums.push(album);
          publisher.totalTracks += album.trackCount;
        });
      } else {
        // For album feeds, the entire feed is one album
        const albumSlug = generateAlbumSlug(feed.title) + '-' + feed.id.split('-')[0];
        publisher.albums.push({
          title: feed.title,
          artist: feed.artist || publisherName,
          trackCount: feed.tracks.length,
          feedGuid: feed.id,
          feedUrl: feed.originalUrl,
          albumSlug: albumSlug,
          image: feed.image,
          explicit: feed.tracks.some(t => t.explicit) || feed.explicit
        });
        publisher.totalTracks += feed.tracks.length;
      }
      
      publisher.itemCount = publisher.albums.length;
    });
    
    const publishers = Array.from(publishersMap.values()).sort((a, b) => 
      a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    );

    console.log(`✅ Database Publishers API: Returning ${publishers.length} publishers with ${publishers.reduce((sum, p) => sum + p.itemCount, 0)} total albums`);

    const response = {
      publishers,
      total: publishers.length,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      },
    });
  } catch (error) {
    console.error('Unexpected error in database publishers API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 