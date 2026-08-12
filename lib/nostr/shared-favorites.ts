import type { Event, Filter } from 'nostr-tools';

/**
 * Cross-app favorites — one NIP-78 kind:30078 application-data event at the
 * app-neutral address `podcast:favorites`, shared with Boost Me Bitch and any
 * other app that implements the format.
 *
 * Full spec: docs/pc20-favorites.md (identical copy in the boostmebitch repo).
 * That document, not this file, is what a third app implements against — keep
 * the two in step.
 *
 * This is a SECOND channel, not a replacement. The per-item kind 30001 events
 * (`lib/nostr/favorites.ts`) stay exactly as they are: the Community tab reads
 * them, and its author-scoped filters and d-tag resolution ladder are tuned
 * against real production data.
 *
 * ---------------------------------------------------------------------------
 * The hazard, stated once
 *
 * kind:30078 is REPLACEABLE and this address has many writers. There is no
 * partial update — every publish replaces the whole event — so a writer that
 * publishes its own view of the list deletes whatever the other apps added.
 * Silently, on someone else's device, with no undo and no error.
 *
 * Hence: the only exported writer is `syncSharedFavorites`, which reads first
 * and refuses to publish on a degraded read. Everything below exists to make
 * that safe, and the pure half is unit-tested in shared-favorites.test.ts.
 * ---------------------------------------------------------------------------
 */

/**
 * The shared, app-neutral list address.
 *
 * **Kind 30078 (NIP-78 application data), NOT 30003 (NIP-51 bookmark sets)** —
 * and the difference is the whole reason this moved. Kind 30003 is *user-named
 * bookmark collections*: saved links and articles. Two things follow from
 * putting podcast favorites there, and both are bad:
 *
 *   - A generic Nostr client lists someone's podcast favorites among their
 *     bookmarks, which is the wrong category.
 *   - Any bookmark client that lets them EDIT a set will clobber this list. It
 *     has no baseline discipline and no reason to have one — 30003 is its to
 *     write, and its author is doing nothing wrong.
 *
 * 30078 is app-defined data at a `d`-addressed slot. No generic client renders
 * or rewrites it, which is exactly the property this needs. `nwc-backup.ts`
 * already publishes 30078 from this app, so relay acceptance is known-good.
 *
 * `content` stays empty and PUBLIC, unlike most 30078 events (the NWC backup
 * NIP-44 encrypts to self). A second app has to be able to read this one.
 */
export const SHARED_D_TAG = 'podcast:favorites';
export const SHARED_FAVORITES_KIND = 30078;

export const SHOW_PREFIX = 'podcast:guid:';
export const ITEM_PREFIX = 'podcast:item:guid:';

const LIST_TITLE = 'Podcast Favorites';

// Backstop for stragglers, matching the Community tab's budget. A replaceable
// event is one round trip; this is not the expected cost.
const RELAY_QUERY_TIMEOUT_MS = 5_000;

// Tags we rebuild from the item set on every publish. Anything else belongs to
// another writer and is preserved verbatim. `k` is only partly ours — see
// `otherTagsFrom`.
const MANAGED_TAGS = new Set(['d', 'title', 'i']);

/**
 * The NIP-73 identifier kinds Podcasting 2.0 defines. Longest first, so a kind
 * that is a prefix of another can't shadow it.
 *
 * This has to be a TABLE, not string-scanning. The obvious "everything before
 * the last colon" is wrong and fails silently: item guids are very often
 * permalink URLs, so `podcast:item:guid:https://example.com/ep/42` yields
 * `podcast:item:guid:https` — a `k` tag no relay filter will ever match, which
 * breaks discovery without breaking anything visible.
 */
const KNOWN_IDENTIFIER_KINDS = [
  'podcast:publisher:guid',
  'podcast:item:guid',
  'podcast:guid',
];

// Podcasting 2.0 <podcast:guid> is a UUID (v5 in spec, but tolerate any version).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One entry in the shared list: the raw NIP-73 identifier plus its optional
 * hints. The merge never interprets `id` — that happens at resolution time —
 * so another app's identifier kind survives a round trip through here.
 */
export interface SharedFavoriteItem {
  /** Full NIP-73 identifier, e.g. `podcast:guid:<uuid>`. The merge key. */
  id: string;
  /** NIP-73 optional URL hint (tag position 2): the feed's RSS URL. */
  feedUrl?: string;
  /** Additive extension (tag position 3): `podcast:guid:<feedGuid>` of an
   *  item's parent feed. PI's /episodes/byguid wants `podcastguid`, so an item
   *  guid on its own is not a reliable lookup. */
  feedRef?: string;
}

export interface SharedFavorites {
  /** Every `i` tag, in event order, including kinds we can't resolve. */
  items: SharedFavoriteItem[];
  /** Tags belonging to other writers, preserved verbatim on republish. */
  otherTags: string[][];
  /** unix seconds, from event.created_at. 0 when no event exists. */
  updatedAt: number;
  /** An event was found. */
  exists: boolean;
  /**
   * The read can be trusted. False means "nothing answered", NOT "the list is
   * empty" — never merge, publish, or reconcile deletions on top of a false
   * here, or a relay wobble wipes favorites across every app the user owns.
   */
  trustworthy: boolean;
}

// --- identifier helpers ----------------------------------------------------

export const showId = (feedGuid: string) => `${SHOW_PREFIX}${feedGuid}`;
export const itemId = (itemGuid: string) => `${ITEM_PREFIX}${itemGuid}`;

/** `podcast:guid:<uuid>` → uuid, or null when it isn't a readable show id. */
export function parseShowGuid(id: string): string | null {
  if (!id.startsWith(SHOW_PREFIX)) return null;
  const guid = id.slice(SHOW_PREFIX.length);
  return UUID_RE.test(guid) ? guid : null;
}

/** `podcast:item:guid:<guid>` → guid. Item guids are not UUID-constrained by
 *  the spec (any globally-unique string is legal), so this only strips. */
export function parseItemGuid(id: string): string | null {
  if (!id.startsWith(ITEM_PREFIX)) return null;
  const guid = id.slice(ITEM_PREFIX.length);
  return guid.length > 0 ? guid : null;
}

/** The `k` value for an identifier, or null when we don't recognize its kind. */
export function identifierKind(id: string): string | null {
  for (const kind of KNOWN_IDENTIFIER_KINDS) {
    if (id.startsWith(`${kind}:`)) return kind;
  }
  return null;
}

// --- pure read/write helpers ------------------------------------------------

/** Every `i` tag on an event, in order, deduped by identifier. */
export function itemsFromTags(tags: string[][]): SharedFavoriteItem[] {
  const items: SharedFavoriteItem[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (tag[0] !== 'i' || !tag[1]) continue;
    if (seen.has(tag[1])) continue; // a duplicate id is one favorite
    seen.add(tag[1]);
    items.push({
      id: tag[1],
      feedUrl: tag[2] || undefined,
      feedRef: tag[3] || undefined,
    });
  }
  return items;
}

/**
 * Tags belonging to other writers, to be replayed verbatim on republish.
 *
 * A `k` tag naming a kind we generate is ours and gets rebuilt. One naming a
 * kind we've never heard of belongs to whichever app wrote it — dropping it
 * would strip that app's `#k` discovery filter off the event every time this
 * one publishes.
 */
export function otherTagsFrom(tags: string[][]): string[][] {
  return tags.filter((t) => {
    if (MANAGED_TAGS.has(t[0])) return false;
    if (t[0] === 'k') return !!t[1] && !KNOWN_IDENTIFIER_KINDS.includes(t[1]);
    return true;
  });
}

/** Build the full tag set for a shared-favorites event. */
export function tagsForSharedFavorites(
  items: SharedFavoriteItem[],
  otherTags: string[][] = []
): string[][] {
  const tags: string[][] = [
    ['d', SHARED_D_TAG],
    ['title', LIST_TITLE],
    ...otherTags,
  ];
  const kinds = new Set<string>();
  for (const item of items) {
    // Position 2 is NIP-73's optional URL hint; position 3 is the parent-feed
    // extension. An empty string holds position 2 open when only the feed ref
    // is known — consumers read position 2 as "absent" either way.
    if (item.feedRef) tags.push(['i', item.id, item.feedUrl ?? '', item.feedRef]);
    else if (item.feedUrl) tags.push(['i', item.id, item.feedUrl]);
    else tags.push(['i', item.id]);
    const kind = identifierKind(item.id);
    if (kind) kinds.add(kind);
  }
  // One `k` per distinct identifier kind, not one per favorite.
  for (const kind of kinds) tags.push(['k', kind]);
  return tags;
}

// --- merging ---------------------------------------------------------------

/**
 * Apply this device's delta on top of a freshly-read list.
 *
 * `lastSynced` is the id list this device last agreed with the relay on. It is
 * what makes "another app added this while I was offline" distinguishable from
 * "I removed this" — without it, publishing the local set alone deletes every
 * entry this app didn't know about, and publishing the union alone makes
 * unfavoriting impossible.
 *
 *   adds    = local  - lastSynced   (mine, new)
 *   removes = lastSynced - local    (mine, deleted → must propagate)
 *   next    = (latest ∪ adds) - removes
 *
 * Order is stable: surviving `latest` entries keep their position and new local
 * entries are appended, so a republish doesn't churn the event for cosmetic
 * reasons.
 */
export function mergeSharedFavorites(args: {
  latest: SharedFavoriteItem[];
  lastSynced: string[];
  local: SharedFavoriteItem[];
}): SharedFavoriteItem[] {
  const { latest, lastSynced, local } = args;
  const localById = new Map(local.map((i) => [i.id, i]));
  const baseline = new Set(lastSynced);
  const removed = new Set(lastSynced.filter((id) => !localById.has(id)));

  const out: SharedFavoriteItem[] = [];
  const kept = new Set<string>();
  for (const item of latest) {
    if (removed.has(item.id)) continue;
    if (kept.has(item.id)) continue;
    kept.add(item.id);
    // Hints improve over time and cost nothing to upgrade, but an existing
    // hint is never blanked by a local entry that happens to lack one.
    const mine = localById.get(item.id);
    out.push(
      mine
        ? {
            id: item.id,
            feedUrl: mine.feedUrl ?? item.feedUrl,
            feedRef: mine.feedRef ?? item.feedRef,
          }
        : item
    );
  }
  for (const item of local) {
    if (kept.has(item.id)) continue;
    // In the baseline, but absent from `latest`: another app removed it while
    // this device still had it. Re-appending is the resurrection bug — the
    // user unfavorites in the other app, opens this one, and it comes back.
    // Only a genuine local ADD (not in the baseline) may be appended here.
    if (baseline.has(item.id)) continue;
    kept.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * The baseline to record after publishing — the ids THIS app contributed, not
 * the whole published list.
 *
 * `removes` is computed as `baseline − local`, and `local` only ever contains
 * entries this app can represent. So a baseline holding the full list puts
 * every foreign identifier — Boost Me Bitch's episode favorites, a third app's
 * publisher entries — into `removes` on the very next publish, and this app
 * deletes them. That is the exact opposite of the rule the format rests on,
 * and it fires on the second toggle, not the first.
 */
export function baselineFrom(
  published: SharedFavoriteItem[],
  local: SharedFavoriteItem[]
): string[] {
  const localIds = new Set(local.map((i) => i.id));
  return published.filter((i) => localIds.has(i.id)).map((i) => i.id);
}

/** Split a list into the things this app can look up. */
export function partitionSharedFavorites(items: SharedFavoriteItem[]): {
  shows: Array<{ feedGuid: string; feedUrl?: string }>;
  tracks: Array<{ itemGuid: string; feedGuid?: string; feedUrl?: string }>;
} {
  const shows: Array<{ feedGuid: string; feedUrl?: string }> = [];
  const tracks: Array<{ itemGuid: string; feedGuid?: string; feedUrl?: string }> = [];
  for (const item of items) {
    const feedGuid = parseShowGuid(item.id);
    if (feedGuid) {
      shows.push({ feedGuid, feedUrl: item.feedUrl });
      continue;
    }
    const itemGuid = parseItemGuid(item.id);
    if (itemGuid) {
      tracks.push({
        itemGuid,
        feedGuid: item.feedRef ? parseShowGuid(item.feedRef) ?? undefined : undefined,
        feedUrl: item.feedUrl,
      });
    }
    // Anything else — a malformed guid, a publisher, a kind we don't know —
    // is deliberately dropped HERE and nowhere else. It stays in `items`, so
    // the merge still carries it onto the wire.
  }
  return { shows, tracks };
}

// --- relay I/O -------------------------------------------------------------

/**
 * Read the shared list, reporting whether the absence of a result can be
 * trusted.
 *
 * Uses `subscribeMany` + `oneose` rather than `querySync`, which cannot tell
 * "every relay answered and none had it" from "nothing answered before the
 * timeout". That distinction is the difference between an empty list and a
 * wiped one. An outer `Promise.race` is worse than useless here for the same
 * reason it is in `nwc-backup.ts`: it discards events healthy relays already
 * returned.
 */
export async function fetchSharedFavorites(
  pubkey: string,
  relays: string[],
  timeoutMs = RELAY_QUERY_TIMEOUT_MS
): Promise<SharedFavorites> {
  const empty: SharedFavorites = {
    items: [],
    otherTags: [],
    updatedAt: 0,
    exists: false,
    trustworthy: false,
  };
  if (!pubkey || relays.length === 0) return empty;

  const { SimplePool } = await import('nostr-tools/pool');
  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [SHARED_FAVORITES_KIND],
    authors: [pubkey],
    '#d': [SHARED_D_TAG],
    limit: 1,
  };

  try {
    const { event, eosed } = await new Promise<{ event: Event | null; eosed: boolean }>(
      (resolve) => {
        let best: Event | null = null;
        let sawEose = false;
        let settled = false;
        let sub: { close: () => void } | null = null;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            sub?.close();
          } catch {
            /* already closed / never opened */
          }
          resolve({ event: best, eosed: sawEose });
        };

        const timer = setTimeout(finish, timeoutMs);
        try {
          sub = pool.subscribeMany(relays, filter, {
            onevent(e: Event) {
              if (!best || e.created_at > best.created_at) best = e;
            },
            oneose() {
              sawEose = true;
              finish();
            },
          });
        } catch {
          // subscribeMany threw before any relay was queried — the opposite of
          // trustworthy, so leave `sawEose` false.
          finish();
        }
      }
    );

    if (!event) {
      // An EOSE means every *reachable* relay confirmed it has nothing. A bare
      // timeout means we heard from nobody, which is not evidence of anything.
      return { ...empty, trustworthy: eosed };
    }
    return {
      items: itemsFromTags(event.tags),
      otherTags: otherTagsFrom(event.tags),
      updatedAt: event.created_at,
      exists: true,
      trustworthy: true, // an event in hand is its own proof the query worked
    };
  } catch {
    return empty;
  } finally {
    try {
      pool.close(relays);
    } catch {
      /* nothing to close */
    }
  }
}

export interface SyncSharedFavoritesArgs {
  pubkey: string;
  relays: string[];
  /** This app's current favorites, as wire items. */
  local: SharedFavoriteItem[];
  /** The id list this device last agreed with the relay on. */
  lastSynced: string[];
}

export interface SyncSharedFavoritesResult {
  status: 'published' | 'unchanged' | 'degraded' | 'failed';
  /** The caller's new baseline: the ids THIS app contributed, not the whole
   *  published list. Only meaningful for 'published' and 'unchanged'. */
  ids: string[];
  error?: string;
}

/**
 * Read → merge → publish, as one step. The read is what makes the write safe,
 * so they are never separated: a caller that could publish without reading is
 * a caller that can wipe another app's favorites.
 *
 * Returns 'degraded' without publishing when the read failed. Losing a
 * republish is recoverable — the next toggle or page load retries it — whereas
 * publishing over a list we couldn't read is not.
 */
export async function syncSharedFavorites(
  args: SyncSharedFavoritesArgs,
  signEvent: (template: {
    kind: number;
    tags: string[][];
    content: string;
    created_at: number;
  }) => Promise<Event>,
  publish: (event: Event) => Promise<boolean>
): Promise<SyncSharedFavoritesResult> {
  const latest = await fetchSharedFavorites(args.pubkey, args.relays);
  if (!latest.trustworthy) {
    console.warn('⚠️ Shared favorites: could not read the current list — not publishing');
    return { status: 'degraded', ids: [] };
  }

  const next = mergeSharedFavorites({
    latest: latest.items,
    lastSynced: args.lastSynced,
    local: args.local,
  });
  const nextIds = next.map((i) => i.id);
  // Only our own contribution goes into the baseline — see `baselineFrom`.
  const nextBaseline = baselineFrom(next, args.local);

  // A no-op republish on every page load would bump created_at for nothing and
  // race the user's other devices.
  const relayIds = latest.items.map((i) => i.id);
  if (relayIds.length === nextIds.length && relayIds.every((id, i) => id === nextIds[i])) {
    return { status: 'unchanged', ids: nextBaseline };
  }

  try {
    const signed = await signEvent({
      kind: SHARED_FAVORITES_KIND,
      tags: tagsForSharedFavorites(next, latest.otherTags),
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    });
    const ok = await publish(signed);
    if (!ok) return { status: 'failed', ids: [], error: 'no relay accepted the event' };
    return { status: 'published', ids: nextBaseline };
  } catch (error) {
    return {
      status: 'failed',
      ids: [],
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
