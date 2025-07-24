import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for audio files
const audioCache = new Map<string, { data: ArrayBuffer; timestamp: number; ttl: number }>();

// Cache TTL: 10 minutes for audio files
const AUDIO_CACHE_TTL = 10 * 60 * 1000;

// Rate limiting for audio requests
const audioRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_AUDIO_REQUESTS_PER_MINUTE = 30;

/**
 * Check if we're rate limited for audio requests
 */
function isAudioRateLimited(url: string): boolean {
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const limit = audioRateLimit.get(domain);
    
    if (!limit) {
      audioRateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (now > limit.resetTime) {
      audioRateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (limit.count >= MAX_AUDIO_REQUESTS_PER_MINUTE) {
      return true;
    }
    
    limit.count++;
    return false;
  } catch {
    return false;
  }
}

/**
 * Clean up expired audio cache entries
 */
function cleanupAudioCache() {
  const now = Date.now();
  Array.from(audioCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > value.ttl) {
      audioCache.delete(key);
    }
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const audioUrl = searchParams.get('url');

  if (!audioUrl) {
    return NextResponse.json({ error: 'Audio URL parameter required' }, { status: 400 });
  }

  try {
    // Validate URL
    const url = new URL(audioUrl);
    
    // Only allow certain domains for security
    const allowedDomains = [
      'www.doerfelverse.com',
      'doerfelverse.com',
      'music.behindthesch3m3s.com',
      'thisisjdog.com',
      'wavlake.com',
      'ableandthewolf.com',
      'static.staticsave.com'
    ];
    
    if (!allowedDomains.includes(url.hostname)) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // Check cache first
    cleanupAudioCache();
    const cached = audioCache.get(audioUrl);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      console.log(`🎵 Serving cached audio: ${audioUrl}`);
      return new NextResponse(cached.data, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=600', // 10 minutes
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    }

    // Check rate limiting
    if (isAudioRateLimited(audioUrl)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    console.log(`🎵 Proxying audio: ${audioUrl}`);

    // Fetch the audio file
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (Music Audio Proxy)',
        'Range': request.headers.get('Range') || 'bytes=0-', // Support range requests
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout for audio
    });

    if (!response.ok) {
      console.error(`❌ Audio fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json({ 
        error: 'Failed to fetch audio file',
        status: response.status 
      }, { status: response.status });
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();
    
    // Cache the audio data
    audioCache.set(audioUrl, {
      data: audioData,
      timestamp: Date.now(),
      ttl: AUDIO_CACHE_TTL
    });

    // Determine content type
    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
    
    // Create response with proper headers
    const proxyResponse = new NextResponse(audioData, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioData.byteLength.toString(),
        'Cache-Control': 'public, max-age=600', // 10 minutes
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Range',
        'Accept-Ranges': 'bytes',
      },
    });

    // Copy relevant headers from original response
    const contentRange = response.headers.get('Content-Range');
    if (contentRange) {
      proxyResponse.headers.set('Content-Range', contentRange);
    }

    console.log(`✅ Audio proxied successfully: ${audioUrl} (${audioData.byteLength} bytes)`);
    return proxyResponse;

  } catch (error) {
    console.error('❌ Audio proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to proxy audio file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
} 