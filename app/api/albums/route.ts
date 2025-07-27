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

    const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
    
    // Extract albums from parsed feeds
    const albums = parsedData.feeds
      .filter((feed: any) => feed.parseStatus === 'success' && feed.parsedData?.album)
      .map((feed: any) => {
        const album = feed.parsedData.album;
        return {
          id: generateAlbumSlug(album.title),
          title: album.title,
          artist: album.artist,
          description: album.description,
          coverArt: album.coverArt,
          tracks: album.tracks.map((track: any) => ({
            title: track.title,
            duration: track.duration,
            url: track.url,
            trackNumber: track.trackNumber,
            subtitle: track.subtitle,
            summary: track.summary,
            image: track.image,
            explicit: track.explicit,
            keywords: track.keywords
          })),
          podroll: album.podroll,
          publisher: album.publisher,
          funding: album.funding,
          feedId: feed.id,
          feedUrl: feed.originalUrl,
          lastUpdated: feed.lastParsed
        };
      });

    return NextResponse.json({
      albums,
      totalCount: albums.length,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Disable caching
        'Pragma': 'no-cache',
        'Expires': '0'
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