import { NextRequest, NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedManager = FeedManager.getInstance();
    const feed = await feedManager.getFeed(params.id);
    
    if (!feed) {
      return NextResponse.json(
        { success: false, error: 'Feed not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      feed
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedManager = FeedManager.getInstance();
    const removed = await feedManager.removeFeed(params.id);
    
    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Feed not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Feed removed successfully'
    });
  } catch (error) {
    console.error('Error removing feed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to remove feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}