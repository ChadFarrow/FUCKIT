/**
 * Stale-while-revalidate cache for the Community tab's relay sweep.
 *
 * The sweep costs ~4.4s because it waits on real Nostr relays. A plain TTL cache makes
 * that cost land on a *user*: whoever arrives first after expiry sits through the whole
 * thing. Since the data is other people's favorites — interesting, not urgent — serving
 * a slightly stale answer instantly and refreshing behind the request is strictly better
 * than making someone wait for perfect freshness.
 *
 * So: fresh → serve. Stale but within grace → serve immediately AND refresh in the
 * background. Only a genuinely cold cache blocks.
 */

/**
 * Serve without touching relays.
 *
 * Three hours, because "what other people favorited" has no urgency — nobody is watching
 * this tab for a live feed, and a favorite that shows up three hours late is indis-
 * tinguishable from one that showed up instantly. Set against a ~4.4s relay sweep, a
 * long window is almost pure win: near-every request is served in ~50ms, and we touch
 * the relay network a handful of times a day per instance instead of every 90 seconds.
 * The refresh button still forces a real sweep for anyone who wants one.
 */
export const FRESH_MS = 3 * 60 * 60 * 1000;
/**
 * Beyond this we block on a real sweep rather than show something misleadingly old.
 * Between FRESH_MS and here, the entry is served instantly and refreshed behind the
 * request — so in practice this only bites an instance nobody has visited all day.
 */
export const STALE_GRACE_MS = 24 * 60 * 60 * 1000;

export type CacheAction = 'serve-fresh' | 'serve-stale-and-revalidate' | 'block-and-fetch';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Pure: what should this request do? Unit-tested — see community-favorites-cache.test.ts.
 */
export function decideCacheAction(
  entry: CacheEntry<unknown> | null,
  now: number,
  opts: { freshMs?: number; graceMs?: number } = {}
): CacheAction {
  const freshMs = opts.freshMs ?? FRESH_MS;
  const graceMs = opts.graceMs ?? STALE_GRACE_MS;
  if (!entry) return 'block-and-fetch';
  const age = now - entry.timestamp;
  // A clock skew or a future timestamp should behave like "fresh", not like "ancient".
  if (age < freshMs) return 'serve-fresh';
  if (age < graceMs) return 'serve-stale-and-revalidate';
  return 'block-and-fetch';
}

// ── module-scoped state (per Railway instance, like albums-fast-cache) ──────

let entry: CacheEntry<any> | null = null;
// A single in-flight refresh shared by every caller, so a burst of requests arriving on
// a stale cache triggers ONE sweep rather than one per request.
let inFlight: Promise<any> | null = null;

export function getCommunityCacheEntry<T>(): CacheEntry<T> | null {
  return entry;
}

export function setCommunityCacheEntry<T>(data: T, now: number): void {
  entry = { data, timestamp: now };
}

export function invalidateCommunityCache(): void {
  entry = null;
  inFlight = null;
}

/**
 * Run `refresh` unless one is already running; store the result on success.
 *
 * Failures deliberately leave the existing entry in place — a relay hiccup must not
 * demote a good cached answer to an empty tab.
 */
export function refreshCommunityCache<T>(
  refresh: () => Promise<T>,
  shouldStore: (result: T) => boolean,
  now: () => number = Date.now
): Promise<T> {
  if (inFlight) return inFlight;
  inFlight = refresh()
    .then((result) => {
      if (shouldStore(result)) setCommunityCacheEntry(result, now());
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
