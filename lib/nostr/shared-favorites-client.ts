/**
 * Browser-side driver for the shared cross-app favorites list.
 *
 * Owns three things the pure module in `shared-favorites.ts` deliberately does
 * not: where this device's baseline lives, how a DB favorite becomes a portable
 * wire identifier, and the debounce. Spec: docs/pc20-favorites.md.
 *
 * This is a SECOND channel alongside the per-item kind 30001 events, which are
 * untouched — the Community tab reads those.
 */

import {
  fetchSharedFavorites,
  itemId,
  partitionSharedFavorites,
  showId,
  syncSharedFavorites,
  type SharedFavoriteItem,
} from './shared-favorites';
import { RelayManager, getDefaultRelays, filterReachableRelays } from './relay';

const BASELINE_KEY_PREFIX = 'sk_shared_favorites_baseline';

/**
 * Allowlist gate for the whole cross-app sync, in BOTH directions.
 *
 * StableKraft has no preview environment — `git push origin main` IS the
 * production deploy — so the only way to exercise this against real relays is
 * to ship it and have it do nothing for anyone who hasn't opted in. Unset (the
 * default) means the feature is entirely off: no relay read, no publish, no
 * reconcile, no extra work on any page load.
 *
 * Without this, deploying would publish every signed-in user's favorites to a
 * public `podcast:favorites` list they never asked for. Their favorites are
 * already public via the per-item kind 30001 events, so it is not a new
 * disclosure in kind — but a new aggregated artifact under someone else's key
 * is not a side effect a test gets to have.
 *
 * Comma-separated hex pubkeys. NEXT_PUBLIC_ because the gate is read in the
 * browser, which means it is baked at build time — a Railway redeploy is
 * required to change it. Delete this gate once the feature is meant for
 * everyone; it is scaffolding, not a permanent setting.
 */
function sharedFavoritesEnabledFor(pubkey: string): boolean {
  const raw = process.env.NEXT_PUBLIC_SHARED_FAVORITES_PUBKEYS?.trim();
  if (!raw || !pubkey) return false;
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(pubkey.toLowerCase());
}

// Longer than the per-item queue's 500ms: this is ONE list republish for the
// whole burst, and each cycle costs a relay read plus a signing prompt.
const DEBOUNCE_MS = 1500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<unknown> | null = null;

/**
 * The identifier list this device last agreed with the relay on.
 *
 * Not a cache: without it the merge cannot tell "another app added this" from
 * "I removed this". Losing it isn't fatal — an empty baseline yields no
 * removals, so the next publish is a pure union — but it costs one unfavorite
 * its propagation. Keyed by pubkey, so switching accounts can't cross wires.
 */
export function getBaseline(pubkey: string): string[] {
  if (typeof window === 'undefined' || !pubkey) return [];
  try {
    const raw = localStorage.getItem(`${BASELINE_KEY_PREFIX}:${pubkey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function setBaseline(pubkey: string, ids: string[]): void {
  if (typeof window === 'undefined' || !pubkey) return;
  try {
    localStorage.setItem(`${BASELINE_KEY_PREFIX}:${pubkey}`, JSON.stringify(ids));
  } catch {
    /* quota / private browsing — see the note above on losing the baseline */
  }
}

type ApiAlbum = {
  guid?: string | null;
  originalUrl?: string | null;
  type?: string | null;
  markedDead?: boolean | null;
};

type ApiTrack = {
  guid?: string | null;
  Feed?: { guid?: string | null; originalUrl?: string | null } | null;
};

/**
 * This user's favorites as wire items.
 *
 * Three kinds of favorite are deliberately absent, and every one of them is
 * also excluded from reconciliation on the way back in — something that could
 * never appear on the list must never be treated as missing from it:
 *
 *   - **No guid.** `Feed.guid` and `Track.guid` are both nullable. A feed whose
 *     `<podcast:guid>` we never parsed has no portable identifier at all; the
 *     fix is an admin reparse, not a made-up id.
 *   - **Publishers.** StableKraft's publisher rows use synthetic `artist-*`
 *     ids, not real `podcast:publisher:guid` values.
 *   - **Playlists.** Hard-coded curated slugs with no external identifier.
 */
export function buildLocalItems(albums: ApiAlbum[], tracks: ApiTrack[]): SharedFavoriteItem[] {
  const items: SharedFavoriteItem[] = [];
  const seen = new Set<string>();

  for (const album of albums) {
    if (album.type === 'publisher' || album.type === 'playlist') continue;
    if (!album.guid) continue;
    const id = showId(album.guid);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, feedUrl: album.originalUrl || undefined });
  }

  for (const track of tracks) {
    if (!track.guid) continue;
    const id = itemId(track.guid);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      feedUrl: track.Feed?.originalUrl || undefined,
      // Without the parent feed a consumer can't resolve the item through
      // Podcast Index — /episodes/byguid wants `podcastguid`.
      feedRef: track.Feed?.guid ? showId(track.Feed.guid) : undefined,
    });
  }

  return items;
}

async function loadLocalItems(userId: string): Promise<SharedFavoriteItem[]> {
  const headers = { 'x-nostr-user-id': userId };
  const [albumsRes, tracksRes] = await Promise.all([
    fetch('/api/favorites/albums', { headers }),
    fetch('/api/favorites/tracks', { headers }),
  ]);
  const albums = albumsRes.ok ? ((await albumsRes.json()).data ?? []) : [];
  const tracks = tracksRes.ok ? ((await tracksRes.json()).data ?? []) : [];
  return buildLocalItems(albums, tracks);
}

function resolveRelays(userRelays?: string[]): string[] {
  // Defaults are always unioned in: a dead or AUTH-gated relay in a user's
  // NIP-65 list otherwise produces "published to 0 relays".
  return [...new Set([...filterReachableRelays(userRelays || []), ...getDefaultRelays()])];
}

async function signSharedEvent(template: {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
}) {
  const { getUnifiedSigner } = await import('./signer');
  const { ensureSignerAvailable } = await import('./signer-reconnect');
  const reconnect = await ensureSignerAvailable();
  if (!reconnect.success) throw new Error(reconnect.error || 'Signer unavailable');
  return getUnifiedSigner().signEvent(template as any);
}

/**
 * Publish to relays, reporting whether any actually stored the event.
 *
 * `RelayManager.publish()` iterates relays that were `connect()`ed first — skip
 * that and it resolves with `[]`, which an unchecked `await` reads as success
 * while the event goes nowhere. And since it returns settled results rather
 * than rejecting, "stored" and "refused by every relay" look identical unless
 * you check. Both mistakes shipped once in `nwc-backup.ts`.
 */
async function publishToRelays(event: any, relayUrls: string[]): Promise<boolean> {
  const manager = new RelayManager();
  try {
    const connections = await Promise.allSettled(
      relayUrls.map((url) => manager.connect(url, { read: false, write: true }))
    );
    if (connections.every((c) => c.status === 'rejected')) {
      console.warn('⚠️ Shared favorites: could not connect to any relay');
      return false;
    }
    const results = await manager.publish(event);
    return results.some((r) => r.status === 'fulfilled');
  } finally {
    await manager.disconnectAll().catch(() => {});
  }
}

/**
 * Read → merge → publish the shared list for this user.
 *
 * Serialized through `inFlight`: two concurrent cycles would each read the same
 * event and the loser's merge would be computed against a list the winner has
 * already replaced.
 */
export async function syncSharedFavoritesNow(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): Promise<void> {
  if (!sharedFavoritesEnabledFor(opts.pubkey)) return;
  if (inFlight) {
    await inFlight.catch(() => {});
  }
  const run = (async () => {
    const relayUrls = resolveRelays(opts.relays);
    const local = await loadLocalItems(opts.userId);
    const result = await syncSharedFavorites(
      {
        pubkey: opts.pubkey,
        relays: relayUrls,
        local,
        lastSynced: getBaseline(opts.pubkey),
      },
      signSharedEvent,
      (event) => publishToRelays(event, relayUrls)
    );

    if (result.status === 'published' || result.status === 'unchanged') {
      setBaseline(opts.pubkey, result.ids);
      if (result.status === 'published') {
        console.log(`✅ Shared favorites: published ${result.ids.length} entries`);
      }
    } else if (result.status === 'failed') {
      console.warn('⚠️ Shared favorites: publish failed —', result.error);
    }
    // 'degraded' already warned inside syncSharedFavorites, and deliberately
    // leaves the baseline alone so the next attempt retries the same delta.
  })();

  inFlight = run;
  try {
    await run;
  } finally {
    if (inFlight === run) inFlight = null;
  }
}

/**
 * Debounced sync. Call it after any favorite change; a burst collapses into one
 * read-merge-publish cycle, and so one signing prompt.
 */
export function requestSharedFavoritesSync(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): void {
  if (typeof window === 'undefined' || !opts.userId || !opts.pubkey) return;
  if (!sharedFavoritesEnabledFor(opts.pubkey)) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncSharedFavoritesNow(opts).catch((error) => {
      console.warn('⚠️ Shared favorites sync failed:', error);
    });
  }, DEBOUNCE_MS);
}

export interface PullResult {
  /** 'off' = not allowlisted for this pubkey; nothing was read or written. */
  status: 'ok' | 'degraded' | 'failed' | 'off';
  added?: { albums: number; tracks: number };
  removed?: { albums: number; tracks: number };
  unresolvedFeedGuids?: string[];
}

/**
 * Inbound: read the shared list and reconcile the DB against it.
 *
 * Bails on a degraded read WITHOUT calling the route. The route refuses an
 * untrusted read too — this is deliberately locked at both ends, because the
 * failure mode is deleting favorites the user still has and a relay wobble is
 * indistinguishable from an empty list at exactly one point in the pipeline.
 */
export async function pullSharedFavorites(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): Promise<PullResult> {
  if (!sharedFavoritesEnabledFor(opts.pubkey)) return { status: 'off' };
  const relayUrls = resolveRelays(opts.relays);
  const shared = await fetchSharedFavorites(opts.pubkey, relayUrls);
  if (!shared.trustworthy) {
    console.warn('⚠️ Shared favorites: relay read was degraded — not reconciling');
    return { status: 'degraded' };
  }

  const { shows, tracks } = partitionSharedFavorites(shared.items);

  try {
    const res = await fetch('/api/favorites/sync-shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nostr-user-id': opts.userId },
      // The baseline goes with the request: a removal is `baseline − incoming`,
      // so on first run (no baseline) the route deletes nothing rather than
      // reading the empty shared list as "the user cleared everything".
      body: JSON.stringify({
        trustworthy: true,
        shows,
        tracks,
        baseline: getBaseline(opts.pubkey),
      }),
    });
    if (!res.ok) return { status: 'failed' };
    const data = await res.json();

    // Push straight after a pull when this app holds favorites the list is
    // missing — on first run that is the user's entire existing library, which
    // otherwise wouldn't reach the other apps until they happened to toggle
    // something. `syncSharedFavoritesNow` sets the baseline correctly (its own
    // contribution only), so it is also what establishes the baseline on the
    // very first sync; a no-op push returns 'unchanged' and still records one.
    await syncSharedFavoritesNow(opts);

    // Unknown feeds are imported server-side by the route itself (it already
    // has the guids and `addUnresolvedFeeds`); they land on a later pull.
    return {
      status: 'ok',
      added: data?.added,
      removed: data?.removed,
      unresolvedFeedGuids: data?.unresolved?.feedGuids ?? [],
    };
  } catch (error) {
    console.warn('⚠️ Shared favorites: reconcile request failed:', error);
    return { status: 'failed' };
  }
}

/** Re-exported so callers need only this module. */
export { fetchSharedFavorites, partitionSharedFavorites };
