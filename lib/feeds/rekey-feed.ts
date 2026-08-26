import type { Feed } from '@prisma/client';

/**
 * The full column copy for re-keying a Feed row.
 *
 * WHY THIS EXISTS: Prisma cannot update a primary key, so changing a feed's id
 * means DELETE then CREATE — and the create is a field-by-field copy. The copy
 * in `app/api/feeds/refresh-by-url/route.ts` carried a comment claiming it was
 * complete and copied 22 of the 29 scalar columns. The seven it dropped:
 *
 *   markedDead         a hidden or blacklisted feed UN-HIDES itself
 *   oldestItemPubdate  the album loses its release date (wrong year, wrong sort)
 *   lastNewTrackAt     the album moves in or out of the "New" filter wrongly
 *   podcastImages      podcast:image artwork and the canvas background
 *   persons            credits
 *   musicShowOnly      the music-show-only publisher flag
 *   createdAt          resets to now(), reordering the home grid
 *
 * That route is intentionally public (the podping consumer calls it), so this
 * was reachable without any credential.
 *
 * It is a pure function so `rekey-feed.test.ts` can compare the keys it
 * produces against the model's scalar fields parsed out of `schema.prisma`.
 * A column added to the schema and not added here fails that test instead of
 * disappearing silently in production.
 */

export interface RekeyOverrides {
  /** The new primary key. */
  id: string;
  /** Optional `type` override; falls back to the existing value. */
  type?: string | null;
}

/**
 * Every scalar column of the old row, with `id` replaced.
 *
 * Deliberately built by listing `old`'s fields rather than spreading it: a
 * spread would also carry relation objects if the caller passed an `include`d
 * row, which Prisma rejects at runtime. `updatedAt` is the one field that must
 * NOT be carried — the row is being written now.
 */
export function buildRekeyedFeedData(old: Feed, overrides: RekeyOverrides) {
  return {
    id: overrides.id,
    guid: old.guid,
    medium: old.medium,
    title: old.title,
    description: old.description,
    originalUrl: old.originalUrl,
    cdnUrl: old.cdnUrl,
    type: overrides.type || old.type,
    artist: old.artist,
    image: old.image,
    language: old.language,
    category: old.category,
    podcastCategories: old.podcastCategories,
    explicit: old.explicit,
    priority: old.priority,
    status: old.status,
    lastFetched: old.lastFetched,
    lastError: old.lastError,
    v4vRecipient: old.v4vRecipient,
    v4vValue: old.v4vValue ?? undefined,
    publisherId: old.publisherId,

    // The seven that used to be dropped.
    markedDead: old.markedDead,
    oldestItemPubdate: old.oldestItemPubdate,
    lastNewTrackAt: old.lastNewTrackAt,
    podcastImages: old.podcastImages ?? undefined,
    persons: old.persons ?? undefined,
    musicShowOnly: old.musicShowOnly,
    // Preserved, not reset: `Feed_status_priority_createdAt_idx` orders the home
    // grid by it, so a reset silently moved the album to the front.
    createdAt: old.createdAt,

    // The row is being written now, so this one is NOT carried over.
    updatedAt: new Date(),
  };
}

/**
 * Scalar columns `buildRekeyedFeedData` intentionally does not carry.
 * Exported so the test can state the exception rather than hard-code it.
 */
export const REKEY_INTENTIONALLY_OMITTED: readonly string[] = [];
