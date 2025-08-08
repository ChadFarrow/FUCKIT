import { NextResponse } from 'next/server';

export async function POST() {
  try {
    return NextResponse.json({
      success: false,
      message: 'Feed migration temporarily disabled',
      results: {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 0
      }
    });
  } catch (error) {
    console.error('Error during feed migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}