import { NextRequest, NextResponse } from 'next/server';
import { MusicTrackParser } from '@/lib/music-track-parser';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('feedUrl');
    
    if (!feedUrl) {
      return NextResponse.json(
        { error: 'feedUrl parameter is required' },
        { status: 400 }
      );
    }
    
    // Validate URL
    try {
      new URL(feedUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid feed URL provided' },
        { status: 400 }
      );
    }
    
    console.log(`🎵 Extracting music tracks from: ${feedUrl}`);
    
    // Extract music tracks from the feed
    const result = await MusicTrackParser.extractMusicTracks(feedUrl);
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully extracted ${result.tracks.length} music tracks and found ${result.relatedFeeds.length} related feeds`
    });
    
  } catch (error) {
    console.error('Music track extraction failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract music tracks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedUrls } = body;
    
    if (!feedUrls || !Array.isArray(feedUrls)) {
      return NextResponse.json(
        { error: 'feedUrls array is required' },
        { status: 400 }
      );
    }
    
    if (feedUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one feed URL is required' },
        { status: 400 }
      );
    }
    
    console.log(`🎵 Analyzing ${feedUrls.length} feeds for music tracks`);
    
    const results = [];
    const errors = [];
    
    // Process each feed
    for (const feedUrl of feedUrls) {
      try {
        const result = await MusicTrackParser.extractMusicTracks(feedUrl);
        results.push({
          feedUrl,
          success: true,
          data: result
        });
      } catch (error) {
        errors.push({
          feedUrl,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Aggregate results
    const totalTracks = results.reduce((sum, r) => sum + r.data.tracks.length, 0);
    const totalRelatedFeeds = results.reduce((sum, r) => sum + r.data.relatedFeeds.length, 0);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalFeeds: feedUrls.length,
        successfulFeeds: results.length,
        failedFeeds: errors.length,
        totalTracks,
        totalRelatedFeeds
      },
      results,
      errors
    });
    
  } catch (error) {
    console.error('Bulk music track extraction failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 