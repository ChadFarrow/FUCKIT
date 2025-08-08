import { NextResponse } from 'next/server';
import { musicTrackDB } from '@/lib/music-track-database';

export async function POST() {
  try {
    // Clear the database cache
    musicTrackDB.clearCache();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
} 