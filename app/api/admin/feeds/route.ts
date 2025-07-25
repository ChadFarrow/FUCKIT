import { NextRequest, NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';

export async function GET() {
  try {
    const feedManager = FeedManager.getInstance();
    const feeds = await feedManager.getAllFeeds();
    
    return NextResponse.json({
      success: true,
      feeds,
      count: feeds.length
    });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, type = 'album' } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    if (!['album', 'publisher'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be "album" or "publisher"' },
        { status: 400 }
      );
    }

    const feedManager = FeedManager.getInstance();
    const feed = await feedManager.addFeed(url, type);
    
    return NextResponse.json({
      success: true,
      feed,
      message: 'Feed added successfully and is being processed'
    });
  } catch (error) {
    console.error('Error adding feed:', error);
    
    if (error instanceof Error && error.message === 'Feed already exists') {
      return NextResponse.json(
        { success: false, error: 'Feed already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}