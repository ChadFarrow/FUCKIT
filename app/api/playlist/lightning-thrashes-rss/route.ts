import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the Lightning Thrashes playlist XML file
    const filePath = path.join(process.cwd(), 'public', 'lightning-thrashes-playlist.xml');
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    
    // Return the XML content with proper headers
    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving Lightning Thrashes playlist RSS:', error);
    return new NextResponse('Error loading playlist', { status: 500 });
  }
} 