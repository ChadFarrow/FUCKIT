import { NextRequest, NextResponse } from 'next/server';
import { musicTrackDB } from '@/lib/music-track-database';
import { MusicTrackParser } from '@/lib/music-track-parser';
import { createErrorLogger } from '@/lib/error-utils';

const logger = createErrorLogger('MusicTracksDatabaseAPI');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');
    const feedId = searchParams.get('feedId');
    const episodeId = searchParams.get('episodeId');
    const source = searchParams.get('source') as any;
    const hasV4VData = searchParams.get('hasV4VData');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const extractFromFeed = searchParams.get('extractFromFeed');

    // If extractFromFeed is provided, extract and store tracks
    if (extractFromFeed) {
      logger.info('Extracting tracks from feed', { feedUrl: extractFromFeed });
      
      try {
        const result = await MusicTrackParser.extractMusicTracks(extractFromFeed);
        
        // Store tracks in database
        const storedTracks = [];
        for (const track of result.tracks) {
          try {
            const storedTrack = await musicTrackDB.addMusicTrack({
              title: track.title,
              artist: track.artist,
              episodeId: track.episodeId,
              episodeTitle: track.episodeTitle,
              episodeDate: track.episodeDate,
              episodeGuid: track.episodeGuid,
              startTime: track.startTime,
              endTime: track.endTime,
              duration: track.duration,
              audioUrl: track.audioUrl,
              image: track.image,
              description: track.description,
              valueForValue: track.valueForValue,
              source: track.source,
              feedUrl: track.feedUrl,
              feedId: track.feedId || 'unknown',
              extractionMethod: 'api-extraction'
            });
            storedTracks.push(storedTrack);
          } catch (error) {
            logger.warn('Failed to store track', { trackId: track.id, error: (error as Error).message });
          }
        }

        // Store extraction result
        await musicTrackDB.saveExtractionResult({
          feedUrl: extractFromFeed,
          feedId: 'extracted',
          musicTracks: storedTracks.map(t => t.id),
          valueTimeSplits: [],
          boostagrams: [],
          relatedFeeds: [],
          extractionStats: result.extractionStats,
          extractionMethod: 'api-extraction',
          extractionVersion: '1.0.0',
          success: true
        });

        logger.info('Successfully extracted and stored tracks', { 
          feedUrl: extractFromFeed, 
          tracksStored: storedTracks.length 
        });
      } catch (error) {
        logger.error('Failed to extract tracks from feed', { 
          feedUrl: extractFromFeed, 
          error: (error as Error).message 
        });
      }
    }

    // Build search filters
    const filters: any = {};
    if (artist) filters.artist = artist;
    if (title) filters.title = title;
    if (feedId) filters.feedId = feedId;
    if (episodeId) filters.episodeId = episodeId;
    if (source) filters.source = source;
    if (hasV4VData !== null) {
      filters.hasV4VData = hasV4VData === 'true';
    }

    logger.info('Searching tracks with filters', { filters, page, pageSize });

    // Search tracks with better error handling
    let searchResult;
    try {
      searchResult = await musicTrackDB.searchMusicTracks(filters, page, pageSize);
      logger.info('Search completed successfully', { 
        total: searchResult.total, 
        page: searchResult.page,
        pageSize: searchResult.pageSize 
      });
    } catch (searchError) {
      logger.error('Search failed', { error: (searchError as Error).message });
      throw searchError;
    }
    
    // Get database statistics with better error handling
    let stats;
    try {
      stats = await musicTrackDB.getStatistics();
      logger.info('Statistics retrieved successfully', { 
        totalTracks: stats.totalTracks,
        totalEpisodes: stats.totalEpisodes,
        totalFeeds: stats.totalFeeds
      });
    } catch (statsError) {
      logger.error('Statistics failed', { error: (statsError as Error).message });
      throw statsError;
    }

    return NextResponse.json({
      success: true,
      data: {
        tracks: searchResult.tracks,
        pagination: {
          total: searchResult.total,
          page: searchResult.page,
          pageSize: searchResult.pageSize,
          totalPages: Math.ceil(searchResult.total / searchResult.pageSize)
        },
        filters: searchResult.filters,
        statistics: stats
      }
    });

  } catch (error) {
    // Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Music tracks database API failed', { 
      error: errorMessage,
      stack: errorStack,
      url: request.url
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch music tracks',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'extractAndStore':
        const { feedUrls } = data;
        if (!feedUrls || !Array.isArray(feedUrls)) {
          return NextResponse.json(
            { error: 'feedUrls array is required' },
            { status: 400 }
          );
        }

        const results = [];
        const errors = [];

        for (const feedUrl of feedUrls) {
          try {
            logger.info('Extracting tracks from feed', { feedUrl });
            
            const result = await MusicTrackParser.extractMusicTracks(feedUrl);
            
            // Store tracks in database
            const storedTracks = [];
            for (const track of result.tracks) {
              try {
                const storedTrack = await musicTrackDB.addMusicTrack({
                  title: track.title,
                  artist: track.artist,
                  episodeId: track.episodeId,
                  episodeTitle: track.episodeTitle,
                  episodeDate: track.episodeDate,
                  episodeGuid: track.episodeGuid,
                  startTime: track.startTime,
                  endTime: track.endTime,
                  duration: track.duration,
                  audioUrl: track.audioUrl,
                  image: track.image,
                  description: track.description,
                  valueForValue: track.valueForValue,
                  source: track.source,
                  feedUrl: track.feedUrl,
                  feedId: track.feedId || 'unknown',
                  extractionMethod: 'bulk-extraction'
                });
                storedTracks.push(storedTrack);
              } catch (error) {
                logger.warn('Failed to store track', { trackId: track.id, error: (error as Error).message });
              }
            }

            // Store extraction result
            await musicTrackDB.saveExtractionResult({
              feedUrl,
              feedId: 'bulk-extracted',
              musicTracks: storedTracks.map(t => t.id),
              valueTimeSplits: [],
              boostagrams: [],
              relatedFeeds: [],
              extractionStats: result.extractionStats,
              extractionMethod: 'bulk-extraction',
              extractionVersion: '1.0.0',
              success: true
            });

            results.push({
              feedUrl,
              success: true,
              tracksStored: storedTracks.length,
              totalTracks: result.tracks.length,
              relatedFeeds: result.relatedFeeds.length
            });

          } catch (error) {
            errors.push({
              feedUrl,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        const stats = await musicTrackDB.getStatistics();

        return NextResponse.json({
          success: true,
          summary: {
            totalFeeds: feedUrls.length,
            successfulFeeds: results.length,
            failedFeeds: errors.length,
            totalTracksStored: results.reduce((sum, r) => sum + r.tracksStored, 0)
          },
          results,
          errors,
          statistics: stats
        });

      case 'updateTrack':
        const { trackId, updates } = data;
        if (!trackId || !updates) {
          return NextResponse.json(
            { error: 'trackId and updates are required' },
            { status: 400 }
          );
        }

        const updatedTrack = await musicTrackDB.updateMusicTrack(trackId, updates);
        if (!updatedTrack) {
          return NextResponse.json(
            { error: 'Track not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: updatedTrack
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Music tracks database POST failed', { error: (error as Error).message });
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 