import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for RSS feeds
const cache = new Map<string, { data: string; timestamp: number; ttl: number }>();

// Cache TTL: 5 minutes (increased for better performance)
const CACHE_TTL = 5 * 60 * 1000;

// Rate limiting: track requests per domain
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 20; // Increased for better performance

// Clean up expired cache entries on demand
function cleanupCache() {
  const now = Date.now();
  Array.from(cache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  });
}

// Clean up rate limit data on demand
function cleanupRateLimit() {
  const now = Date.now();
  Array.from(rateLimit.entries()).forEach(([domain, data]) => {
    if (now > data.resetTime) {
      rateLimit.delete(domain);
    }
  });
}

/**
 * Check if we're rate limited for a domain
 */
function isRateLimited(url: string): boolean {
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const limit = rateLimit.get(domain);
    
    if (!limit) {
      rateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (now > limit.resetTime) {
      rateLimit.set(domain, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
      return true;
    }
    
    limit.count++;
    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch with retry logic for rate limiting
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check rate limiting
      if (isRateLimited(url)) {
        const delay = Math.random() * 2000 + 1000; // 1-3 seconds
        console.log(`⏳ Rate limited, waiting ${Math.round(delay)}ms before retry ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DoerfelVerse/1.0 (Music RSS Reader)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // If we get a 429, wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : (attempt * 2000);
        console.log(`🔄 429 error, waiting ${delay}ms before retry ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`⚠️ Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Max retries exceeded');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const clearCache = searchParams.get('clearCache');

  // Clean up expired data on each request
  cleanupCache();
  cleanupRateLimit();

  // Clear cache if requested
  if (clearCache === 'true') {
    cache.clear();
    console.log('🧹 Cache cleared');
    return NextResponse.json({ message: 'Cache cleared' });
  }

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Check cache first
  const cacheKey = url;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < cached.ttl) {
    console.log(`📦 Cache HIT for: ${url}`);
    return new NextResponse(cached.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Cache': 'HIT',
        'X-Cache-Age': Math.floor((now - cached.timestamp) / 1000).toString(),
      },
    });
  }

  console.log(`🔄 Cache MISS for: ${url}`);

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlContent = await response.text();

    // Store in cache
    cache.set(cacheKey, {
      data: xmlContent,
      timestamp: now,
      ttl: CACHE_TTL,
    });

    console.log(`💾 Cached RSS feed: ${url}`);

    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL / 1000)}`,
      },
    });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    
    // Return a more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch RSS feed',
        details: errorMessage,
        url: url 
      },
      { status: 500 }
    );
  }
}