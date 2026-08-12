/**
 * The favorite-status cache that backs `BatchedFavoritesContext`.
 *
 * Pure and dependency-free so the part that actually broke is testable without
 * a browser (`npx tsx --test lib/favorite-status-cache.test.ts`) — the context
 * itself is React state and is not reachable from node:test.
 *
 * Issue #190: the cache used to be merge-only, with no write path and no
 * invalidation. Favoriting an album from the home grid left the `false` that
 * was cached when the card first mounted, `toggleFavorite` updated only the
 * button's own state, and the provider lives in the root layout — so the stale
 * entry survived the client-side navigation to /favorites. There, the check
 * short-circuited on it and the heart rendered unfilled having never asked the
 * server. A hard reload "fixed" it, which is what made it look like a server
 * id-matching bug for two rounds of investigation.
 *
 * Two rules follow, and both are load-bearing:
 *
 *  1. `false` is a KNOWN answer, not a missing one. `selectUnknownIds` treats
 *     it as cached — that is the whole point of the cache — so anything that
 *     changes the truth MUST write through via `withFavoriteStatus`. A writer
 *     that only updates local component state re-creates #190 exactly.
 *  2. An answer is only valid for the identity it was asked under. See
 *     `favoritesIdentityKey`.
 */

export type FavoriteKind = 'track' | 'album';

export interface FavoriteStatusMap {
  tracks: Record<string, boolean>;
  albums: Record<string, boolean>;
}

export const EMPTY_FAVORITE_STATUSES: FavoriteStatusMap = Object.freeze({
  tracks: Object.freeze({}) as Record<string, boolean>,
  albums: Object.freeze({}) as Record<string, boolean>,
}) as FavoriteStatusMap;

function bucketFor(kind: FavoriteKind): keyof FavoriteStatusMap {
  return kind === 'track' ? 'tracks' : 'albums';
}

/**
 * Write one known-good answer into the cache.
 *
 * Returns `prev` by reference when nothing changes, so a repeated write can't
 * spin React re-renders. Never mutates `prev` — callers pass it straight into
 * a `setState` updater.
 */
export function withFavoriteStatus(
  prev: FavoriteStatusMap,
  kind: FavoriteKind,
  id: string | null | undefined,
  value: boolean
): FavoriteStatusMap {
  if (!id) return prev;

  const bucket = bucketFor(kind);
  if (prev[bucket][id] === value) return prev;

  return { ...prev, [bucket]: { ...prev[bucket], [id]: value } };
}

/** Key a local write is recorded under. Kind matters: the two stores are separate. */
export function localWriteKey(kind: FavoriteKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Strip answers that a local write has already superseded.
 *
 * A check for an item can be in flight when the user toggles it. The response
 * was correct when it was sent and is stale by the time it lands, so merging
 * it verbatim overwrites the optimistic write and the heart flips back —
 * issue #190's symptom again, in a narrower window. Anything written locally
 * after the request went out therefore wins.
 *
 * `seqAtRequestStart` is the counter's value captured immediately before the
 * fetch; `localWrites` maps `localWriteKey()` to the counter value at write
 * time. Strictly greater, so a write from before the request still yields to
 * the server.
 */
export function dropClobberedKeys(
  incoming: Partial<FavoriteStatusMap> | null | undefined,
  localWrites: Readonly<Record<string, number>>,
  seqAtRequestStart: number
): Partial<FavoriteStatusMap> {
  if (!incoming) return {};

  const survivors = (kind: FavoriteKind, bucket: Record<string, boolean> | undefined) => {
    const kept: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(bucket ?? {})) {
      const writtenAt = localWrites[localWriteKey(kind, id)];
      if (writtenAt !== undefined && writtenAt > seqAtRequestStart) continue;
      kept[id] = value;
    }
    return kept;
  };

  return {
    tracks: survivors('track', incoming.tracks),
    albums: survivors('album', incoming.albums),
  };
}

/** Merge a batch response. Later answers win over earlier cached ones. */
export function mergeFavoriteStatuses(
  prev: FavoriteStatusMap,
  incoming: Partial<FavoriteStatusMap> | null | undefined
): FavoriteStatusMap {
  if (!incoming) return prev;

  return {
    tracks: { ...prev.tracks, ...(incoming.tracks ?? {}) },
    albums: { ...prev.albums, ...(incoming.albums ?? {}) },
  };
}

/**
 * The ids we still have to ask the server about.
 *
 * `false` counts as known — see rule 1 above. Also de-duplicates, since one
 * batch can collect the same id from several cards.
 */
export function selectUnknownIds(
  ids: readonly string[],
  known: Record<string, boolean>
): string[] {
  const seen = new Set<string>();
  const unknown: string[] = [];

  for (const id of ids) {
    if (!id || seen.has(id) || id in known) continue;
    seen.add(id);
    unknown.push(id);
  }

  return unknown;
}

/**
 * Identity a cached answer belongs to.
 *
 * Mirrors the scoping in `/api/favorites/check` and `/api/favorites/albums`
 * exactly — `userId` wins, `sessionId` is the fallback — because the cache is
 * only valid for the scope the question was asked under. It has to be derived
 * the same way rather than keyed on both independently: once signed in, the
 * session id is irrelevant to the answer and changing it should not throw the
 * cache away.
 *
 * This matters because a check can fire before `NostrContext` hydrates. That
 * request goes out session-scoped and misses every `userId`-owned row —
 * `sync-shared` writes those with no `sessionId` at all — so it caches `false`
 * for favorites that genuinely exist. Without re-keying on this, that `false`
 * outlives login for the lifetime of the page.
 */
/**
 * Window event that empties the cache.
 *
 * For writers that change favorites in BULK and can't name the ids: the
 * shared-favorites reconcile (`/api/favorites/sync-shared` returns counts, not
 * ids) and "delete all favorites" in settings. Per-item writers must use
 * `setFavoriteStatus` instead — this throws away good answers too, so it is
 * the blunt instrument, not the default.
 *
 * Dispatched at the call sites rather than from here, to keep this module free
 * of DOM assumptions.
 */
export const FAVORITE_STATUSES_INVALIDATED_EVENT = 'favorites-statuses-invalidated';

export function favoritesIdentityKey(input: {
  userId?: string | null;
  sessionId?: string | null;
}): string {
  if (input.userId) return `user:${input.userId}`;
  if (input.sessionId) return `session:${input.sessionId}`;
  return 'anonymous';
}
