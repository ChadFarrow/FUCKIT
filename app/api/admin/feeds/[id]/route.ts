import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(
      { success: false, error: 'Feed management temporarily disabled' },
      { status: 503 }
    );
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(
      { success: false, error: 'Feed management temporarily disabled' },
      { status: 503 }
    );
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