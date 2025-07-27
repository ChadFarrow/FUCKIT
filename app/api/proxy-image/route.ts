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
  try {
    const { searchParams } = new URL(request.url);
    let imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL parameter required' }, { status: 400 });
    }

    // Validate URL
    const url = new URL(imageUrl);
    
    // Allow same domains as audio plus all artwork domains
    const allowedDomains = [
      'www.doerfelverse.com',
      'doerfelverse.com', 
      'music.behindthesch3m3s.com',
      'thisisjdog.com',
      'www.thisisjdog.com',
      'wavlake.com',
      'ableandthewolf.com',
      'static.staticsave.com',
      'static.wixstatic.com',
      'op3.dev',
      'd12wklypp119aj.cloudfront.net',
      'f4.bcbits.com',
      'files.heycitizen.xyz',
      'media.rssblue.com',
      'rocknrollbreakheart.com',
      'annipowellmusic.com',
      'noagendaassets.com'
    ];

    // Allow any Bunny.net CDN domain
    const isBunnyCdn = url.hostname.endsWith('.b-cdn.net');
    const isAllowedDomain = allowedDomains.some(domain => url.hostname.includes(domain));
    
    if (!isAllowedDomain && !isBunnyCdn) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // Check rate limiting
    if (isImageRateLimited(imageUrl)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    console.log(`🖼️ Proxying image: ${imageUrl}`);

    // For encoded filenames, try to decode and fetch from original URL first
    if (imageUrl.includes('cache/artwork/artwork-')) {
      const filename = imageUrl.split('/').pop();
      if (filename) {
        const encodedMatch = filename.match(/artwork-(.+?)-([A-Za-z0-9+/=]{20,})\.(jpg|jpeg|png|gif)$/);
        if (encodedMatch) {
          try {
            const base64Part = encodedMatch[2];
            
            // Validate base64 before decoding
            if (!base64Part || base64Part.length < 20) {
              throw new Error('Invalid base64 part');
            }
            
            const originalUrl = atob(base64Part);
            
            // Validate decoded URL
            if (!originalUrl || !originalUrl.startsWith('http')) {
              throw new Error('Invalid decoded URL');
            }
            
            console.log(`🔄 Trying decoded original URL first: ${originalUrl}`);
            
            // Try original URL first
            const originalResponse = await fetch(originalUrl, {
              headers: {
                'User-Agent': 'DoerfelVerse/1.0 (Image Proxy)',
                'Referer': 'https://re.podtards.com',
              },
              signal: AbortSignal.timeout(15000),
            });
            
            if (originalResponse.ok) {
              const contentType = originalResponse.headers.get('Content-Type') || 'image/jpeg';
              if (contentType.startsWith('image/')) {
                const imageBuffer = await originalResponse.arrayBuffer();
                const contentLength = imageBuffer.byteLength;
                
                console.log(`✅ Original URL worked: ${originalUrl} (${contentLength} bytes)`);
                return new NextResponse(imageBuffer, {
                  status: 200,
                  headers: {
                    'Content-Type': contentType,
                    'Content-Length': contentLength.toString(),
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD',
                  },
                });
              }
            }
          } catch (decodeError) {
            console.warn('Failed to decode or fetch original URL:', decodeError);
          }
        }
      }
    }

    // Fetch the image file from CDN as fallback
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (Image Proxy)',
        'Referer': 'https://re.podtards.com',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout for images
    });

    if (!response.ok) {
      console.error(`❌ CDN fetch failed: ${response.status} ${response.statusText}`);
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
    
    // Read the image data as buffer to ensure complete transfer
    const imageBuffer = await response.arrayBuffer();
    const contentLength = imageBuffer.byteLength;
    
    console.log(`✅ Image proxied successfully: ${imageUrl} (${contentLength} bytes)`);
    
    // Create response with proper headers and complete image data
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Range',
      },
    });

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