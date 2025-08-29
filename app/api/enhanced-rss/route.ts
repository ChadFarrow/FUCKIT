import { NextRequest, NextResponse } from 'next/server';
import { enhancedRSSParser } from '../../../lib/enhanced-rss-parser';

/**
 * Enhanced RSS API Endpoint
 * 
 * This endpoint demonstrates the new RSS parser capabilities:
 * - Podcast Index API integration
 * - Value4Value support  
 * - Remote item resolution
 * - Artist name enhancement
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    const action = searchParams.get('action');
    
    switch (action) {
      case 'capabilities':
        return NextResponse.json({
          success: true,
          capabilities: enhancedRSSParser.getCapabilities()
        });

      case 'parse-feed':
        const feedUrl = searchParams.get('feedUrl');
        const useEnhanced = searchParams.get('enhanced') === 'true';
        
        if (!feedUrl) {
          return NextResponse.json({
            success: false,
            error: 'feedUrl parameter required'
          }, { status: 400 });
        }

        const parsedFeed = await enhancedRSSParser.parseAlbumFeed(feedUrl, {
          useEnhanced,
          includePodcastIndex: true,
          resolveRemoteItems: true,
          extractValueForValue: true
        });

        return NextResponse.json({
          success: true,
          data: parsedFeed,
          enhanced: useEnhanced
        });

      case 'lookup-guid':
        const feedGuid = searchParams.get('feedGuid');
        
        if (!feedGuid) {
          return NextResponse.json({
            success: false,
            error: 'feedGuid parameter required'
          }, { status: 400 });
        }

        const feedData = await enhancedRSSParser.lookupByFeedGuid(feedGuid);

        return NextResponse.json({
          success: true,
          data: feedData
        });

      case 'search-music':
        const query = searchParams.get('query');
        const limit = parseInt(searchParams.get('limit') || '20');
        
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'query parameter required'
          }, { status: 400 });
        }

        const searchResults = await enhancedRSSParser.searchMusic(query, limit);

        return NextResponse.json({
          success: true,
          data: searchResults,
          count: searchResults.length
        });

      case 'enhance-track':
        const trackData = searchParams.get('track');
        
        if (!trackData) {
          return NextResponse.json({
            success: false,
            error: 'track parameter required (JSON encoded)'
          }, { status: 400 });
        }

        try {
          const track = JSON.parse(decodeURIComponent(trackData));
          const enhancedTrack = await enhancedRSSParser.enhanceMusicTrack(track);

          return NextResponse.json({
            success: true,
            data: enhancedTrack
          });
        } catch (parseError) {
          return NextResponse.json({
            success: false,
            error: 'Invalid track JSON data'
          }, { status: 400 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: capabilities, parse-feed, lookup-guid, search-music, enhance-track'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Enhanced RSS API error:', error);
    
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
      case 'enhance-tracks':
        if (!Array.isArray(data.tracks)) {
          return NextResponse.json({
            success: false,
            error: 'tracks array required in data object'
          }, { status: 400 });
        }

        const batchSize = data.batchSize || 5;
        const delayMs = data.delayMs || 1000;

        const enhancedTracks = await enhancedRSSParser.enhanceMusicTracks(
          data.tracks, 
          { batchSize, delayMs }
        );

        return NextResponse.json({
          success: true,
          data: enhancedTracks,
          processed: enhancedTracks.length,
          original: data.tracks.length
        });

      case 'batch-lookup':
        if (!Array.isArray(data.feedGuids)) {
          return NextResponse.json({
            success: false,
            error: 'feedGuids array required in data object'
          }, { status: 400 });
        }

        const lookupResults = await Promise.allSettled(
          data.feedGuids.map((guid: string) => 
            enhancedRSSParser.lookupByFeedGuid(guid)
          )
        );

        const successful = lookupResults
          .filter((result): result is PromiseFulfilledResult<any> => 
            result.status === 'fulfilled' && result.value !== null)
          .map(result => result.value);

        return NextResponse.json({
          success: true,
          data: successful,
          requested: data.feedGuids.length,
          found: successful.length
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available POST actions: enhance-tracks, batch-lookup'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Enhanced RSS POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}