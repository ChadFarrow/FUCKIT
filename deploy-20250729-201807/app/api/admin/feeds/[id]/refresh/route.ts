import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(
      { success: false, error: 'Feed management temporarily disabled' },
      { status: 503 }
    );
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