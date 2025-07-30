import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAlbumSlug } from '@/lib/url-utils';

export async function GET() {
  try {
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      return NextResponse.json({ error: 'Parsed feeds data not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    
    // Extract albums from parsed feeds with proper type checking
    const albums = parsedData.feeds
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

    return NextResponse.json({
      albums,
      totalCount: albums.length,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300', // Cache for 5 minutes
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      },
    });
  } catch (error) {
    console.error('Error loading parsed albums:', error);
    return NextResponse.json(
      { error: 'Failed to load album data' },
      { status: 500 }
    );
  }
} 