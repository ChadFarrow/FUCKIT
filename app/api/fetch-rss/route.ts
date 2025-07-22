import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: string; timestamp: number; ttl: number }>();

// Cache TTL in milliseconds (1 minute for debugging)
const CACHE_TTL = 1 * 60 * 1000;

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(cache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  });
}, 10 * 60 * 1000);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const clearCache = searchParams.get('clearCache');

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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (Music RSS Reader)',
      },
      // Add timeout and better error handling
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

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