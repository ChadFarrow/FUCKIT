/**
 * Input handling for POST /api/favorites/check.
 *
 * WHY: the route took `trackIds` and `feedIds` straight from the body with no
 * cap, no type check and no rate limit, and its tracks branch was quadratic
 * (`trackIds.forEach` wrapping `tracks.find`). Track ids are semi-public —
 * /api/albums-fast returns them — so 10k scraped ids meant ~100M comparisons
 * on the event loop from one request. The identity guard was
 * `if (!sessionId && !userId)`, and `x-session-id` is arbitrary caller text,
 * so no login was needed either.
 *
 * The Map below is the actual fix: it makes the branch linear. The cap is a
 * secondary guard that bounds the SQL IN clause.
 */

/**
 * Deliberately far above any real batch. BatchedFavoritesContext filters to
 * newly-seen ids via selectUnknownIds before sending, so genuine batches are
 * dozens — a long podcast's track list is the worst case and is nowhere near
 * this. No client-side chunking is needed, which keeps this change out of that
 * context's clobber-guard bookkeeping.
 */
export const MAX_CHECK_IDS = 2000;

/** Returns the cleaned id list, or null if the input is unusable. */
export function parseCheckIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_CHECK_IDS) return null;

  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && entry) seen.add(entry);
  }
  return [...seen];
}

interface TrackIdentifiers {
  id: string;
  guid: string | null;
  audioUrl: string | null;
}

/**
 * One lookup table from any identifier to its track, replacing a per-input
 * linear scan. First write wins, matching the previous Array.find semantics so
 * results are unchanged.
 */
export function buildTrackIdIndex<T extends TrackIdentifiers>(
  tracks: ReadonlyArray<T>
): Map<string, T> {
  const index = new Map<string, T>();
  for (const track of tracks) {
    for (const key of [track.id, track.guid, track.audioUrl]) {
      if (key && !index.has(key)) index.set(key, track);
    }
  }
  return index;
}
