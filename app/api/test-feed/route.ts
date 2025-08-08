import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feedName = searchParams.get('feed');

  if (!feedName) {
    return NextResponse.json({ error: 'Feed name parameter is required' }, { status: 400 });
  }

  try {
    let filePath: string;
    
    // Map feed names to file paths
    switch (feedName) {
      case 'test-doerfels-publisher':
        filePath = join(process.cwd(), 'public', 'test-doerfels-publisher.xml');
        break;
      case 'doerfels-publisher':
        filePath = join(process.cwd(), 'doerfels-publisher-feed.xml');
        break;
      default:
        return NextResponse.json({ error: 'Unknown feed name' }, { status: 404 });
    }

    const xmlContent = readFileSync(filePath, 'utf-8');

    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error reading test feed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to read test feed',
        details: error instanceof Error ? error.message : 'Unknown error',
        feedName 
      },
      { status: 500 }
    );
  }
} 