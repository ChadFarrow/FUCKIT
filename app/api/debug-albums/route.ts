import { NextRequest, NextResponse } from 'next/server';
import { RSSParser } from '@/lib/rss-parser';

export async function GET(request: NextRequest) {
  try {
    // Test with a few main feeds
    const testFeeds = [
      'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
      'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    ];
    
    const proxiedFeedUrls = testFeeds.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
    const albums = await RSSParser.parseMultipleFeeds(proxiedFeedUrls);
    
    return NextResponse.json({
      message: 'Debug albums parsed',
      count: albums.length,
      albums: albums.map(album => ({
        title: album.title,
        artist: album.artist,
        trackCount: album.tracks.length,
        coverArt: album.coverArt ? 'Yes' : 'No'
      }))
    });
  } catch (error) {
    console.error('Debug albums error:', error);
    return NextResponse.json({ error: 'Failed to parse albums' }, { status: 500 });
  }
} 