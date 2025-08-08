import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read the resolved songs data file
    const dataPath = path.join(process.cwd(), 'data', 'itdv-resolved-songs.json');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error reading resolved songs data:', error);
    return NextResponse.json(
      { error: 'Failed to load resolved songs data' },
      { status: 500 }
    );
  }
}
