import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read the resolved songs list file
    const dataPath = path.join(process.cwd(), 'data', 'itdv-songs-list.txt');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error reading songs list:', error);
    return NextResponse.json(
      { error: 'Failed to load songs list' },
      { status: 500 }
    );
  }
}
