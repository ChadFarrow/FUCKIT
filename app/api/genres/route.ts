import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Upstream parsers leak these sentinel strings into podcastCategories.
const JUNK_VALUES = new Set(['null', 'undefined', 'nan', 'none', '-']);

// Minimal HTML-entity decode; some feeds leave "&amp;" / "&#039;" etc. unescaped.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

// GET /api/genres - Get list of unique genres with counts
export async function GET() {
  try {
    // Only count categories on active, non-podcast, non-publisher feeds that the album grid actually surfaces.
    const feedsWithCategories = await prisma.feed.findMany({
      where: {
        status: 'active',
        type: { notIn: ['podcast', 'publisher'] },
        podcastCategories: { isEmpty: false }
      },
      select: {
        podcastCategories: true
      }
    });

    // Count occurrences of each genre
    const genreCounts = new Map<string, number>();

    for (const feed of feedsWithCategories) {
      for (const genre of feed.podcastCategories) {
        if (!genre) continue;
        const cleaned = decodeEntities(genre.trim());
        if (!cleaned) continue;
        if (JUNK_VALUES.has(cleaned.toLowerCase())) continue;
        genreCounts.set(cleaned, (genreCounts.get(cleaned) || 0) + 1);
      }
    }

    // Convert to array and sort by count (descending)
    const genres = Array.from(genreCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      genres,
      total: genres.length
    });

  } catch (error) {
    console.error('Error fetching genres:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genres' },
      { status: 500 }
    );
  }
}
