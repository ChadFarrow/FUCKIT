/**
 * Browser-side driver for the shared cross-app favorites list — kind 10333.
 *
 * Owns what the pure format module deliberately does not: how a DB favorite
 * becomes a portable identifier, the debounce, and the sync-health flag the UI
 * reads. Spec: github.com/ChadFarrow/PC20-Nostr,
 * `pc20-favorites.md`.
 *
 * This is a SECOND channel alongside the per-item kind 30001 events, which are
 * untouched — the Community tab reads those.
 *
 * **The event carries no baseline, but this device keeps one anyway.** Nothing
 * on the wire changes: kind 10333 replaces wholesale, and a reader is told
 * nothing about who wrote what. But a writer still has to answer the question
 * the format cannot — an entry on the list that we do not hold locally is
 * either another app's or one we just removed — so `publishSingleList` records
 * what it published and consults it on the next merge. Getting that wrong made
 * unfavoriting an album undo itself on the next page load; see
 * `mergeSingleList`.
 */

import {
  itemId,
  showId,
  type FavoriteEntry,
} from './pc20-identifiers';
import {
  fetchSingleList,
  groupForSingleList,
  mergeSingleList,
  partitionSingleList,
  publishedRecordFrom,
  suppressOwnRemovals,
  tagsFromGroups,
  templateFromTags,
  type PublishedRecord,
  type SingleListGroup,
} from './favorites-single-list';
import { RelayManager, getDefaultRelays, filterReachableRelays } from './relay';
import { FAVORITE_STATUSES_INVALIDATED_EVENT } from '../favorite-status-cache';
import { npubToPublicKey } from './keys';

/**
 * What the last cross-app sync attempt did, for the UI.
 *
 * A degraded read is handled correctly and SILENTLY: nothing is reconciled,
 * nothing is published, and the favorites on screen are this device's own
 * copy. That silence is the problem this exists to fix — "couldn't reach the
 * relays" and "the list is empty" render identically, so a correct guard reads
 * as data loss. See the spec's §"And say so".
 *
 * Reads and writes surface through ONE flag deliberately — the write half is
 * silent in the same way one screen removed: a favorite toggled while the
 * relays are unreachable skips its publish and looks exactly like one that
 * synced. But they are TRACKED separately (`setSyncHealth`), because the push
 * runs on every toggle and a shared flag let a successful write clear a failed
 * read.
 *
 * `off` is not a failure — it means this account isn't in the trial allowlist,
 * so there is nothing to sync and claiming a relay problem would be a lie.
 */
export type SharedSyncStatus = 'idle' | 'syncing' | 'ok' | 'degraded' | 'off';

let syncStatus: SharedSyncStatus = 'idle';
const syncStatusListeners = new Set<() => void>();

/**
 * Read and write health are tracked SEPARATELY, then surfaced as one flag.
 *
 * One shared `setSyncStatus('ok')` looked equivalent and isn't: the push runs
 * on every favorite toggle (`requestSharedFavoritesSync`), so a successful
 * write would clear a `degraded` raised by a failed READ. The notice would
 * vanish the next time the user favorited anything, while inbound reconcile
 * stayed broken — favorites added in another app still missing, and the Retry
 * button (the only thing that re-runs the pull) gone with it. That is worse
 * than never showing the notice, because it actively reports success.
 *
 * The two halves fail independently and must clear independently.
 */
let readDegraded = false;
let writeDegraded = false;

function setSyncStatus(next: SharedSyncStatus) {
  if (syncStatus === next) return;
  syncStatus = next;
  for (const listener of syncStatusListeners) listener();
}

/** Record one half's health and re-derive the flag the UI reads. */
function setSyncHealth(half: 'read' | 'write', degraded: boolean) {
  if (half === 'read') readDegraded = degraded;
  else writeDegraded = degraded;
  setSyncStatus(readDegraded || writeDegraded ? 'degraded' : 'ok');
}

export function getSharedSyncStatus(): SharedSyncStatus {
  return syncStatus;
}

export function subscribeSharedSyncStatus(listener: () => void): () => void {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

/**
 * In-flight pull, so a retry button can't start a second read-merge-publish
 * cycle. Adding a retry is what makes concurrent pulls reachable at all —
 * before it, this only ran once per page load from NostrContext.
 */
let pullInFlight: Promise<PullResult> | null = null;
/** Whose pull `pullInFlight` belongs to — joining is only correct for the same user. */
let pullInFlightPubkey: string | null = null;


/**
 * Allowlist gate for the whole cross-app sync, in BOTH directions.
 *
 * StableKraft has no preview environment — `git push origin main` IS the
 * production deploy — so the only way to exercise this against real relays is
 * to ship it and have it do nothing for anyone who hasn't opted in. An empty
 * allowlist means the feature is entirely off: no relay read, no publish, no
 * reconcile, no extra work on any page load.
 *
 * Without this, deploying would publish every signed-in user's favorites to a
 * public `podcast:favorites` list they never asked for. Their favorites are
 * already public via the per-item kind 30001 events, so it is not a new
 * disclosure in kind — but a new aggregated artifact under someone else's key
 * is not a side effect a test gets to have.
 *
 * Entries may be npub or hex; both normalize to hex. `NEXT_PUBLIC_SHARED_
 * FAVORITES_PUBKEYS` (comma-separated) adds to the list without a code change,
 * though being NEXT_PUBLIC_ it is baked at build time either way, so it still
 * needs a redeploy.
 *
 * Delete this gate once the feature is meant for everyone; it is scaffolding,
 * not a permanent setting.
 */
const SHARED_FAVORITES_ALLOWLIST: string[] = [
  // Chad — trialling the cross-app sync against real relays.
  'npub177fz5zkm87jdmf0we2nz7mm7uc2e7l64uzqrv6rvdrsg8qkrg7yqx0aaq7',
];

function normalizePubkey(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!v.startsWith('npub1')) return v.toLowerCase();
  try {
    return npubToPublicKey(v).toLowerCase();
  } catch {
    // A malformed entry must not widen the gate — drop it.
    return null;
  }
}

/**
 * Exported for `SharedFavoritesDisclosure`, which has to tell the user which
 * list their favorites actually go to. Everything else in this module is a
 * caller of the gate rather than a reader of it — keep it that way, and delete
 * this export along with the gate when the trial ends.
 */
export function sharedFavoritesEnabledFor(pubkey: string): boolean {
  if (!pubkey) return false;
  const allowed = [
    ...SHARED_FAVORITES_ALLOWLIST,
    ...(process.env.NEXT_PUBLIC_SHARED_FAVORITES_PUBKEYS?.split(',') ?? []),
  ]
    .map(normalizePubkey)
    .filter((v): v is string => !!v);
  return allowed.includes(pubkey.toLowerCase());
}

// Longer than the per-item queue's 500ms: this is ONE list republish for the
// whole burst, and each cycle costs a relay read plus a signing prompt.
const DEBOUNCE_MS = 1500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<unknown> | null = null;

type ApiAlbum = {
  guid?: string | null;
  originalUrl?: string | null;
  type?: string | null;
  markedDead?: boolean | null;
  /** `<podcast:medium>` as the feed declared it. Null when it declared none —
   *  which is NOT the same as `music`, and must never be defaulted to one. */
  medium?: string | null;
};

type ApiTrack = {
  guid?: string | null;
  Feed?: { guid?: string | null; originalUrl?: string | null; medium?: string | null } | null;
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
export function buildLocalItems(albums: ApiAlbum[], tracks: ApiTrack[]): FavoriteEntry[] {
  const items: FavoriteEntry[] = [];
  const seen = new Set<string>();

  for (const album of albums) {
    if (album.type === 'publisher' || album.type === 'playlist') continue;
    if (!album.guid) continue;
    const id = showId(album.guid);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      // Only what the feed actually declared. `Feed.type` is this app's own
      // classification and defaults to "album", so publishing it would be
      // guessing — and a guess on this list is sticky: no other app will
      // correct it, and this one may not either.
      medium: album.medium || undefined,
    });
  }

  for (const track of tracks) {
    if (!track.guid) continue;
    const id = itemId(track.guid);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      // Without the parent feed a consumer can't resolve the item through
      // Podcast Index — /episodes/byguid wants `podcastguid`.
      feedRef: track.Feed?.guid ? showId(track.Feed.guid) : undefined,
      // The PARENT FEED's medium; Podcasting 2.0 has no per-item one.
      medium: track.Feed?.medium || undefined,
    });
  }

  return items;
}

async function loadLocalItems(userId: string): Promise<FavoriteEntry[]> {
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

const SINGLE_LIST_DIGEST_PREFIX = 'sk_single_list_digest';
const SINGLE_LIST_PUBLISHED_PREFIX = 'sk_single_list_published';

/**
 * What this device last published, so the merge can tell an entry it removed
 * from an entry another app added. See `PublishedRecord`.
 *
 * Anything unreadable reads as empty, which is the safe direction: an empty
 * record treats nothing as a removal.
 */
/**
 * Record OUR contribution to what is now on the relays.
 *
 * Called on both paths out of a successful publish — the one that wrote an
 * event and the one that found the relays already holding it. Entries carried
 * on another app's behalf are deliberately absent, so they stay foreign next
 * time; recording them would invert the resurrection bug into a clobber.
 */
function rememberPublished(pubkey: string, localGroups: SingleListGroup[]): void {
  if (typeof window === 'undefined' || !pubkey) return;
  try {
    localStorage.setItem(
      `${SINGLE_LIST_PUBLISHED_PREFIX}:${pubkey}`,
      JSON.stringify(publishedRecordFrom(localGroups))
    );
  } catch {
    /* quota / private browsing — an empty record only costs a propagation */
  }
}

function getPublishedRecord(pubkey: string): PublishedRecord {
  if (typeof window === 'undefined' || !pubkey) return { feeds: [], items: [] };
  try {
    const raw = localStorage.getItem(`${SINGLE_LIST_PUBLISHED_PREFIX}:${pubkey}`);
    if (!raw) return { feeds: [], items: [] };
    const parsed = JSON.parse(raw);
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return { feeds: strings(parsed?.feeds), items: strings(parsed?.items) };
  } catch {
    return { feeds: [], items: [] };
  }
}

/**
 * Publish the kind:10333 single-list event (PC20-Nostr,
 * `pc20-favorites.md`) from the local favorites snapshot.
 *
 * Both this app and Boost Me Bitch write it (BMB since 2026-08-13), so the
 * single-writer assumption this comment used to make is gone. Republishing
 * replaces the whole tag list, so the sequence is read → merge → publish, and
 * never any two of those:
 *
 *   1. `fetchSingleList`, and bail if the read is degraded. A publish on top of
 *      a read that failed silently is the most expensive mistake this format
 *      allows — one bad read, republished, is the entire list.
 *   2. `mergeSingleList` folds local state into what was read, using
 *      `getPublishedRecord` (`sk_single_list_published:<pubkey>`) to tell a
 *      foreign entry from one we removed. Nothing on the wire records which app
 *      added an entry, so without that record "on the list, absent locally" is
 *      ambiguous and both naive answers destroy something.
 *   3. Publish only if the merged tags differ from the tags we read.
 *
 * KNOWN GAP: the merge carries foreign feed groups and their items, but
 * `parseSingleList` only models `i` and `medium`, so a republish still drops
 * foreign tag types, foreign `k` values, `podcast:publisher:guid` entries and
 * any third element on an `i` tag — and a non-UUID `podcast:guid:` is dropped
 * with its following items reparented to the previous group. Spec §4 requires
 * carrying the whole tag. Until that lands, concurrent writes lose data this
 * app cannot see.
 *
 * Skipped when the tag list is unchanged since the last successful publish. Not
 * an optimization for its own sake: every publish costs a signing prompt, this
 * one runs beside the kind:30078 sync so a toggle already costs two, and a
 * remote signer makes each of those a round trip to the user's phone.
 *
 * Never throws. A failure here must not take down the 30078 sync that follows.
 */
async function publishSingleList(
  pubkey: string,
  local: FavoriteEntry[],
  relayUrls: string[]
): Promise<boolean> {
  try {
    // Read first, ALWAYS. Publishing replaces the event wholesale, so a publish
    // on top of a read that failed silently is the most expensive mistake this
    // format allows — one bad read, republished, is the entire list gone. A
    // skipped publish is retried on the next toggle; this is not recoverable.
    const read = await fetchSingleList(pubkey, relayUrls);
    if (!read.trustworthy) {
      console.warn('⚠️ Favorites: relay read was degraded — not publishing');
      return false;
    }

    const localGroups = groupForSingleList(local);
    const merged = mergeSingleList(read, localGroups, getPublishedRecord(pubkey));
    const tags = tagsFromGroups(merged.groups, merged.orphanItemGuids);

    // The digest is computed on the MERGED tags, not on local state. On local
    // state it would never notice a foreign entry arriving, so a group another
    // app added would sit unreplicated until this device's own favorites
    // happened to change.
    const digest = JSON.stringify(tags);
    const key = `${SINGLE_LIST_DIGEST_PREFIX}:${pubkey}`;
    // Unchanged is a success, not a skip: the relays already hold exactly this.
    //
    // The published record is still recorded here, and that is what BOOTSTRAPS
    // it. Writing it only after a real publish left it empty forever on a
    // device whose list already matched — the digest matched on every load, the
    // early return fired, and the record never got written, so the merge went
    // on treating this device's own removals as another app's entries. The fix
    // for the resurrection loop could not engage at all. When the digest
    // matches, the relays hold exactly what we would have published, so
    // recording our contribution is simply true.
    if (typeof window !== 'undefined' && localStorage.getItem(key) === digest) {
      rememberPublished(pubkey, localGroups);
      return true;
    }

    const signed = await signSharedEvent(templateFromTags(tags, Math.floor(Date.now() / 1000)));
    const ok = await publishToRelays(signed, relayUrls);
    if (!ok) {
      console.warn('⚠️ Single-list favorites: no relay accepted the event');
      return false;
    }

    // Only after a relay confirmed storage — recording it on a refused publish
    // would skip every retry from here on.
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, digest);
      } catch {
        /* quota / private browsing — costs a redundant publish, nothing worse */
      }
      rememberPublished(pubkey, localGroups);
    }
    const entries = signed.tags.filter((t: string[]) => t[0] === 'i').length;
    console.log(`✅ Favorites: published ${entries} entries (kind 10333)`);
    return true;
  } catch (error) {
    console.warn('⚠️ Favorites: publish failed —', error);
    return false;
  }
}

/**
 * Read → merge → publish the shared list for this user.
 *
 * Serialized through `inFlight`: two concurrent cycles would each read the same
 * event and the loser's merge would be computed against a list the winner has
 * already replaced.
 *
 * **Returns the outcome, and callers must branch on it.** `runPull` awaits this
 * and then reports its own result; if it overwrites the status unconditionally
 * it erases a `degraded` set here, and the push is the half most likely to fail
 * — on first run it carries the user's entire existing library, and
 * `syncSharedFavorites` reports a refused publish or a signer timeout as
 * `failed` rather than throwing.
 */
export async function syncSharedFavoritesNow(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): Promise<'off' | 'ok' | 'degraded'> {
  if (!sharedFavoritesEnabledFor(opts.pubkey)) return 'off';
  if (inFlight) {
    await inFlight.catch(() => {});
  }
  const run = (async (): Promise<'ok' | 'degraded'> => {
    const relayUrls = resolveRelays(opts.relays);
    const local = await loadLocalItems(opts.userId);
    const published = await publishSingleList(opts.pubkey, local, relayUrls);

    // Report the write half through the SAME flag the read uses. This half is
    // the easier one to leave silent and the more surprising when it is: the
    // heart fills, the row is written locally, and nothing ever reaches the
    // shared list — indistinguishable from a favorite that synced.
    setSyncHealth('write', !published);
    return published ? 'ok' : 'degraded';
  })();

  inFlight = run;
  try {
    return await run;
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
export function pullSharedFavorites(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): Promise<PullResult> {
  if (!sharedFavoritesEnabledFor(opts.pubkey)) {
    setSyncStatus('off');
    return Promise.resolve({ status: 'off' });
  }
  // Single-flight: a double-tap on retry joins the run already going rather
  // than starting a second read-merge-publish cycle.
  //
  // Keyed on the pubkey, because joining is only correct for the SAME user. The
  // `NostrContext` effect re-fires when `user.relays` resolves, and an account
  // switch without a reload changes the pubkey — an unkeyed join would hand the
  // new account the previous one's result and status, and never run its pull.
  if (pullInFlight && pullInFlightPubkey === opts.pubkey) return pullInFlight;

  setSyncStatus('syncing');
  pullInFlightPubkey = opts.pubkey;
  // Every exit path must settle the status. A throw before the reconcile —
  // `fetchSharedFavorites` opens with a dynamic `import('nostr-tools/pool')`,
  // which rejects when the chunk isn't cached and the device is offline,
  // exactly the population the notice exists for — would otherwise leave it
  // pinned at 'syncing', which renders as nothing at all.
  const run = runPull(opts)
    .catch((error): PullResult => {
      console.warn('⚠️ Shared favorites: pull threw —', error);
      setSyncHealth('read', true);
      return { status: 'failed' };
    })
    .finally(() => {
      if (pullInFlight === run) {
        pullInFlight = null;
        pullInFlightPubkey = null;
      }
    });
  pullInFlight = run;
  return run;
}

async function runPull(opts: {
  userId: string;
  pubkey: string;
  relays?: string[];
}): Promise<PullResult> {
  const relayUrls = resolveRelays(opts.relays);
  const shared = await fetchSingleList(opts.pubkey, relayUrls);
  if (!shared.trustworthy) {
    console.warn('⚠️ Favorites: relay read was degraded — not reconciling');
    setSyncHealth('read', true);
    return { status: 'degraded' };
  }

  const { shows: allShows, tracks: allTracks } = partitionSingleList(shared);

  // Suppress our own in-flight removals before they can be reconciled BACK IN.
  //
  // The order in this function is pull → reconcile → push, and that ordering is
  // what makes this necessary rather than optional. An album unfavorited here
  // is deleted locally, but the list still carries it until the push lands; the
  // reconcile in between reads that stale entry, sees a group it is entitled to
  // treat as a favorite, and re-creates the row. The push then finds the album
  // local again, produces tags identical to what is already published, and the
  // digest gate skips it. Nothing ever propagates and the favorite returns on
  // every load — observed three times, most recently as a row re-created at
  // 22:36:18Z two minutes after being deleted.
  //
  // The published record is what tells the two apart, exactly as it does on the
  // write side: an entry we put on the list and no longer hold is our removal
  // in flight, not another app's addition. Anything we never published stays,
  // which is what keeps a genuine inbound favorite working.
  const { shows, tracks } = suppressOwnRemovals(
    { shows: allShows, tracks: allTracks },
    groupForSingleList(await loadLocalItems(opts.userId)),
    getPublishedRecord(opts.pubkey)
  );
  const suppressed = allShows.length - shows.length + (allTracks.length - tracks.length);
  if (suppressed > 0) {
    console.log(`↩️ Favorites: ignoring ${suppressed} entr(ies) this device has removed`);
  }

  try {
    const res = await fetch('/api/favorites/sync-shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nostr-user-id': opts.userId },
      // The baseline is always EMPTY, and permanently so: kind 10333 has no
      // baseline to keep. The route computes removals as `baseline − incoming`,
      // so an empty one means it may add but never delete — which is the only
      // safe reading of a format that cannot distinguish "another app removed
      // this" from "another app never had it". Inbound removals therefore do
      // not propagate; that is a property of the format, not a bug here.
      body: JSON.stringify({
        trustworthy: true,
        shows,
        tracks,
        baseline: [],
      }),
    });
    if (!res.ok) {
      // The reconcile request failed, so this device and the list are still
      // out of step — same user-visible situation as an unreachable relay.
      setSyncHealth('read', true);
      return { status: 'failed' };
    }
    const data = await res.json();

    // Push straight after a pull when this app holds favorites the list is
    // missing — on first run that is the user's entire existing library, which
    // otherwise wouldn't reach the other apps until they happened to toggle
    // something. `syncSharedFavoritesNow` sets the baseline correctly (its own
    // contribution only), so it is also what establishes the baseline on the
    // very first sync; a no-op push returns 'unchanged' and still records one.
    // Invalidate BEFORE the push, not after.
    //
    // The reconcile has already created or deleted rows on this user's behalf —
    // a favorite added in another app arrives here. The batched status cache
    // would otherwise keep serving the answer it recorded before that, and a
    // cached `false` is a KNOWN answer, so the heart would stay unfilled with
    // no request made until a hard reload (issue #190, via a different writer).
    // The push below can THROW — `loadLocalItems` is two bare fetches — and the
    // enclosing catch would then swallow this dispatch even though the rows
    // were already written. Order it against what has actually happened, not
    // against what is still to come. The route returns counts rather than ids,
    // so this clears rather than writing through.
    const changed =
      (data?.added?.albums ?? 0) + (data?.added?.tracks ?? 0) +
      (data?.removed?.albums ?? 0) + (data?.removed?.tracks ?? 0) > 0;
    if (changed && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(FAVORITE_STATUSES_INVALIDATED_EVENT));
    }

    // The push gets its own try: a throw here is a degraded WRITE, not a failed
    // reconcile, and must not discard the counts of a read that succeeded.
    let pushed: 'off' | 'ok' | 'degraded';
    try {
      pushed = await syncSharedFavoritesNow(opts);
    } catch (pushError) {
      console.warn('⚠️ Shared favorites: push threw —', pushError);
      setSyncHealth('write', true);
      pushed = 'degraded';
    }

    // Unknown feeds are imported server-side by the route itself (it already
    // has the guids and `addUnresolvedFeeds`); they land on a later pull.
    //
    // The read succeeded, so clear the read half regardless — but leave the
    // write half to `syncSharedFavoritesNow`, which has already recorded it.
    // An unconditional 'ok' here erased the push's 'degraded', and the push is
    // the half more likely to fail: on first run it ships the user's entire
    // existing library, and `syncSharedFavorites` reports a publish no relay
    // accepted — or a NIP-46 signer that timed out — as a status, not a throw.
    setSyncHealth('read', false);
    return {
      status: pushed === 'degraded' ? 'failed' : 'ok',
      added: data?.added,
      removed: data?.removed,
      unresolvedFeedGuids: data?.unresolved?.feedGuids ?? [],
    };
  } catch (error) {
    console.warn('⚠️ Shared favorites: reconcile request failed:', error);
    setSyncHealth('read', true);
    return { status: 'failed' };
  }
}

/** Re-exported so callers need only this module. */
export { fetchSingleList, partitionSingleList };
