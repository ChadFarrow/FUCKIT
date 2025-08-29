import { NextRequest, NextResponse } from 'next/server';
import { enhancedMusicService } from '../../../lib/enhanced-music-service';

/**
 * Enhanced Music API Endpoint
 * 
 * Provides unified access to legacy and enhanced music track data
 * with advanced search and filtering capabilities.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    const action = searchParams.get('action');
    
    switch (action) {
      case 'stats':
        const stats = await enhancedMusicService.getDatabaseStats();
        const enhancementStatus = await enhancedMusicService.getEnhancementStatus();
        
        return NextResponse.json({
          success: true,
          data: {
            ...stats,
            enhancementStatus
          }
        });

      case 'tracks':
        const searchParams_ = {
          query: searchParams.get('query') || undefined,
          artist: searchParams.get('artist') || undefined,
          hasAudio: searchParams.get('hasAudio') === 'true' ? true : undefined,
          hasValueForValue: searchParams.get('hasValueForValue') === 'true' ? true : undefined,
          enhanced: searchParams.get('enhanced') === 'true' ? true : 
                   searchParams.get('enhanced') === 'false' ? false : undefined,
          limit: parseInt(searchParams.get('limit') || '50'),
          offset: parseInt(searchParams.get('offset') || '0')
        };

        const searchResults = await enhancedMusicService.searchTracks(searchParams_);
        
        return NextResponse.json({
          success: true,
          data: searchResults.tracks,
          pagination: {
            total: searchResults.total,
            limit: searchParams_.limit,
            offset: searchParams_.offset,
            hasMore: searchResults.hasMore
          }
        });

      case 'track':
        const trackId = searchParams.get('id');
        const trackIndex = searchParams.get('index');
        
        if (!trackId && !trackIndex) {
          return NextResponse.json({
            success: false,
            error: 'id or index parameter required'
          }, { status: 400 });
        }

        const id = trackId || (trackIndex ? parseInt(trackIndex) : null);
        if (id === null) {
          return NextResponse.json({
            success: false,
            error: 'Invalid track identifier'
          }, { status: 400 });
        }

        const track = await enhancedMusicService.getTrackById(id);
        
        if (!track) {
          return NextResponse.json({
            success: false,
            error: 'Track not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          data: track
        });

      case 'enhancement-status':
        const indexParam = searchParams.get('index');
        
        if (!indexParam) {
          return NextResponse.json({
            success: false,
            error: 'index parameter required'
          }, { status: 400 });
        }

        const index = parseInt(indexParam);
        if (isNaN(index)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid index parameter'
          }, { status: 400 });
        }

        const trackEnhancementStatus = await enhancedMusicService.getTrackEnhancementStatus(index);
        
        return NextResponse.json({
          success: true,
          data: trackEnhancementStatus
        });

      case 'export-public':
        const exported = await enhancedMusicService.exportToPublicDatabase();
        
        return NextResponse.json({
          success: exported,
          message: exported 
            ? 'Public database updated with enhanced data'
            : 'Failed to export to public database'
        });

      case 'unified-tracks':
        // Get all unified tracks (be careful with large datasets)
        const allTracks = await enhancedMusicService.getUnifiedMusicTracks();
        
        // Limit to prevent memory issues
        const limitParam = parseInt(searchParams.get('limit') || '1000');
        const offsetParam = parseInt(searchParams.get('offset') || '0');
        
        const paginatedTracks = allTracks.slice(offsetParam, offsetParam + limitParam);
        
        return NextResponse.json({
          success: true,
          data: paginatedTracks,
          pagination: {
            total: allTracks.length,
            limit: limitParam,
            offset: offsetParam,
            hasMore: offsetParam + limitParam < allTracks.length
          }
        });

      case 'enhanced-only':
        // Get only enhanced tracks
        const allUnifiedTracks = await enhancedMusicService.getUnifiedMusicTracks();
        const enhancedOnlyTracks = allUnifiedTracks.filter(track => track.enhancement?.enhanced);
        
        return NextResponse.json({
          success: true,
          data: enhancedOnlyTracks,
          count: enhancedOnlyTracks.length
        });

      case 'value-for-value':
        // Get tracks with Value4Value support
        const allV4VTracks = await enhancedMusicService.getUnifiedMusicTracks();
        const v4vTracks = allV4VTracks.filter(track => 
          track.enhancedMetadata?.valueForValue?.enabled
        );
        
        return NextResponse.json({
          success: true,
          data: v4vTracks,
          count: v4vTracks.length
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: stats, tracks, track, enhancement-status, export-public, unified-tracks, enhanced-only, value-for-value'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Enhanced Music API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'search':
        const searchResults = await enhancedMusicService.searchTracks(data);
        
        return NextResponse.json({
          success: true,
          data: searchResults.tracks,
          pagination: {
            total: searchResults.total,
            hasMore: searchResults.hasMore
          }
        });

      case 'batch-tracks':
        if (!Array.isArray(data.ids)) {
          return NextResponse.json({
            success: false,
            error: 'ids array required in data object'
          }, { status: 400 });
        }

        const trackPromises = data.ids.map((id: string | number) => 
          enhancedMusicService.getTrackById(id)
        );
        
        const tracks = await Promise.all(trackPromises);
        const validTracks = tracks.filter(track => track !== null);
        
        return NextResponse.json({
          success: true,
          data: validTracks,
          requested: data.ids.length,
          found: validTracks.length
        });

      case 'export-subset':
        // Export a subset of tracks with specific criteria
        const searchCriteria = data.criteria || {};
        const subsetResults = await enhancedMusicService.searchTracks(searchCriteria);
        
        return NextResponse.json({
          success: true,
          data: subsetResults.tracks,
          criteria: searchCriteria,
          total: subsetResults.total
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available POST actions: search, batch-tracks, export-subset'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Enhanced Music POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}