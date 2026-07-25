import { prisma } from '@/lib/prisma';
import {
  buildFeedUrlLooseVariants,
  buildFeedUrlVariants,
  extractUuidFromUrl,
} from '@/lib/url-utils';

/**
 * Single source of truth for "which Feed row does this URL mean?".
 *
 * The podping consumer's exists → refresh flow depends on `/api/feeds/exists` and
 * `POST /api/feeds/refresh-by-url` agreeing on the answer, and `POST /api/feeds`
 * agreeing with both (it's the endpoint that mints, so a lookup it misses becomes a
 * duplicate row). Divergence between the first two already caused the Podhome/UpBeats
 * silent-skip bug — so the ladder lives here, once, instead of being copy-pasted.
 */

export type FeedUrlMatchKind = 'exact' | 'loose' | 'uuid-in-url';

export interface FeedUrlMatch {
  id: string;
  matchedVia: FeedUrlMatchKind;
}

/**
 * Resolve a feed URL to a Feed id, trying progressively looser matches.
 *
 * Returns the id rather than the row so callers keep their own `select` shapes;
 * `refresh-by-url` follows up with a primary-key `findUnique`.
 *
 * Rungs, in order — an exact match always wins, so two rows that legitimately differ only
 * by path casing or percent-encoding still each resolve to themselves:
 *   1. exact `originalUrl` match on any variant (uses the @unique btree index)
 *   2. loose match — case-insensitive, over case *and* encoding variants
 *   3. UUID embedded in the URL, matched against Feed.guid / Feed.id
 */
export async function findFeedIdByUrl(
  ...urls: Array<string | null | undefined>
): Promise<FeedUrlMatch | null> {
  const variants = buildFeedUrlVariants(...urls);
  if (variants.length === 0) return null;

  const exact = await prisma.feed.findFirst({
    where: { originalUrl: { in: variants } },
    select: { id: true },
  });
  if (exact) return { id: exact.id, matchedVia: 'exact' };

  // Two dimensions the exact rung can't see, both of which produced silent duplicate mints:
  //
  //   case — `normalizeUrl` lowercases the hostname (via `new URL().toString()`) but leaves
  //   path and query casing alone, and self-hosted music hosts have no UUID in the path for
  //   rung 3 to fall back on, so for them exact-string is the only signal.
  //
  //   encoding — `buildFeedUrlLooseVariants` adds a percent-decoded form, because ~69 prod
  //   rows store literal spaces in `originalUrl` while podpings broadcast the `%20` form.
  //
  // RFC 3986 does treat paths as case-sensitive; that's an accepted deviation, since rung 1
  // above still wins whenever both rows exist and the case this changes is otherwise a
  // silent duplicate mint. Keep this rung's inputs in sync with the lowercase+decode
  // comparison in isBlacklistedFeedUrl()/isPlaylistSourceFeedUrl().
  const looseVariants = buildFeedUrlLooseVariants(...urls);
  const loose = await prisma.feed.findFirst({
    where: {
      OR: looseVariants.map((variant) => ({
        originalUrl: { equals: variant, mode: 'insensitive' as const },
      })),
    },
    select: { id: true },
  });
  if (loose) {
    console.log(
      `🔠 feed-lookup: matched feed ${loose.id} via loose URL match (${looseVariants[0]})`
    );
    return { id: loose.id, matchedVia: 'loose' };
  }

  // Podpings often carry a different host than the DB's originalUrl for the same feed
  // (UpBeats DB has feeds.rssblue.com/upbeats, Podhome broadcasts
  // serve.podhome.fm/rss/<uuid>). Extract the UUID and match against Feed.guid/id.
  for (const variant of variants) {
    const extractedUuid = extractUuidFromUrl(variant);
    if (!extractedUuid) continue;

    const byUuid = await prisma.feed.findFirst({
      where: { OR: [{ guid: extractedUuid }, { id: extractedUuid }] },
      select: { id: true },
    });
    if (byUuid) {
      console.log(
        `🔗 feed-lookup: matched feed ${byUuid.id} via uuid-in-URL fallback (${extractedUuid})`
      );
      return { id: byUuid.id, matchedVia: 'uuid-in-url' };
    }
  }

  return null;
}
