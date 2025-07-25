import { NextRequest, NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedManager = FeedManager.getInstance();
    const feed = await feedManager.refreshFeed(params.id);
    
    if (!feed) {
      return NextResponse.json(
        { success: false, error: 'Feed not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      feed,
      message: 'Feed refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing feed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to refresh feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}