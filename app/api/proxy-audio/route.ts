import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Fetch the audio file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AudioProxy/1.0)',
        'Range': request.headers.get('range') || 'bytes=0-',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio file' }, { status: response.status });
    }

    // Get the response headers
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    headers.set('Content-Length', response.headers.get('content-length') || '');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range');
    
    // Copy range headers if present
    if (response.headers.get('content-range')) {
      headers.set('Content-Range', response.headers.get('content-range') || '');
    }

    // Return the audio file with proper headers
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('Error proxying audio:', error);
    return NextResponse.json({ error: 'Failed to proxy audio file' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
} 