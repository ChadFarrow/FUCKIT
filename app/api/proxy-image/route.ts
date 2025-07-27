import { NextRequest, NextResponse } from 'next/server';

// Rate limiting for image requests
const imageRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_IMAGE_REQUESTS_PER_MINUTE = 100;

/**
 * Check if we're rate limited for image requests
 */
function isImageRateLimited(url: string): boolean {
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const limit = imageRateLimit.get(domain);
    
    if (!limit) {
      imageRateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (now > limit.resetTime) {
      imageRateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (limit.count >= MAX_IMAGE_REQUESTS_PER_MINUTE) {
      return true;
    }
    
    limit.count++;
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Image URL parameter required' }, { status: 400 });
  }

  // Fix CDN hostname mapping before trying to fetch
  if (imageUrl.includes('re-podtards-cache.b-cdn.net')) {
    imageUrl = imageUrl.replace('re-podtards-cache.b-cdn.net', 'FUCKIT.b-cdn.net');
    console.log(`🔧 Fixed CDN hostname: ${searchParams.get('url')} → ${imageUrl}`);
  }

  try {
    // Validate URL
    const url = new URL(imageUrl);
    
    // Allow same domains as audio plus CDN domains
    const allowedDomains = [
      'www.doerfelverse.com',
      'doerfelverse.com',
      'music.behindthesch3m3s.com',
      'thisisjdog.com',
      'wavlake.com',
      'ableandthewolf.com',
      'static.staticsave.com',
      'op3.dev',
      'd12wklypp119aj.cloudfront.net',
      'FUCKIT.b-cdn.net',
      're-podtards-cache.b-cdn.net',
      'bunnycdn.com',
      'b-cdn.net'
    ];
    
    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // Check rate limiting
    if (isImageRateLimited(imageUrl)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    console.log(`🖼️ Proxying image: ${imageUrl}`);

    // Fetch the image file
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (Image Proxy)',
        'Referer': 'https://re.podtards.com',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout for images
    });

    if (!response.ok) {
      console.error(`❌ Image fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json({ 
        error: 'Failed to fetch image file',
        status: response.status 
      }, { status: response.status });
    }

    // Get content type and validate it's an image
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image file' }, { status: 400 });
    }
    
    const contentLength = response.headers.get('Content-Length');
    
    // Create response with proper headers for caching
    const proxyResponse = new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Range',
      },
    });

    // Copy relevant headers from original response
    if (contentLength) {
      proxyResponse.headers.set('Content-Length', contentLength);
    }

    console.log(`✅ Image proxied successfully: ${imageUrl} (${contentLength || 'unknown'} bytes)`);
    return proxyResponse;

  } catch (error) {
    console.error('❌ Image proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to proxy image file',
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