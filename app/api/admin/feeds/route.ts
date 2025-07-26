import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return empty feeds for now
    return NextResponse.json({
      success: true,
      feeds: [],
      count: 0
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

    // Validate inputs
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

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

    // Disabled for now - would need proper FeedManager implementation
    return NextResponse.json(
      { success: false, error: 'Feed management temporarily disabled' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Error adding feed:', error);
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