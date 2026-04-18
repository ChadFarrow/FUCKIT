import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeUrl } from '@/lib/url-utils';
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

  return NextResponse.json({ exists: Boolean(match) });
}
