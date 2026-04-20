import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BLACKLISTED_FEED_IDS, BLACKLISTED_FEED_URLS } from '@/lib/feed-exclusions';
import { normalizeUrl } from '@/lib/url-utils';

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type OpmlFeed = {
  id: string;
  title: string;
  originalUrl: string;
  type: string;
  artist: string | null;
};

function buildOutline(feed: OpmlFeed): string {
  const title = escapeXmlAttr(feed.title || feed.artist || feed.id);
  const xmlUrl = escapeXmlAttr(feed.originalUrl);
  return `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}" />`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type');
  const grouped = searchParams.get('grouped') !== 'false';

  const where: { status: string; type?: string } = { status: 'active' };
  if (typeFilter) where.type = typeFilter;

  const feeds = await prisma.feed.findMany({
    where,
    select: {
      id: true,
      title: true,
      originalUrl: true,
      type: true,
      artist: true,
    },
    orderBy: [{ type: 'asc' }, { title: 'asc' }],
  });

  const normalizedBlacklistUrls = new Set(BLACKLISTED_FEED_URLS.map(normalizeUrl));
  const blacklistIds = new Set(BLACKLISTED_FEED_IDS);

  const filtered = feeds.filter((f) => {
    if (blacklistIds.has(f.id)) return false;
    if (normalizedBlacklistUrls.has(normalizeUrl(f.originalUrl))) return false;
    if (!f.originalUrl) return false;
    return true;
  });

  const now = new Date().toUTCString();
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<opml version="2.0">');
  lines.push('  <head>');
  lines.push('    <title>Stablekraft Feeds</title>');
  lines.push(`    <dateCreated>${now}</dateCreated>`);
  lines.push('    <ownerName>Stablekraft</ownerName>');
  lines.push('    <docs>http://opml.org/spec2.opml</docs>');
  lines.push('  </head>');
  lines.push('  <body>');

  if (grouped) {
    const byType = new Map<string, OpmlFeed[]>();
    for (const f of filtered) {
      const key = f.type || 'album';
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(f);
    }
    const typeOrder = ['album', 'music', 'podcast', 'publisher'];
    const allTypes = Array.from(byType.keys());
    const sortedTypes = [
      ...typeOrder.filter((t) => byType.has(t)),
      ...allTypes.filter((t) => !typeOrder.includes(t)),
    ];
    for (const type of sortedTypes) {
      const label = escapeXmlAttr(type.charAt(0).toUpperCase() + type.slice(1) + 's');
      lines.push(`    <outline text="${label}" title="${label}">`);
      for (const f of byType.get(type)!) {
        lines.push('  ' + buildOutline(f));
      }
      lines.push('    </outline>');
    }
  } else {
    for (const f of filtered) {
      lines.push(buildOutline(f));
    }
  }

  lines.push('  </body>');
  lines.push('</opml>');

  const xml = lines.join('\n');
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stablekraft-feeds.opml"',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
