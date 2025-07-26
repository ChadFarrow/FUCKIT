import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // CDN is disabled, return appropriate status
    return NextResponse.json({
      success: true,
      cdnStatus: {
        configured: false,
        storageZone: null,
        message: 'CDN has been disabled'
      }
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