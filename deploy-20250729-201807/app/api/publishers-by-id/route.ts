import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publisherId = searchParams.get('id');
    
    if (!publisherId) {
      return NextResponse.json({ 
        error: 'Publisher ID is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    console.log(`🔍 Looking for publisher: ${publisherId}`);
    
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('Parsed feeds file not found at:', parsedFeedsPath);
      return NextResponse.json({ 
        error: 'Parsed feeds not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
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
      }, { status: 500 });
    }
    
    // Validate parsed feeds data structure
    if (!parsedFeedsData || !Array.isArray(parsedFeedsData.feeds)) {
      console.error('Invalid parsed feeds data structure:', parsedFeedsData);
      return NextResponse.json({ 
        error: 'Invalid parsed feeds format',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // Find the specific publisher feed by ID or feedGuid
    const publisherFeed = parsedFeedsData.feeds.find((feed: any) => 
      feed.type === 'publisher' && 
      feed.parseStatus === 'success' &&
      feed.parsedData &&
      (feed.id === publisherId || 
       feed.id.includes(publisherId) ||
       feed.parsedData.publisherItems?.some((item: any) => 
         item.feedGuid && item.feedGuid.includes(publisherId)
       ))
    );
    
    if (!publisherFeed) {
      console.log(`❌ Publisher not found: ${publisherId}`);
      return NextResponse.json({ 
        error: 'Publisher not found',
        publisherId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    console.log(`✅ Found publisher: ${publisherFeed.id}`);
    
    const response = {
      id: publisherFeed.id,
      title: publisherFeed.title,
      originalUrl: publisherFeed.originalUrl,
      parseStatus: publisherFeed.parseStatus,
      lastParsed: publisherFeed.lastParsed,
      publisherInfo: publisherFeed.parsedData?.publisherInfo || null,
      publisherItems: publisherFeed.parsedData?.publisherItems || [],
      itemCount: publisherFeed.parsedData?.publisherItems?.length || 0,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  } catch (error) {
    console.error('Unexpected error in publishers-by-id API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
  });
} 