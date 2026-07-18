import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { podcastIndexAPI } from '@/lib/podcast-index-api';
import { invalidateAlbumsFastCache } from '@/lib/caches/albums-fast-cache';
import { invalidateSearchCache } from '@/lib/caches/search-cache';

/**
 * POST /api/admin/check-dead-feeds
 *
 * Periodic "did an artist take their catalog down?" sweep. Catches feeds whose
 * RSS URL has gone dead upstream (404 / removed from Wavlake, etc.) — the album
 * keeps showing because its tracks are cached in the DB even though the feed is
 * gone. `status` can't durably flag these: the nightly `fix-feed-status` step
 * flips any error feed that still has tracks back to 'active', and a taken-down
 * feed still has its cached tracks. So we hide via the orthogonal `markedDead`
 * flag (same durable, reversible mechanism as the admin "Hide Feed" card).
 *
 * Two-signal, so nothing is hidden on a hunch:
 *   1. DISCOVER (cheap, catalog-wide): ask PodcastIndex — its crawler already
 *      does 404 detection and exposes `dead`. We never HTTP-probe the whole
 *      catalog ourselves (Wavlake 429-rate-limits Railway after ~50 fetches).
 *   2. CONFIRM (only the small PI-flagged set): directly fetch the feed URL and
 *      require a hard 404/410 before auto-hiding. PI-says-dead-but-URL-200 goes
 *      to `needsReview`; transient errors go to `unconfirmed`. Neither is hidden.
 *
 * Body: { dryRun?: boolean (default false), limit?: number }
 * In dryRun mode nothing is written and confirmed feeds come back as `wouldHide`.
 */

const PI_BATCH_SIZE = 10;
const PI_BATCH_DELAY_MS = 1000;
const CONFIRM_TIMEOUT_MS = 15000;

type FeedRow = {
  id: string;
  title: string;
  artist: string | null;
  originalUrl: string;
  guid: string | null;
};

type FlaggedFeed = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
  piDead: number;
  httpStatus: number | null;
  reason?: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun: boolean = Boolean(body?.dryRun);
    const limit: number | undefined =
      typeof body?.limit === 'number' && body.limit > 0 ? body.limit : undefined;

    // --- Step 1: discover candidates via PodcastIndex `dead` flag ------------
    const feeds: FeedRow[] = await prisma.feed.findMany({
      where: { status: 'active', markedDead: false },
      select: { id: true, title: true, artist: true, originalUrl: true, guid: true },
      ...(limit ? { take: limit } : {}),
    });

    const candidates: Array<{ feed: FeedRow; piDead: number }> = [];

    for (let i = 0; i < feeds.length; i += PI_BATCH_SIZE) {
      const batch = feeds.slice(i, i + PI_BATCH_SIZE);
      await Promise.all(
        batch.map(async (feed) => {
          // Prefer an exact GUID lookup. `getFeedByUrl` prefers the newest
          // duplicate by ID, which could mask a dead older entry, so it's only
          // the fallback for feeds we have no GUID for.
          const piFeed = feed.guid
            ? await podcastIndexAPI.getFeedByGuid(feed.guid)
            : await podcastIndexAPI.getFeedByUrl(feed.originalUrl);

          // Not in PI (self-hosted feeds PI doesn't track) → never flag.
          if (!piFeed) return;

          if (typeof piFeed.dead === 'number' && piFeed.dead > 0) {
            candidates.push({ feed, piDead: piFeed.dead });
          }
        })
      );
      if (i + PI_BATCH_SIZE < feeds.length) {
        await delay(PI_BATCH_DELAY_MS);
      }
    }

    // --- Step 2: confirm each candidate really 404s before acting ------------
    const confirmed: FlaggedFeed[] = []; // hard 404/410 → eligible to hide
    const needsReview: FlaggedFeed[] = []; // PI dead but URL still returns 200
    const unconfirmed: FlaggedFeed[] = []; // transient / other errors

    for (const { feed, piDead } of candidates) {
      let httpStatus: number | null = null;
      try {
        const res = await fetch(feed.originalUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'StableKraft-Feed-Parser/1.0' },
          signal: AbortSignal.timeout(CONFIRM_TIMEOUT_MS),
        });
        httpStatus = res.status;
      } catch (err) {
        // Network failure / timeout — treat as unconfirmed (do not hide).
        const flagged: FlaggedFeed = {
          id: feed.id,
          title: feed.title,
          artist: feed.artist,
          url: feed.originalUrl,
          piDead,
          httpStatus: null,
          reason: err instanceof Error ? err.message : 'fetch failed',
        };
        unconfirmed.push(flagged);
        continue;
      }

      const flagged: FlaggedFeed = {
        id: feed.id,
        title: feed.title,
        artist: feed.artist,
        url: feed.originalUrl,
        piDead,
        httpStatus,
      };

      if (httpStatus === 404 || httpStatus === 410) {
        confirmed.push(flagged);
      } else if (httpStatus >= 200 && httpStatus < 300) {
        needsReview.push({ ...flagged, reason: 'PI marked dead but URL still returns 200' });
      } else {
        unconfirmed.push({ ...flagged, reason: `HTTP ${httpStatus}` });
      }
    }

    // --- Step 3: apply (auto-hide confirmed-dead feeds) ----------------------
    let hiddenCount = 0;
    if (!dryRun && confirmed.length > 0) {
      const result = await prisma.feed.updateMany({
        where: { id: { in: confirmed.map((f) => f.id) } },
        data: { markedDead: true },
      });
      hiddenCount = result.count;

      // A hidden feed changes the grid + search results.
      invalidateAlbumsFastCache();
      invalidateSearchCache();
    }

    return NextResponse.json({
      success: true,
      dryRun,
      checked: feeds.length,
      candidates: candidates.length,
      ...(dryRun
        ? { wouldHide: confirmed }
        : { hidden: confirmed, hiddenCount }),
      needsReview,
      unconfirmed,
      message: dryRun
        ? `Would hide ${confirmed.length} confirmed-dead feed(s); ${needsReview.length} need review, ${unconfirmed.length} unconfirmed.`
        : `Hid ${hiddenCount} confirmed-dead feed(s); ${needsReview.length} need review, ${unconfirmed.length} unconfirmed.`,
    });
  } catch (error) {
    console.error('Error in check-dead-feeds:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check dead feeds',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
