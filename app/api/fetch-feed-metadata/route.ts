import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const feedUrl = url.searchParams.get('feedUrl');
    if (!feedUrl) {
      return NextResponse.json({ error: 'Missing feedUrl' }, { status: 400 });
    }

    // Enforce a timeout so the UI isn't stuck if the remote feed is slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(feedUrl, {
        signal: controller.signal,
        // Avoid any caching surprises while developing
        cache: 'no-store',
        headers: {
          'user-agent': 'ITDV-PlaylistMaker/1.0 (+https://example.com)'
        }
      } as RequestInit);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return NextResponse.json({ error: 'Timed out fetching feed' }, { status: 504 });
      }
      return NextResponse.json({ error: 'Failed to fetch feed', details: String(err) }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch feed (${res.status})` }, { status: 502 });
    }
    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      trimValues: true,
      parseTagValue: true,
      parseAttributeValue: true,
    });
    const data = parser.parse(xml);

    const channel = data?.rss?.channel || data?.feed || {};

    // Common fields
    const title = channel.title?.['#text'] || channel.title || '';
    const description = channel.description?.['#text'] || channel.description || '';
    const link = channel.link?.href || channel.link || '';

    // Images (itunes or image.url)
    const itunesImage = channel['itunes:image']?.href || channel['itunes:image']?.url;
    const imageUrl = itunesImage || channel.image?.url || '';

    // Podcasting 2.0
    const podcastMedium = channel['podcast:medium'] || channel.podcast?.medium || '';
    const podcastGuid = channel['podcast:guid'] || channel.podcast?.guid || '';

    // Author
    const author = channel['itunes:author'] || channel.author?.name || channel.author || '';

    return NextResponse.json({
      success: true,
      metadata: {
        title: String(title || ''),
        description: String(description || ''),
        link: String(link || ''),
        imageUrl: String(imageUrl || ''),
        author: String(author || ''),
        medium: String(podcastMedium || ''),
        guid: String(podcastGuid || ''),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse feed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}


