import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fs.existsSync(feedsPath)) {
      console.error('Feeds configuration file not found at:', feedsPath);
      return NextResponse.json({ 
        error: 'Feeds configuration not found',
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
    let feedsData;
    try {
      const fileContent = fs.readFileSync(feedsPath, 'utf-8');
      feedsData = JSON.parse(fileContent);
    } catch (readError) {
      console.error('Error reading or parsing feeds.json:', readError);
      return NextResponse.json({ 
        error: 'Failed to read feeds configuration',
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
    
    // Validate feeds data structure
    if (!feedsData || !Array.isArray(feedsData.feeds)) {
      console.error('Invalid feeds data structure:', feedsData);
      return NextResponse.json({ 
        error: 'Invalid feeds configuration format',
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
    
    // Filter active feeds and organize by priority
    const activeFeeds = feedsData.feeds.filter((feed: any) => feed.status === 'active');
    
    const organizedFeeds = {
      core: activeFeeds.filter((feed: any) => feed.priority === 'core'),
      extended: activeFeeds.filter((feed: any) => feed.priority === 'extended'),
      low: activeFeeds.filter((feed: any) => feed.priority === 'low'),
      publisher: activeFeeds.filter((feed: any) => feed.type === 'publisher'),
      all: activeFeeds,
      total: activeFeeds.length,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(organizedFeeds, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600', // Increased to 10 minutes for better performance
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip', // Enable compression
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  } catch (error) {
    console.error('Unexpected error in feeds API:', error);
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

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
  });
}