import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export async function GET(request: Request) {
  try {
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('Parsed feeds file not found at:', parsedFeedsPath);
      return NextResponse.json({ 
        error: 'Parsed feeds not found',
        timestamp: new Date().toISOString()
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Read file with error handling
    let parsedFeedsData;
    try {
      const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
      parsedFeedsData = JSON.parse(fileContent);
    } catch (readError) {
      console.error('Error reading or parsing parsed-feeds.json:', readError);
      return NextResponse.json({ 
        error: 'Failed to read parsed feeds',
        timestamp: new Date().toISOString()
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Validate parsed feeds data structure
    if (!parsedFeedsData || !Array.isArray(parsedFeedsData.feeds)) {
      console.error('Invalid parsed feeds data structure:', parsedFeedsData);
      return NextResponse.json({ 
        error: 'Invalid parsed feeds format',
        timestamp: new Date().toISOString()
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Enhanced validation and data cleanup
    const validationWarnings: string[] = [];
    const validatedFeeds = parsedFeedsData.feeds.map((feed: any) => {
      // Validate required fields
      if (!feed.id) {
        validationWarnings.push(`Feed missing ID: ${feed.originalUrl || 'unknown'}`);
      }
      if (!feed.originalUrl) {
        validationWarnings.push(`Feed missing originalUrl: ${feed.id || 'unknown'}`);
      }
      if (!feed.parseStatus) {
        validationWarnings.push(`Feed missing parseStatus: ${feed.id || 'unknown'}`);
        feed.parseStatus = 'unknown';
      }

      // Validate publisher feeds specifically
      if (feed.type === 'publisher' && feed.parseStatus === 'success') {
        const publisherItems = feed.parsedData?.publisherItems || feed.parsedData?.remoteItems || [];
        let validItemsCount = 0;
        let emptyTitleCount = 0;

        publisherItems.forEach((item: any) => {
          if (!item.title || item.title.trim() === '') {
            emptyTitleCount++;
          } else {
            validItemsCount++;
          }
          
          // Add feedGuid validation
          if (!item.feedGuid) {
            validationWarnings.push(`Publisher item missing feedGuid: ${feed.id}`);
          }
        });

        // Add metadata about publisher items
        feed.metadata = {
          ...feed.metadata,
          totalItems: publisherItems.length,
          validItems: validItemsCount,
          emptyTitleItems: emptyTitleCount,
          validationIssues: emptyTitleCount > 0 ? ['empty_titles'] : []
        };

        if (emptyTitleCount > 0) {
          validationWarnings.push(`Publisher feed ${feed.id} has ${emptyTitleCount} items with empty titles`);
        }
      }

      // Validate album feeds
      if (feed.type === 'album' && feed.parseStatus === 'success') {
        const album = feed.parsedData?.album;
        if (album) {
          if (!album.title) {
            validationWarnings.push(`Album missing title: ${feed.id}`);
          }
          if (!album.artist) {
            validationWarnings.push(`Album missing artist: ${feed.id}`);
          }
          if (!album.tracks || !Array.isArray(album.tracks)) {
            validationWarnings.push(`Album missing or invalid tracks: ${feed.id}`);
          }
        }
      }

      return feed;
    });

    // Update the data with validated feeds
    parsedFeedsData.feeds = validatedFeeds;
    
    // Add validation summary
    parsedFeedsData.validation = {
      timestamp: new Date().toISOString(),
      totalFeeds: validatedFeeds.length,
      successfulFeeds: validatedFeeds.filter((f: any) => f.parseStatus === 'success').length,
      publisherFeeds: validatedFeeds.filter((f: any) => f.type === 'publisher').length,
      albumFeeds: validatedFeeds.filter((f: any) => f.type === 'album').length,
      warningsCount: validationWarnings.length,
      warnings: process.env.NODE_ENV === 'development' ? validationWarnings : validationWarnings.slice(0, 10)
    };

    // Check query parameters for pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '0');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    let responseData = parsedFeedsData;
    
    // Apply pagination if requested
    if (limit > 0) {
      const totalFeeds = parsedFeedsData.feeds.length;
      const paginatedFeeds = parsedFeedsData.feeds.slice(offset, offset + limit);
      
      responseData = {
        ...parsedFeedsData,
        feeds: paginatedFeeds,
        pagination: {
          total: totalFeeds,
          limit,
          offset,
          hasMore: offset + limit < totalFeeds
        }
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=900', // Increased to 15 minutes for better performance
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  } catch (error) {
    console.error('Unexpected error in parsed-feeds API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 