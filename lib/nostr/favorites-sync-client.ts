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
  encodePrivateFavorites,
  fetchSingleList,
  groupForSingleList,
  partitionSingleList,
  plaintextBytes,
  suppressOwnRemovals,
  templateFromTags,
  PRIVATE_PLAINTEXT_MAX,
  type SingleList,
  type SingleListGroup,
} from './favorites-single-list';
import { RelayManager, resolvePublishRelays } from './relay';
import { FAVORITE_STATUSES_INVALIDATED_EVENT } from '../favorite-status-cache';
import { npubToPublicKey } from './keys';
import { isUsable, readPrivateHalf, type PrivateHalf } from './favorites-private-half';
import {
  EMPTY_BASELINE,
  parseBaseline,
  publishPlan,
  reconcileInput,
  seedModeFromWire,
  withdrawalPlan,
  type FavoritesPrivacy,
  type ListHalf,
  type PrivacyBaseline,
} from './favorites-privacy';
import { nip44Encrypt } from './nip44';

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
//
// Was 1500ms, chosen when the work behind it took seconds and the wait was
// hidden by it. Once the local load fell to ~95ms and the relay read to ~700ms,
// this became roughly two thirds of everything a user waits through before
// their signer even asks — so it was cut to the smallest value that still
// collapses the burst it exists for.
//
// 600ms is not arbitrary. The burst this must absorb is favoriting an ALBUM,
// which writes one FavoriteTrack per track: measured in production, three rows
// landed within 12ms of each other. That has two orders of magnitude of room
// here. What it no longer covers is a user deliberately favoriting separate
// albums less than 600ms apart, which costs a second prompt — and a prompt is
// the thing being spent, so do not shave this further without a reason as
// concrete as that 12ms.
const DEBOUNCE_MS = 600;

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

/**
 * Stage timings for one sync, emitted as a single line.
 *
 * The wait a user feels is the gap between the toggle and the signing prompt,
 * and it is made of a few independent pieces that each grow for different
 * reasons. Guessing which one grew is what this exists to stop: the first
 * investigation blamed the relays, and the relays were answering in under
 * 700ms — the cost was an API endpoint returning 50 track rows per favorited
 * feed to a caller that reads two fields.
 *
 * `time()` never alters the value or the rejection it wraps, so it can be
 * dropped around any await without changing behaviour.
 */
function stageTimer() {
  const t0 = performance.now();
  const stages: string[] = [];
  return {
    time<T>(label: string, p: Promise<T>): Promise<T> {
      const start = performance.now();
      const record = () => {
        stages.push(`${label} ${Math.round(performance.now() - start)}ms`);
      };
      return p.then(
        (value) => { record(); return value; },
        (error) => { record(); throw error; },
      );
    },
    log(prefix: string) {
      const total = Math.round(performance.now() - t0);
      // `console.warn`, NOT `console.log`. next.config.js strips `log` from
      // production builds and keeps only `error` and `warn`, so a `log` here is
      // absent from the one environment worth measuring — which is exactly how
      // this line failed the first time it was needed.
      console.warn(`⏱️ ${prefix}: ${stages.join(' · ')} · total ${total}ms`);
    },
  };
}

type StageTimer = ReturnType<typeof stageTimer>;

/**
 * The favorites this device holds, as portable identifiers.
 *
 * Deliberately NOT the endpoints `/favorites` renders from. Those resolve
 * publisher artwork through Podcast Index, count tracks, and include up to 50
 * full track rows per favorited feed — none of which survives
 * `buildLocalItems`, which keeps a guid, a medium and a type. That payload sat
 * directly in front of the signing prompt.
 *
 * `/api/favorites/sync-items` runs the same id ladders against the same rows
 * and selects only those fields. One request, no enrichment.
 */
async function loadLocalItems(userId: string): Promise<FavoriteEntry[]> {
  const headers = { 'x-nostr-user-id': userId };
  const res = await fetch('/api/favorites/sync-items', { headers });
  // THROW, never return an empty list. A publish replaces the event wholesale,
  // and the merge reads "published once, absent locally" as a removal — so a
  // failed request answered with `[]` would delete the user's entire shared
  // list, silently, on the next toggle. The caller turns this into a degraded
  // sync, which is the same answer a degraded relay read gets.
  if (!res.ok) throw new Error(`sync-items responded ${res.status}`);
  const payload = await res.json();
  return buildLocalItems(payload.albums ?? [], payload.tracks ?? []);
}

function resolveRelays(userRelays?: string[]): string[] {
  // Defaults are unioned in — a dead or AUTH-gated relay in a user's NIP-65 list
  // otherwise produces "published to 0 relays" — EXCEPT when the build is
  // pointed at a local relay, where the union would silently add the user's real
  // relays back and turn a local test into a real publish. See
  // `resolvePublishRelays`.
  return resolvePublishRelays(userRelays);
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
 * What this device last published, PER HALF, so the merge can tell an entry it
 * removed from an entry another app added. See `PrivacyBaseline`.
 *
 * Two records rather than one, because a public-to-private move is a removal on
 * one side and an addition on the other; against a single record those cancel
 * and the entry is deleted outright. `parseBaseline` reads the old
 * single-record shape as the PUBLIC half, which is true by construction.
 *
 * Anything unreadable reads as empty, which is the safe direction: an empty
 * record treats nothing as a removal and suppresses nothing.
 */
function getPublishedRecord(pubkey: string): PrivacyBaseline {
  if (typeof window === 'undefined' || !pubkey) return EMPTY_BASELINE;
  try {
    return parseBaseline(localStorage.getItem(`${SINGLE_LIST_PUBLISHED_PREFIX}:${pubkey}`));
  } catch {
    return EMPTY_BASELINE;
  }
}

/**
 * Record OUR contribution to what is now on the relays.
 *
 * Called on both paths out of a successful publish — the one that wrote an
 * event and the one that found the relays already holding it. Entries carried
 * on another app's behalf are deliberately absent, so they stay foreign next
 * time; recording them would invert the resurrection bug into a clobber.
 *
 * The baseline comes from `publishPlan`, NOT from local state here, and that is
 * the difference between the two halves: the active half's claims are backed by
 * local state next cycle, the inactive half's are not, so claiming what we
 * merely carried there deletes it on the following pass. See
 * `favorites-privacy.ts`, defect 3.
 */
function rememberPublished(pubkey: string, baseline: PrivacyBaseline): void {
  if (typeof window === 'undefined' || !pubkey) return;
  try {
    localStorage.setItem(`${SINGLE_LIST_PUBLISHED_PREFIX}:${pubkey}`, JSON.stringify(baseline));
  } catch {
    /* quota / private browsing — an empty record only costs a propagation */
  }
}

// ── the privacy mode ───────────────────────────────────────────────────────

const PRIVACY_MODE_PREFIX = 'sk_favorites_privacy';

/**
 * Where this device puts new favorites, or null when the user has not been
 * asked yet.
 *
 * Per-pubkey and per-device. It is a local preference about what this app does,
 * not a claim about the account — a second device answers for itself, and
 * `seedFavoritesMode` reads the answer off the wire so it usually does not have
 * to ask at all.
 */
export function getFavoritesPrivacy(pubkey: string): FavoritesPrivacy | null {
  if (typeof window === 'undefined' || !pubkey) return null;
  const raw = localStorage.getItem(`${PRIVACY_MODE_PREFIX}:${pubkey}`);
  return raw === 'public' || raw === 'private' || raw === 'off' ? raw : null;
}

export function setFavoritesPrivacy(pubkey: string, mode: FavoritesPrivacy): void {
  if (typeof window === 'undefined' || !pubkey) return;
  try {
    localStorage.setItem(`${PRIVACY_MODE_PREFIX}:${pubkey}`, mode);
    window.dispatchEvent(new CustomEvent(FAVORITES_PRIVACY_CHANGED_EVENT, { detail: { mode } }));
  } catch {
    /* private browsing — the mode falls back to asking again, which is safe */
  }
}

/** Dispatched when the mode changes, so the page can re-render without a reload. */
export const FAVORITES_PRIVACY_CHANGED_EVENT = 'favorites-privacy-changed';

const STRANDED_PREFIX = 'sk_favorites_stranded';

/**
 * How many entries a switch to private left in the public half.
 *
 * They belong to another app, and until every reader can render the private
 * half this build carries them where they are rather than moving them — see
 * `WHOLE_LIST_PRIVACY_MOVE`. The count is kept so the UI can say so out loud.
 * Silence here is the actual defect: a user who chose Private and got most of
 * it, with nothing on screen naming the rest, has been told something untrue by
 * omission.
 */
function setStranded(pubkey: string, count: number): void {
  if (typeof window === 'undefined' || !pubkey) return;
  try {
    localStorage.setItem(`${STRANDED_PREFIX}:${pubkey}`, String(count));
    window.dispatchEvent(new CustomEvent(FAVORITES_PRIVACY_CHANGED_EVENT, { detail: { count } }));
  } catch {
    /* private browsing — the count is a nicety, the carry is not */
  }
}

export function getStrandedCount(pubkey: string): number {
  if (typeof window === 'undefined' || !pubkey) return 0;
  const raw = localStorage.getItem(`${STRANDED_PREFIX}:${pubkey}`);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Which half this publish writes into — or `'off'`, meaning do not publish.
 *
 * Three ways to get `'off'`, and only one of them is the user opting out:
 *
 *   - they chose "not on Nostr", which is the real opt-out;
 *   - they have not been asked yet AND the wire cannot answer for them;
 *   - they would have to be asked, and asking is the UI's job, not this one's.
 *
 * The seeding is what stops the question being asked of someone who already has
 * a list, and it is delegated to `seedModeFromWire` because getting it wrong
 * FAILS OPEN — see that function. Each half answers only for itself: a device
 * that guessed `'public'` over a private account would paint the decrypted
 * entries into its store and republish every one as a plaintext, relay-indexed
 * tag. That is a disclosure, so an ambiguous wire has to mean "ask", and until
 * the user answers this device publishes nothing.
 *
 * A seeded answer is WRITTEN DOWN, so the wire is consulted once rather than on
 * every sync. Re-deriving it each time would flip a device's mode the moment
 * another app added an entry to the other half.
 */
function resolveMode(pubkey: string, read: SingleList, privateHalf: PrivateHalf): FavoritesPrivacy {
  const stored = getFavoritesPrivacy(pubkey);
  if (stored) return stored;

  // Never seed from a half we could not read: "no private entries" and "the
  // private entries are unreadable" are the same bytes to `seedModeFromWire`,
  // and the second one would seed `'public'` over a private account.
  if (!isUsable(privateHalf)) return 'off';

  const hasPublic = read.groups.length > 0 || read.orphanItemGuids.length > 0;
  const hasPrivate = privateHalf.list.groups.length > 0 || privateHalf.list.orphanItemGuids.length > 0;

  const seeded = seedModeFromWire(hasPublic, hasPrivate);
  if (!seeded) return 'off';
  setFavoritesPrivacy(pubkey, seeded);
  console.log(`ℹ️ Favorites: adopted ${seeded} mode from the list already on the relays`);
  return seeded;
}

/** Whether the user still owes us an answer, for the UI to ask at the right time. */
export function needsPrivacyAnswer(pubkey: string): boolean {
  return sharedFavoritesEnabledFor(pubkey) && getFavoritesPrivacy(pubkey) === null;
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
 * The tags are rendered from `merged.nodes`, NOT from `merged.groups`. The
 * group list is a projection holding only what this app can model; the node
 * list is what also carries the entries it cannot — foreign tag types, foreign
 * `k` values, publisher entries, malformed guids — whole and in position.
 * Rendering the projection here compiles and silently deletes all of them.
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
  relayUrls: string[],
  read: SingleList,
  privateHalf: PrivateHalf,
  mode: ListHalf,
  timer?: StageTimer
): Promise<boolean> {
  try {
    // Read first, ALWAYS. Publishing replaces the event wholesale, so a publish
    // on top of a read that failed silently is the most expensive mistake this
    // format allows — one bad read, republished, is the entire list gone. A
    // skipped publish is retried on the next toggle; this is not recoverable.
    //
    // The read is now STARTED by the caller, beside the local load it does not
    // depend on, and handed in here already settled. Only its start moved: it
    // is still complete before the merge below and before anything is signed or
    // published, and a degraded one still bails before either.
    if (!read.trustworthy) {
      console.warn('⚠️ Favorites: relay read was degraded — not publishing');
      return false;
    }

    // A private half we could not read is a degraded read of the SAME kind, and
    // gets the same answer. We hold the ciphertext and could put it back — but
    // the merge below would still be deriving the public half from a list whose
    // other half is unknown, and in private mode we would be replacing entries
    // we never saw with an empty array. Carry, publish nothing, say so.
    if (!isUsable(privateHalf)) {
      console.warn(
        `⚠️ Favorites: the private half is ${privateHalf.status} — not publishing`
      );
      return false;
    }

    const localGroups = groupForSingleList(local);
    const plan = publishPlan({
      mode,
      publicRead: read,
      privateRead: privateHalf.list,
      local: localGroups,
      baseline: getPublishedRecord(pubkey),
    });

    // THE DIGEST IS OVER BOTH HALVES, AND OVER THE PRIVATE HALF'S TAGS RATHER
    // THAN ITS CIPHERTEXT. NIP-44 draws a fresh nonce per encryption, so the
    // same entries encrypt to different bytes every time — a digest over
    // ciphertext never matches, every load republishes, and two apps rewrite
    // the event against each other forever with no symptom but that it never
    // stops.
    //
    // Computed on the MERGED output, not on local state. On local state it
    // would never notice a foreign entry arriving, so a group another app added
    // would sit unreplicated until this device's own favorites happened to
    // change.
    const digest = JSON.stringify([plan.tags, plan.privateTags]);
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
      rememberPublished(pubkey, plan.baseline);
      return true;
    }

    const content = await buildContent(pubkey, plan.privateTags, privateHalf, timer);
    if (content === null) return false;

    const template = templateFromTags(plan.tags, Math.floor(Date.now() / 1000), content);
    const signed = timer
      ? await timer.time('sign', signSharedEvent(template))
      : await signSharedEvent(template);
    const ok = timer
      ? await timer.time('publish', publishToRelays(signed, relayUrls))
      : await publishToRelays(signed, relayUrls);
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
      rememberPublished(pubkey, plan.baseline);
    }
    const entries = signed.tags.filter((t: string[]) => t[0] === 'i').length;
    const hidden = plan.privateTags?.filter((t) => t[0] === 'i').length ?? 0;
    console.log(
      `✅ Favorites: published ${entries} public and ${hidden} private entries (kind 10333)`
    );
    // Entries a switch to private could NOT move, because another app wrote
    // them and this build cannot move them yet. Recorded for the UI rather than
    // only logged: a user who chose Private and got 97% of it has to be told
    // which part is still public, or the app has quietly not kept a promise.
    setStranded(pubkey, plan.strandedInPublicHalf);
    return true;
  } catch (error) {
    console.warn('⚠️ Favorites: publish failed —', error);
    return false;
  }
}

/**
 * What `content` must be for this publish: the ciphertext we read, or a fresh
 * encryption of the private half.
 *
 * Returns null to ABORT the publish. An empty string would be a valid `content`
 * and a catastrophic one, so a failure here must never fall through to it.
 *
 * Re-encrypting an unchanged half is unavoidable whenever the public half
 * changed — one event, one `content` — and it is why the digest above compares
 * plaintext. It costs one signer round trip, which on a remote signer is a
 * second prompt on the user's phone.
 */
async function buildContent(
  pubkey: string,
  privateTags: string[][] | null,
  privateHalf: PrivateHalf,
  timer?: StageTimer
): Promise<string | null> {
  // Nothing in the private half and nothing was ever there: `content` stays as
  // we found it, which for a list that never had one is the empty string.
  const hasEntries = !!privateTags?.some((t) => t[0] === 'i');
  if (!hasEntries && privateHalf.status === 'none') return '';

  // Entries dropped to zero on a half that DID exist. Publishing `''` here is
  // correct and is the only place it is: the user emptied their private list,
  // and the alternative — carrying the old ciphertext — resurrects it.
  if (!hasEntries && privateHalf.status === 'readable') return '';

  if (!privateTags) return privateHalf.ciphertext;

  const plaintext = encodePrivateFavorites(privateTags);
  const bytes = plaintextBytes(plaintext);
  if (bytes > PRIVATE_PLAINTEXT_MAX) {
    // Refuse rather than publish something a conforming reader may reject.
    // NIP-44 v2 as first published capped plaintext at 65535 bytes, and a
    // library built to that text rejects anything past it — which reads as an
    // empty private list, not as an error, in whichever app hits it.
    console.warn(
      `⚠️ Favorites: the private half is ${bytes} bytes, over the ${PRIVATE_PLAINTEXT_MAX} limit — not publishing`
    );
    return null;
  }

  try {
    return timer
      ? await timer.time('encrypt', nip44Encrypt(pubkey, plaintext))
      : await nip44Encrypt(pubkey, plaintext);
  } catch (error) {
    console.warn('⚠️ Favorites: could not encrypt the private half —', error);
    return null;
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
    const timer = stageTimer();
    const relayUrls = resolveRelays(opts.relays);

    // Started together, because neither needs the other: the read is keyed on
    // the pubkey and the relay list, both known here, and the local load is a
    // request to our own API. Serialized, the relay read waited out an API
    // round trip for nothing — and every millisecond here is a millisecond
    // before the user is asked to sign.
    //
    // Both are caught. `publishSingleList` used to own the read and swallow
    // everything it threw; hoisting the read out here moved that exit path, and
    // an escaping throw would leave the status pinned at 'syncing', which
    // renders as nothing at all. Neither failure may publish: an empty local
    // list and an unread event each republish to a deleted list.
    let local: FavoriteEntry[];
    let read: SingleList;
    try {
      [local, read] = await Promise.all([
        timer.time('local', loadLocalItems(opts.userId)),
        timer.time('read', fetchSingleList(opts.pubkey, relayUrls)),
      ]);
    } catch (error) {
      console.warn('⚠️ Favorites: could not load what to publish —', error);
      setSyncHealth('write', true);
      timer.log('favorites sync (failed)');
      return 'degraded';
    }

    // Decrypting is a SECOND signer round trip on a remote signer, so it runs
    // only once the read has actually come back with something in `content`.
    // `readPrivateHalf` short-circuits an empty one without touching the signer.
    const privateHalf = await timer.time('decrypt', readPrivateHalf(opts.pubkey, read.content));

    // Which half new favorites go into. `resolveMode` answers 'off' for a user
    // who opted out and for one who has not been asked yet — neither may
    // publish, and the second is why the question is asked before the first
    // favorite rather than after it.
    const mode = resolveMode(opts.pubkey, read, privateHalf);
    if (mode === 'off') {
      timer.log('favorites sync (mode off)');
      return 'ok';
    }

    const published = await publishSingleList(
      opts.pubkey,
      local,
      relayUrls,
      read,
      privateHalf,
      mode,
      timer
    );
    timer.log('favorites sync');

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
/**
 * Leave Nostr: take down what THIS DEVICE put on the list, and nothing else.
 *
 * Publishes once and then stops. Both halves are merged against their own
 * claims with no local state, so every entry this device contributed goes and
 * every entry another app added stays — a withdrawal is not a delete button for
 * the account, and there is no way to make it one that would be honest.
 *
 * The mode is set to `'off'` FIRST, so a failure part-way through leaves the
 * device not publishing rather than publishing as before. Losing the withdrawal
 * costs one retry; a device that keeps syncing after the user said stop is the
 * failure that matters.
 *
 * Declining to withdraw is a real choice and the caller must offer it: the
 * relay copy simply stays, and a relay cannot be asked to forget.
 */
export async function withdrawFromSharedFavorites(opts: {
  pubkey: string;
  relays?: string[];
}): Promise<'ok' | 'degraded' | 'nothing-to-do'> {
  setFavoritesPrivacy(opts.pubkey, 'off');

  const relayUrls = resolveRelays(opts.relays);
  const read = await fetchSingleList(opts.pubkey, relayUrls);
  if (!read.trustworthy) {
    console.warn('⚠️ Favorites: relay read was degraded — not withdrawing');
    setSyncHealth('write', true);
    return 'degraded';
  }
  if (!read.exists) return 'nothing-to-do';

  const privateHalf = await readPrivateHalf(opts.pubkey, read.content);
  if (!isUsable(privateHalf)) {
    // Withdrawing over an unreadable private half would replace someone's
    // private entries with an empty array — the exact loss this whole path
    // exists to avoid causing on another app's behalf.
    console.warn(`⚠️ Favorites: the private half is ${privateHalf.status} — not withdrawing`);
    setSyncHealth('write', true);
    return 'degraded';
  }

  const baseline = getPublishedRecord(opts.pubkey);
  const plan = withdrawalPlan({
    publicRead: read,
    privateRead: privateHalf.list,
    baseline,
  });

  const content = await buildContent(opts.pubkey, plan.privateTags, privateHalf);
  if (content === null) {
    setSyncHealth('write', true);
    return 'degraded';
  }

  try {
    const template = templateFromTags(plan.tags, Math.floor(Date.now() / 1000), content);
    const signed = await signSharedEvent(template);
    if (!(await publishToRelays(signed, relayUrls))) {
      setSyncHealth('write', true);
      return 'degraded';
    }
  } catch (error) {
    console.warn('⚠️ Favorites: withdrawal failed —', error);
    setSyncHealth('write', true);
    return 'degraded';
  }

  // Claims nothing in either half now, so re-opting-in later starts clean
  // rather than immediately treating another app's entries as its own removals.
  rememberPublished(opts.pubkey, plan.baseline);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`${SINGLE_LIST_DIGEST_PREFIX}:${opts.pubkey}`);
    } catch {
      /* private browsing — costs one redundant publish if they opt back in */
    }
  }
  const left = plan.tags.filter((t) => t[0] === 'i').length;
  console.log(`✅ Favorites: withdrew this device's entries, ${left} left from other apps`);
  return 'ok';
}

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

  // The private half, decrypted. An unreadable one is a degraded read of the
  // same kind as an unreachable relay, and gets the same answer — because
  // reconciling from a half we could not read would drop every private favorite
  // from this device's view and then, on the push that follows, off the list.
  const privateHalf = await readPrivateHalf(opts.pubkey, shared.content);
  if (!isUsable(privateHalf)) {
    console.warn(`⚠️ Favorites: the private half is ${privateHalf.status} — not reconciling`);
    setSyncHealth('read', true);
    return { status: 'degraded' };
  }

  const baseline = getPublishedRecord(opts.pubkey);
  const mode = resolveMode(opts.pubkey, shared, privateHalf);

  // WHAT THE RECONCILE MAY SEE: the active half whole, plus only the part of
  // the inactive half this device claims.
  //
  // The filter is a disclosure rule, not tidiness. Local state writes through
  // and is read back as `local`, which goes wholly into the ACTIVE half — so an
  // entry adopted out of the other one is republished into this one. For our
  // own entries that is how a mode switch completes, and they have to be here
  // or they vanish from the page between the switch and the publish. For
  // another writer's it is a migration nobody asked for, and private→public it
  // discloses a favorite they chose to hide, because relays index `i`.
  //
  // `mode === 'off'` means nothing is active: the user opted out, or has not
  // been asked. Reconciling then would adopt entries this device may be about
  // to withdraw, so it reads the public half only and claims nothing.
  const scoped =
    mode === 'off'
      ? { groups: shared.groups, orphanItemGuids: shared.orphanItemGuids }
      : reconcileInput({
          mode,
          publicRead: shared,
          privateRead: privateHalf.list,
          baseline,
        });

  const { shows: allShows, tracks: allTracks } = partitionSingleList(scoped);

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
    // The half this device is feeding. A removal in flight is a removal from
    // the ACTIVE half — the inactive half's claims are what a mode switch is
    // still taking down, and treating those as in-flight removals here would
    // suppress the very entries the switch is moving.
    mode === 'off' ? baseline.public : baseline[mode]
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
