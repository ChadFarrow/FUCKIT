import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isV4VTagsEnabled } from '@/lib/flags';

export const dynamic = 'force-dynamic';

// GET /api/tags - Popular V4V Music tags mirrored into our DB.
// Mirrors the shape of /api/genres so the UI can treat them symmetrically.
export async function GET(request: Request) {
  // Feature is gated by env until the add_v4v_tags migration is applied.
  if (!isV4VTagsEnabled()) {
    return NextResponse.json({ tags: [], total: 0, disabled: true });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    // Count only TrackTag rows whose parent Feed is active — matches what the grid actually shows.
    // The denormalized Tag.count can include orphan rows from error/deleted feeds.
    const grouped = await prisma.trackTag.groupBy({
      by: ['tagId'],
      where: { Track: { Feed: { status: 'active' } } },
      _count: { tagId: true },
    });
    const countsById = new Map(grouped.map(g => [g.tagId, g._count.tagId]));
    const activeIds = Array.from(countsById.keys());
    if (activeIds.length === 0) return NextResponse.json({ tags: [], total: 0 });

    const rows = await prisma.tag.findMany({
      where: { id: { in: activeIds } },
      select: { id: true, name: true },
    });
    const tags = rows
      .map(r => ({ name: r.name, count: countsById.get(r.id) || 0 }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit);

    return NextResponse.json({ tags, total: tags.length });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
