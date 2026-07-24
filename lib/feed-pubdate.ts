import { prisma } from '@/lib/prisma';

/**
 * Recompute Feed.oldestItemPubdate from the feed's oldest Track.publishedAt.
 *
 * This is the album's release date everywhere it is displayed or sorted:
 * `/api/albums-fast` and `/api/feeds/recent` both resolve
 * `releaseDate: feed.oldestItemPubdate || feed.createdAt`. When the column is
 * null that fallback silently reports *when the feed was added to StableKraft*
 * instead of when the music came out — which is how a 2025 album ended up
 * displaying "2026" (issue #169).
 *
 * Call this from every path that writes tracks. Derives from the DB rather
 * than an in-memory episode list so callers don't have to thread the parsed
 * items through; the tracks must already be persisted when it runs.
 *
 * Never throws — a pub-date refresh must not be able to fail a feed import.
 */
export async function syncOldestItemPubdate(feedId: string): Promise<Date | null> {
  try {
    const oldest = await prisma.track.findFirst({
      where: { feedId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'asc' },
      select: { publishedAt: true }
    });

    // No dated tracks — leave any existing value alone rather than clearing it.
    if (!oldest?.publishedAt) return null;

    await prisma.feed.update({
      where: { id: feedId },
      data: { oldestItemPubdate: oldest.publishedAt }
    });

    return oldest.publishedAt;
  } catch (e) {
    console.warn(
      `[oldestItemPubdate] sync failed for ${feedId}:`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
