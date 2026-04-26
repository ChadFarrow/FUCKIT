import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { podcastIndexAPI } from '@/lib/podcast-index-api';
import { normalizeUrl } from '@/lib/url-utils';
import { isBlacklistedFeedUrl } from '@/lib/feed-exclusions';

// GET /api/admin/music-show-only-publishers/search?q=<artistName>
//
// Searches the Podcast Index API for publisher-style feeds matching an artist
// name. Three signals (in order):
//   1. PI byterm with medium=publisher
//   2. PI byterm with medium=music — keep entries whose URL matches the
//      Wavlake artist-feed pattern (PI doesn't tag those as medium=publisher)
//   3. Author/title contains the search term (loose fallback)
// Each result is annotated with whether it already exists in the DB so the UI
// can show a toggle vs an "Add as music-show-only" button.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const queryLower = q.toLowerCase();

    // Two PI searches in parallel: one explicitly for medium=publisher,
    // one for medium=music (so we can find Wavlake artist feeds via URL pattern).
    const [publisherResults, musicResults] = await Promise.all([
      podcastIndexAPI.searchByTerm(q, 'publisher', 20).catch(() => []),
      podcastIndexAPI.searchByTerm(q, 'music', 25).catch(() => []),
    ]);

    type Candidate = {
      feedUrl: string;
      feedGuid?: string;
      title: string;
      author: string;
      image: string;
      medium: string;
      source: 'pi-publisher' | 'pi-wavlake-artist';
    };

    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    const pushCandidate = (c: Candidate) => {
      const key = normalizeUrl(c.feedUrl);
      if (seen.has(key)) return;
      if (isBlacklistedFeedUrl(c.feedUrl)) return;
      seen.add(key);
      candidates.push(c);
    };

    for (const f of publisherResults) {
      const author = (f.author || '').toLowerCase();
      const title = (f.title || '').toLowerCase();
      // Loose match — PI sometimes returns peripheral results
      if (!author.includes(queryLower) && !title.includes(queryLower)) continue;
      pushCandidate({
        feedUrl: f.url,
        feedGuid: (f as any).podcastGuid as string | undefined,
        title: f.title,
        author: f.author,
        image: f.image || f.artwork || '',
        medium: f.medium || 'publisher',
        source: 'pi-publisher',
      });
    }

    // Wavlake artist feeds: PI returns them as medium=music with URL pattern
    // /feed/artist/<uuid>. Pluck those out as publisher candidates.
    const wavlakeArtistRe = /^https?:\/\/(www\.)?wavlake\.com\/feed\/artist\/[a-f0-9-]+/i;
    for (const f of musicResults) {
      if (!wavlakeArtistRe.test(f.url || '')) continue;
      const author = (f.author || '').toLowerCase();
      const title = (f.title || '').toLowerCase();
      if (!author.includes(queryLower) && !title.includes(queryLower)) continue;
      pushCandidate({
        feedUrl: f.url,
        feedGuid: (f as any).podcastGuid as string | undefined,
        title: f.title,
        author: f.author,
        image: f.image || f.artwork || '',
        medium: 'publisher',
        source: 'pi-wavlake-artist',
      });
    }

    // Cross-reference DB: which candidates already exist?
    const urlVariants = candidates.flatMap(c => [c.feedUrl, normalizeUrl(c.feedUrl)]);
    const existing = candidates.length === 0
      ? []
      : await prisma.feed.findMany({
          where: { originalUrl: { in: urlVariants } },
          select: { id: true, originalUrl: true, type: true, musicShowOnly: true, title: true },
        });
    const existingByUrl = new Map<string, typeof existing[number]>();
    for (const e of existing) existingByUrl.set(e.originalUrl, e);

    const annotated = candidates.map(c => {
      const match = existingByUrl.get(normalizeUrl(c.feedUrl)) ?? existingByUrl.get(c.feedUrl);
      return {
        ...c,
        existing: match
          ? { id: match.id, type: match.type, musicShowOnly: match.musicShowOnly }
          : null,
      };
    });

    return NextResponse.json({
      query: q,
      results: annotated,
      counts: {
        total: annotated.length,
        alreadyImported: annotated.filter(c => c.existing !== null).length,
      },
    });
  } catch (error) {
    console.error('Error searching publishers:', error);
    return NextResponse.json({ error: 'Failed to search publishers' }, { status: 500 });
  }
}
