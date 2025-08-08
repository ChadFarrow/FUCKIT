import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to load resolved songs data
function loadResolvedSongsData() {
  try {
    const dataPath = join(process.cwd(), 'itdv-music-feed-fully-resolved.json');
    const data = readFileSync(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading resolved songs data:', error);
    return [];
  }
}

export async function GET() {
  try {
    const resolvedSongsData = loadResolvedSongsData();
    console.log('📊 Serving resolved songs data:', resolvedSongsData.length, 'songs');
    
    return NextResponse.json(resolvedSongsData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error serving resolved songs data:', error);
    return NextResponse.json(
      { error: 'Failed to load resolved songs data' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
