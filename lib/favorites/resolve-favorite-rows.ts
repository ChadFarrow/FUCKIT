import type { Prisma } from '@prisma/client';
import { feedLookupWhere } from '@/lib/favorite-feed-ids';

/**
 * The id ladders that turn a stored favorite into the DB row it means.
 *
 * `FavoriteAlbum.feedId` and `FavoriteTrack.trackId` are both POLYMORPHIC. The
 * id written is whatever the client had to hand at the time, and that has never
 * been consistent. Measured on production favorites: 99 of 235 favorite tracks
 * match `Track.id` and the rest match `Track.guid`, and favorited albums are
 * split between `Feed.id` and `Feed.guid` the same way.
 *
 * Every rung is therefore load-bearing. Dropping one does not fail loudly — the
 * favorite simply resolves to nothing and disappears from whatever the caller
 * was building, which on the shared list means an entry silently leaving a
 * published event.
 *
 * The ladder lives here because it has THREE readers: the two endpoints
 * `/favorites` renders from, and `/api/favorites/sync-items`, which feeds the
 * kind:10333 publish. They need wildly different columns — the display routes
 * want artwork and track lists, the sync route wants a guid and a medium — so
 * each caller passes its own query and keeps its own inferred row type. What
 * they share, and must keep sharing, is which rows come back.
 *
 * Shaped after `lib/feed-lookup.ts`: ordered rungs, each one narrowing what is
 * left over.
 */

/** A feed row must carry the columns the ladder matches on. */
type LadderFeed = { id: string; guid: string | null };

/** A track row must carry the columns the ladder matches on. */
type LadderTrack = { id: string; guid: string | null; audioUrl: string };

/**
 * Resolve favorited feed ids to feed rows, keyed by the id the FAVORITE holds.
 *
 * Keyed that way on purpose: a favorite stored under `Feed.guid` resolves to a
 * row whose `id` is something else, and a caller looking the row up by
 * `favorite.feedId` would miss it. Getting this wrong once created a second
 * `FavoriteAlbum` row that `@@unique([userId, feedId])` could not reject,
 * because the two strings differ — and the album then rendered twice.
 *
 * Synthetic `artist-*` ids are skipped. They come from `/api/publishers`, match
 * no column in either table, and are resolved by artist name by the one caller
 * that cares.
 */
export async function resolveFavoriteFeeds<T extends LadderFeed>(
  feedIds: string[],
  fetchFeeds: (where: Prisma.FeedWhereInput) => Promise<T[]>
): Promise<Map<string, T>> {
  const byFavoriteId = new Map<string, T>();
  if (feedIds.length === 0) return byFavoriteId;

  const wanted = new Set(feedIds.filter((id) => id && !id.startsWith('artist-')));
  if (wanted.size === 0) return byFavoriteId;

  // Both rungs in one query — `feedLookupWhere` is the existing, tested
  // expression for "every feed any of these ids could name" (#192).
  const feeds = await fetchFeeds(feedLookupWhere([...wanted]));

  // `Feed.id` is applied first so that a string which is one feed's id and
  // another feed's guid resolves to the same row the sequential ladder picked.
  for (const feed of feeds) {
    if (wanted.has(feed.id)) byFavoriteId.set(feed.id, feed);
  }
  for (const feed of feeds) {
    if (feed.guid && wanted.has(feed.guid) && !byFavoriteId.has(feed.guid)) {
      byFavoriteId.set(feed.guid, feed);
    }
  }

  return byFavoriteId;
}

/**
 * Resolve favorited track ids to track rows.
 *
 * Returns a flat list rather than a map: `FavoriteTrack.trackId` can match a
 * row on any of three columns, so callers pair rows back to favorites by
 * testing all three. The third rung exists because some favorites stored a full
 * audio URL as the id.
 */
export async function resolveFavoriteTracks<T extends LadderTrack>(
  trackIds: string[],
  fetchTracks: (where: Prisma.TrackWhereInput) => Promise<T[]>
): Promise<T[]> {
  if (trackIds.length === 0) return [];

  // Rung 1 — Track.id
  const tracks = await fetchTracks({ id: { in: trackIds } });

  const matchedIds = new Set(tracks.map((t) => t.id));
  const unmatched = trackIds.filter((id) => !matchedIds.has(id));
  if (unmatched.length === 0) return tracks;

  // Rung 2 — Track.guid
  const byGuid = await fetchTracks({ guid: { in: unmatched } });
  const found = [...tracks, ...byGuid];

  const matchedGuids = new Set(byGuid.map((t) => t.guid));
  const stillUnmatched = unmatched.filter((id) => !matchedGuids.has(id));
  if (stillUnmatched.length === 0) return found;

  // Rung 3 — Track.audioUrl, for favorites that stored a full URL
  const byAudioUrl = await fetchTracks({ audioUrl: { in: stillUnmatched } });
  return [...found, ...byAudioUrl];
}

/**
 * Pair a resolved track row back to the favorite that named it.
 *
 * All three columns must be tested, for the same reason the ladder has three
 * rungs — the caller does not know which one matched.
 */
export function favoriteForTrack<
  T extends LadderTrack,
  F extends { trackId: string },
>(track: T, favorites: F[]): F | undefined {
  return favorites.find(
    (f) =>
      f.trackId === track.id ||
      f.trackId === track.guid ||
      f.trackId === track.audioUrl
  );
}
