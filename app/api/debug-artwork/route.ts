import { NextRequest, NextResponse } from 'next/server';
import { RSSParser } from '@/lib/rss-parser';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    console.log(`🔍 Debugging artwork extraction for: ${url}`);
    
    const album = await RSSParser.parseAlbumFeed(url);
    
    if (!album) {
      return NextResponse.json({ error: 'Failed to parse RSS feed' }, { status: 500 });
    }

    return NextResponse.json({
      title: album.title,
      artist: album.artist,
      coverArt: album.coverArt,
      hasCoverArt: !!album.coverArt,
      trackCount: album.tracks.length,
      firstTrackTitle: album.tracks[0]?.title || 'No tracks',
      firstTrackImage: album.tracks[0]?.image || 'No track image'
    });

  } catch (error) {
    console.error('Error debugging artwork:', error);
    return NextResponse.json({ 
      error: 'Failed to debug artwork',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 