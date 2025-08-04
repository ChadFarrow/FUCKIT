import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Read the database file directly
    const dbFilePath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const fileContent = fs.readFileSync(dbFilePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Filter tracks by source if specified
    let tracks = data.musicTracks || [];
    if (source) {
      tracks = tracks.filter((track: any) => track.source === source);
    }
    
    // Apply limit
    tracks = tracks.slice(0, limit);
    
    return NextResponse.json({
      success: true,
      tracks: tracks,
      total: tracks.length,
      source: source,
      limit: limit
    });
    
  } catch (error) {
    console.error('Error reading raw tracks:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
} 