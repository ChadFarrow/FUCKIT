import { NextRequest, NextResponse } from 'next/server';
import { isSafePublicUrl } from '@/lib/url-security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  console.log('🔄 [Audio Proxy] Incoming request for URL:', url?.substring(0, 150));

  if (!url) {
    console.error('❌ [Audio Proxy] Missing URL parameter');
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  const urlCheck = isSafePublicUrl(url, { allowHttp: true });
  if (!urlCheck.ok) {
    console.error(`❌ [Audio Proxy] Rejected URL (${urlCheck.error}):`, url.substring(0, 150));
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  try {
    // Fetch the audio file with browser-like headers to bypass bot detection
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity', // Don't compress audio streams
      'Sec-Fetch-Dest': 'audio',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    // Add Referer/Origin based on the audio URL's origin (makes request look legitimate)
    try {
      const audioOrigin = new URL(url).origin;
      fetchHeaders['Referer'] = audioOrigin + '/';
      fetchHeaders['Origin'] = audioOrigin;
    } catch {
      // Invalid URL, skip referer
    }

    // Add range header if provided (for seeking support)
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      console.log('📍 [Audio Proxy] Range request:', rangeHeader);
      fetchHeaders['Range'] = rangeHeader;
    }

    console.log('⏳ [Audio Proxy] Fetching from origin...');
    const startTime = Date.now();

    // Time out on an origin that never RESPONDS, not on one that responds slowly.
    // `AbortSignal.timeout(30000)` bounds the whole request including the body,
    // and `response.body` is streamed straight to the client below — so a large
    // file on a slow origin was destroyed mid-transfer at 30s. Playback never
    // noticed (short Range requests each finish well inside the window); offline
    // downloads pull the entire file in one request and died on it. Clearing the
    // timer once the headers land keeps the dead-origin protection without
    // capping how long a healthy transfer may take.
    const controller = new AbortController();
    const headerTimeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: fetchHeaders,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(headerTimeout);
    }

    const fetchDuration = Date.now() - startTime;
    console.log(`✅ [Audio Proxy] Origin responded in ${fetchDuration}ms - Status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ [Audio Proxy] Origin returned error status: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch audio file', status: response.status },
        {
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept'
          }
        }
      );
    }

    // Get the response headers with comprehensive CORS support
    const headers = new Headers();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');

    // Enhanced CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // Cache headers - allow browser to cache audio for 1 hour
    // This significantly improves repeat playback performance
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

    // Content length handling
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
      console.log(`📦 [Audio Proxy] Content-Length: ${contentLength} bytes`);
    }

    // Copy range headers if present
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      headers.set('Content-Range', contentRange);
      console.log(`📍 [Audio Proxy] Content-Range: ${contentRange}`);
    }

    console.log(`✅ [Audio Proxy] Returning proxied audio - Content-Type: ${contentType}, Status: ${response.status}`);

    // Return the audio file with proper headers
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    console.error('❌ [Audio Proxy] Error proxying audio:', {
      error: errorName,
      message: errorMessage,
      url: url?.substring(0, 150)
    });

    // Check for timeout
    if (errorName === 'TimeoutError' || errorMessage.includes('timeout')) {
      console.error('⏱️ [Audio Proxy] Request timed out after 30 seconds');
    }

    return NextResponse.json({
      error: 'Failed to proxy audio file',
      errorType: errorName,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      url: process.env.NODE_ENV === 'development' ? url : undefined
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Accept'
      }
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    },
  });
} 