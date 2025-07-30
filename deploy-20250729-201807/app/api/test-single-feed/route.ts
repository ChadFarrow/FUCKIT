import { NextRequest, NextResponse } from 'next/server';
import { RSSParser } from '@/lib/rss-parser';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing single feed parsing...');
    
    const result = await RSSParser.parseAlbumFeed('https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml');
    
    console.log('📦 Parse result:', result ? 'SUCCESS' : 'NULL');
    
    if (result) {
      return NextResponse.json({
        message: 'Single feed parsed successfully',
        album: {
          title: result.title,
          artist: result.artist,
          trackCount: result.tracks.length,
          firstTrack: result.tracks[0]?.title
        }
      });
    } else {
      return NextResponse.json({
        message: 'Single feed returned null',
        error: 'No album data parsed'
      });
    }
  } catch (error) {
    console.error('❌ Single feed test error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse single feed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 