import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Album';
    const artist = searchParams.get('artist') || 'Unknown Artist';
    
    // Create a simple SVG placeholder with the album title and artist
    const initials = title.split(' ').map(word => word.charAt(0).toUpperCase()).join('').slice(0, 2);
    const backgroundColor = getColorFromString(title);
    
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${adjustBrightness(backgroundColor, -20)};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#bg)" />
        <circle cx="200" cy="160" r="60" fill="rgba(255,255,255,0.2)" />
        <text x="200" y="175" font-family="system-ui, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
        <text x="200" y="280" font-family="system-ui, sans-serif" font-size="18" font-weight="600" text-anchor="middle" fill="white" opacity="0.9">${truncateText(title, 20)}</text>
        <text x="200" y="320" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle" fill="white" opacity="0.7">${truncateText(artist, 25)}</text>
      </svg>
    `;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
      },
    });

  } catch (error) {
    console.error('Placeholder image error:', error);
    
    // Return a simple fallback SVG
    const fallbackSvg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#374151" />
        <circle cx="200" cy="160" r="60" fill="rgba(255,255,255,0.2)" />
        <text x="200" y="175" font-family="system-ui, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="white">♪</text>
        <text x="200" y="280" font-family="system-ui, sans-serif" font-size="18" font-weight="600" text-anchor="middle" fill="white" opacity="0.9">No Artwork</text>
      </svg>
    `;

    return new NextResponse(fallbackSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
      },
    });
  }
}

// Generate a color based on string hash
function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate a pleasant color
  const hue = Math.abs(hash) % 360;
  const saturation = 45 + (Math.abs(hash) % 30); // 45-75%
  const lightness = 35 + (Math.abs(hash) % 25); // 35-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Adjust brightness of HSL color
function adjustBrightness(hslColor: string, adjustment: number): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return hslColor;
  
  const [, h, s, l] = match;
  const newL = Math.max(0, Math.min(100, parseInt(l) + adjustment));
  
  return `hsl(${h}, ${s}%, ${newL}%)`;
}

// Truncate text to fit in placeholder
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}