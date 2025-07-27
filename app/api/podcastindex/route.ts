import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('feedUrl');
    const endpoint = searchParams.get('endpoint') || 'episodes/byfeedurl';
    
    if (!feedUrl) {
      return NextResponse.json({ error: 'Feed URL is required' }, { status: 400 });
    }

    if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
      console.error('PodcastIndex API credentials not configured');
      // Fallback to direct RSS feed fetch
      const response = await fetch(`${request.nextUrl.origin}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`);
      return new NextResponse(await response.text(), {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Generate auth headers for PodcastIndex
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1');
    hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
    const hashString = hash.digest('hex');

    // Build API URL
    const apiUrl = `${PODCAST_INDEX_BASE_URL}/${endpoint}?url=${encodeURIComponent(feedUrl)}&max=1000`;

    // Fetch from PodcastIndex
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': apiHeaderTime.toString(),
        'Authorization': hashString,
        'User-Agent': 're.podtards.com'
      }
    });

    if (!response.ok) {
      console.error(`PodcastIndex API error: ${response.status} ${response.statusText}`);
      // Fallback to direct RSS feed fetch
      const fallbackResponse = await fetch(`${request.nextUrl.origin}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`);
      return new NextResponse(await fallbackResponse.text(), {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const data = await response.json();

    // Check if we have valid feed data from PodcastIndex
    if (data.items && data.items.length > 0 && data.feed && data.feed.title) {
      // Convert to RSS XML format that our parser expects
      const rssXml = convertPodcastIndexToRSS(data);
      return new NextResponse(rssXml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // PodcastIndex doesn't have this feed or has incomplete data - fallback to direct RSS
      console.log(`PodcastIndex missing feed data for ${feedUrl}, falling back to direct RSS`);
      const fallbackResponse = await fetch(`${request.nextUrl.origin}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`);
      return new NextResponse(await fallbackResponse.text(), {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (error) {
    console.error('PodcastIndex route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from PodcastIndex' },
      { status: 500 }
    );
  }
}

function convertPodcastIndexToRSS(data: any): string {
  const feed = data.feed || {};
  const items = data.items || [];

  // Build RSS XML from PodcastIndex data
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(feed.title || 'Unknown Title')}</title>
    <description>${escapeXml(feed.description || '')}</description>
    <link>${escapeXml(feed.link || '')}</link>
    <itunes:author>${escapeXml(feed.author || feed.ownerName || '')}</itunes:author>
    <itunes:image href="${escapeXml(feed.image || feed.artwork || '')}" />
    ${items.map((item: any) => `
    <item>
      <title>${escapeXml(item.title || '')}</title>
      <description>${escapeXml(item.description || '')}</description>
      <enclosure url="${escapeXml(item.enclosureUrl || '')}" type="${escapeXml(item.enclosureType || 'audio/mpeg')}" length="${item.enclosureLength || 0}" />
      <pubDate>${new Date(item.datePublished * 1000).toUTCString()}</pubDate>
      <itunes:duration>${item.duration || 0}</itunes:duration>
      <itunes:image href="${escapeXml(item.image || feed.image || '')}" />
    </item>`).join('')}
  </channel>
</rss>`;

  return rssXml;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}