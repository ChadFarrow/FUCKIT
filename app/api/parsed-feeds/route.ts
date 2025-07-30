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