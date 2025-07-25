import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the Doerfels publisher feed from the public directory
    const feedPath = path.join(process.cwd(), 'public', 'doerfels-publisher-feed.xml');
    
    if (!fs.existsSync(feedPath)) {
      return new NextResponse('Feed not found', { status: 404 });
    }

    const feedContent = fs.readFileSync(feedPath, 'utf-8');
    
    return new NextResponse(feedContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving Doerfels publisher feed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 