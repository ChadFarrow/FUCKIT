import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUuidFromUrl, normalizeUrl } from '@/lib/url-utils';
import { isBlacklistedFeedUrl } from '@/lib/feed-exclusions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const guid = searchParams.get('guid');

  if (!url && !guid) {
    return NextResponse.json(
      { error: 'url or guid query param is required' },
      { status: 400 }
    );
  }

  if (url && isBlacklistedFeedUrl(url)) {
    return NextResponse.json({ exists: false });
  }

  if (guid) {
    const match = await prisma.feed.findFirst({
      where: { guid },
      select: { id: true },
    });
    return NextResponse.json({ exists: Boolean(match) });
  }

  const rawUrl = url!;
  const normalized = normalizeUrl(rawUrl);
  const urlVariants = new Set<string>([normalized]);
  if (rawUrl !== normalized) urlVariants.add(rawUrl);

  const match = await prisma.feed.findFirst({
    where: { originalUrl: { in: Array.from(urlVariants) } },
    select: { id: true },
  });

  if (match) return NextResponse.json({ exists: true });

  // Fallback: podpings often carry a different host than the DB's originalUrl for
  // the same feed (UpBeats DB has feeds.rssblue.com/upbeats, Podhome broadcasts
  // serve.podhome.fm/rss/<uuid>). Extract the UUID and match against Feed.guid/id.
  // Mirrors the fallback in POST /api/feeds/refresh-by-url so the consumer's
  // exists→refresh flow doesn't silently skip on URL mismatch.
  const extractedUuid = extractUuidFromUrl(rawUrl);
  if (extractedUuid) {
    const byGuid = await prisma.feed.findFirst({
      where: { OR: [{ guid: extractedUuid }, { id: extractedUuid }] },
      select: { id: true },
    });
    if (byGuid) return NextResponse.json({ exists: true });
  }

  return NextResponse.json({ exists: false });
}
