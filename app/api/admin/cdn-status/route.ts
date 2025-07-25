import { NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';

export async function GET() {
  try {
    const feedManager = FeedManager.getInstance();
    const cdnStatus = feedManager.getCDNStatus();
    
    return NextResponse.json({
      success: true,
      cdnStatus
    });
  } catch (error) {
    console.error('Error fetching CDN status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch CDN status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}