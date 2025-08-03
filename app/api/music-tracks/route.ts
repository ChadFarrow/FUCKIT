import { NextRequest, NextResponse } from 'next/server';
import { MusicTrackParser } from '@/lib/music-track-parser';
import { V4VResolver } from '@/lib/v4v-resolver';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('feedUrl');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!feedUrl) {
      return NextResponse.json(
        { error: 'feedUrl parameter is required' },
        { status: 400 }
      );
    }
    
    // Handle local database request
    if (feedUrl === 'local://database') {
      console.log('🎵 Loading tracks from local database');
      try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const dataPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const data = await fs.readFile(dataPath, 'utf8');
        const musicData = JSON.parse(data);
        
        // Apply pagination
        const allTracks = musicData.musicTracks || [];
        const paginatedTracks = allTracks.slice(offset, offset + limit);
        
        return NextResponse.json({
          success: true,
          data: {
            tracks: paginatedTracks,
            relatedFeeds: [],
            metadata: {
              ...musicData.metadata,
              totalTracks: allTracks.length,
              returnedTracks: paginatedTracks.length,
              offset,
              limit
            }
          },
          message: `Successfully loaded ${paginatedTracks.length} tracks from local database (${offset + 1}-${offset + paginatedTracks.length} of ${allTracks.length})`
        });
      } catch (error) {
        console.error('Failed to load local database:', error);
        return NextResponse.json(
          { error: 'Failed to load local database' },
          { status: 500 }
        );
      }
    }
    
    // Validate URL for external feeds
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
    
    // Check if we should resolve V4V tracks
    const resolveV4V = searchParams.get('resolveV4V') === 'true';
    
    if (resolveV4V) {
      console.log('🔍 Resolving V4V tracks...');
      
      // Find all V4V tracks that need resolution
      const v4vTracks = result.tracks.filter(track => 
        track.valueForValue?.feedGuid && 
        track.valueForValue?.itemGuid && 
        !track.valueForValue?.resolved
      );
      
      if (v4vTracks.length > 0) {
        console.log(`📡 Resolving ${v4vTracks.length} V4V tracks...`);
        
        // Prepare batch resolution
        const tracksToResolve = v4vTracks.map(track => ({
          feedGuid: track.valueForValue!.feedGuid!,
          itemGuid: track.valueForValue!.itemGuid!
        }));
        
        // Resolve in batch
        const resolutionResults = await V4VResolver.resolveBatch(tracksToResolve);
        
        // Apply resolved data to tracks
        let resolvedCount = 0;
        result.tracks.forEach(track => {
          if (track.valueForValue?.feedGuid && track.valueForValue?.itemGuid) {
            const key = `${track.valueForValue.feedGuid}:${track.valueForValue.itemGuid}`;
            const resolution = resolutionResults.get(key);
            
            if (resolution?.success) {
              track.valueForValue.resolvedTitle = resolution.title;
              track.valueForValue.resolvedArtist = resolution.artist;
              track.valueForValue.resolvedImage = resolution.image;
              track.valueForValue.resolvedAudioUrl = resolution.audioUrl;
              track.valueForValue.resolvedDuration = resolution.duration;
              track.valueForValue.resolved = true;
              track.valueForValue.lastResolved = new Date();
              resolvedCount++;
            }
          }
        });
        
        console.log(`✅ Successfully resolved ${resolvedCount} V4V tracks`);
      }
    }
    
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