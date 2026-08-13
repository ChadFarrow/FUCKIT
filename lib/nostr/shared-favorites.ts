import type { Event, Filter } from 'nostr-tools';

/**
 * Cross-app favorites — one NIP-78 kind:30078 application-data event at the
 * app-neutral address `podcast:favorites`, shared with Boost Me Bitch and any
 * other app that implements the format.
 *
 * Full spec — the canonical, app-neutral copy, kept outside every implementing
 * repo so there is exactly one of it:
 * https://github.com/ChadFarrow/PC20-Nostr/blob/main/specs/pc20-favorites.md
 * That document, not this file, is what a third app implements against — keep
 * the two in step.
 *
 * ---------------------------------------------------------------------------
 * Where this DELIBERATELY lags the spec, and why
 *
 * The spec has since split the list in two (`podcast:favorites` for shows,
 * `podcast:favorites:items` for episodes and tracks), made tag position 3 a
 * bare uuid, and frozen position 2. This file does none of those yet, ON
 * PURPOSE — every one of them would currently make favorites LESS visible to
 * the app on the other end, which is the whole point of sharing a list:
 *
 *   - Boost Me Bitch reads only `d = podcast:favorites`
 *     (`lib/nostr/favorites-gate.ts`). Writing tracks to the items address
 *     would put them somewhere it never queries.
 *   - It resolves an item's parent feed with `parseShowGuid(item.feedRef)`
 *     (`lib/nostr/favorites-merge.ts`), which requires the `podcast:guid:`
 *     prefix. A bare position 3 makes its `feedGuid` undefined and breaks its
 *     episode lookups.
 *
 * So: single list, prefixed position 3, position 2 still written. Sequence
 * those changes in Boost Me Bitch first, then here. Do not "fix" this file to
 * match the spec on its own — that is the change that silently breaks the
 * other app.
 *
 * What IS adopted from the current spec is overlay-don't-rebuild (see
 * `tagForSharedFavorite`), because position 4 below cannot be added safely
 * without it.
 * ---------------------------------------------------------------------------
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

/** The identifier kind for episodes and tracks — the `k` value, no trailing
 *  colon. Named because placement depends on it: this kind belongs at
 *  `podcast:favorites:items`, and `mergeSharedFavorites` refuses to originate
 *  one here. */
export const ITEM_KIND = 'podcast:item:guid';
export const ITEM_PREFIX = `${ITEM_KIND}:`;

const LIST_TITLE = 'Podcast Favorites';

// Backstop for stragglers, matching the Community tab's budget. A replaceable
// event is one round trip; this is not the expected cost.
const RELAY_QUERY_TIMEOUT_MS = 5_000;

// Per-relay connect budget, deliberately well under the overall timeout: a dead
// relay must not be able to spend the whole window failing. Measured against the
// real default list, live relays connect and EOSE inside ~1s.
const CONNECT_TIMEOUT_MS = 2_000;

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
  ITEM_KIND,
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
  /**
   * Additive extension (tag position 4): the entry's Podcasting 2.0
   * `<podcast:medium>` — `music`, `podcast`, `audiobook`, and whatever the
   * namespace adds next. The vocabulary is NOT a closed set.
   *
   * Without it the list is undifferentiated: an album and a talk show are both
   * `podcast:guid:<uuid>`, so each app renders the other's favorites mixed into
   * its own, and the only way to tell them apart is to resolve all of them —
   * one Podcast Index request per entry, since /podcasts/byguid takes a single
   * guid. It is also the ONLY answer for an entry that no longer resolves at
   * all: a delisted feed cannot be categorized any other way.
   *
   * ADVISORY, and therefore sticky. It is a cache of what a reader could work
   * out for itself, it can go stale when a feed retags, and a value another app
   * wrote is never ours to correct — see `mergeSharedFavorites`. Absent means
   * "not told", which is NOT a default: this app guessing `music` is wrong for
   * exactly the half of the list the hint exists to separate.
   */
  medium?: string;
  /**
   * The `i` tag exactly as it was read, when this entry came off the wire.
   *
   * This is what makes positions past the ones above survive a republish. The
   * natural implementation — parse into a struct, merge the struct, write it
   * back out — deletes every position past the end of that struct, on every
   * entry, on every publish, with no error and nothing on screen. This app did
   * exactly that until position 4 existed to make it visible.
   *
   * Undefined for an entry this device is adding, which has no tail yet.
   */
  raw?: string[];
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
      medium: tag[4] || undefined,
      // Kept whole, including positions nothing here reads. See `raw`.
      raw: tag.slice(),
    });
  }
  return items;
}

/**
 * Rebuild one `i` tag by OVERLAYING onto the tag we read, index by index,
 * never truncating to the length of our own struct.
 *
 * Two rules, and both are about not destroying somebody else's data:
 *
 *   - **The tail survives.** Anything past the positions above belongs to an
 *     app newer than this one, and is copied through untouched.
 *   - **A non-empty value we didn't write is not ours to change.** Fill
 *     positions that are empty or absent; leave the rest alone even when we
 *     resolved a different value and are confident ours is better. "Prefer my
 *     own value" is what makes two apps rewrite the event against each other on
 *     every publish, forever, with neither wrong and neither converging.
 *     Stickiness terminates: after one publish the value stops moving.
 *
 * A position left empty while a later one is present is held open with an empty
 * string, never closed up — shifting a medium into position 3 would claim it as
 * a parent feed guid.
 */
export function tagForSharedFavorite(item: SharedFavoriteItem): string[] {
  const tag = item.raw ? item.raw.slice() : ['i', item.id];
  tag[0] = 'i';
  tag[1] = item.id;
  fillPosition(tag, 2, item.feedUrl);
  fillPosition(tag, 3, item.feedRef);
  fillPosition(tag, 4, item.medium);
  return tag;
}

function fillPosition(tag: string[], index: number, value: string | undefined): void {
  if (!value) return; // absent is not "clear it"
  if (tag[index]) return; // sticky: what is already there stays
  while (tag.length < index) tag.push('');
  tag[index] = value;
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
    tags.push(tagForSharedFavorite(item));
    // From position 1 ONLY. A `k` minted from position 4 would put `music` into
    // the `#k` discovery filter every app relies on — position 4 is a medium,
    // not an identifier kind, and it never changes what kind an entry is.
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
    // Membership is decided above, on raw identifier strings and nothing else.
    // This is the subordinate pass: it may fill an empty hint and may never
    // add, remove or re-key an entry.
    //
    // The wire value wins wherever it is non-empty, even against a value we
    // resolved ourselves. That asymmetry is the point — see
    // `tagForSharedFavorite`. `item.raw` rides along so the tail survives.
    const mine = localById.get(item.id);
    out.push(
      mine
        ? {
            id: item.id,
            feedUrl: item.feedUrl ?? mine.feedUrl,
            feedRef: item.feedRef ?? mine.feedRef,
            medium: item.medium ?? mine.medium,
            raw: item.raw,
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
    // ...and an item entry is never ORIGINATED here at all, whatever the
    // baseline says. This list is `podcast:favorites`, the spec's feeds
    // address; episodes and tracks belong at `podcast:favorites:items`, and
    // "writers must never originate an item entry there" is the rule that
    // keeps the two lists from fighting.
    //
    // This is not a style preference — it is load-bearing while this app still
    // writes only the one address. Boost Me Bitch migrated its 223 track
    // entries to the items list on 2026-08-13; every one of them is in this
    // app's baseline, so the pass that drops them from the baseline is
    // immediately followed by a pass that reads them as brand-new local adds
    // and puts them all back on the feeds list. The other app cannot undo that
    // — the entries are not in ITS baseline, so its own merge is forbidden to
    // touch them — and the entry then exists on both lists, which is the state
    // the spec describes as breaking unfavoriting permanently.
    //
    // Entries that ARRIVE on this list are a different matter and are carried
    // verbatim by the loop above: reading a legacy item entry is required,
    // originating one is forbidden.
    if (identifierKind(item.id) === ITEM_KIND) continue;
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

/**
 * A parent-feed reference (tag position 3) as a bare uuid, accepting BOTH the
 * prefixed `podcast:guid:<uuid>` form this app writes and the bare form the
 * current spec asks writers to move to.
 *
 * Handing a prefixed value to Podcast Index as `podcastguid` matches nothing,
 * so an app that treats position 3 as opaque renders the user's whole item
 * library as unresolved while republishing it faithfully.
 */
export function bareFeedGuid(feedRef: string | undefined): string | undefined {
  if (!feedRef) return undefined;
  const bare = feedRef.startsWith(SHOW_PREFIX) ? feedRef.slice(SHOW_PREFIX.length) : feedRef;
  return UUID_RE.test(bare) ? bare : undefined;
}

/** Split a list into the things this app can look up. */
export function partitionSharedFavorites(items: SharedFavoriteItem[]): {
  shows: Array<{ feedGuid: string; feedUrl?: string; medium?: string }>;
  tracks: Array<{ itemGuid: string; feedGuid?: string; feedUrl?: string; medium?: string }>;
} {
  const shows: Array<{ feedGuid: string; feedUrl?: string; medium?: string }> = [];
  const tracks: Array<{ itemGuid: string; feedGuid?: string; feedUrl?: string; medium?: string }> = [];
  for (const item of items) {
    const feedGuid = parseShowGuid(item.id);
    if (feedGuid) {
      shows.push({ feedGuid, feedUrl: item.feedUrl, medium: item.medium });
      continue;
    }
    const itemGuid = parseItemGuid(item.id);
    if (itemGuid) {
      tracks.push({
        itemGuid,
        feedGuid: bareFeedGuid(item.feedRef),
        feedUrl: item.feedUrl,
        // On an item entry this is the PARENT FEED's medium — Podcasting 2.0
        // has no per-item medium.
        medium: item.medium,
      });
    }
    // Anything else — a malformed guid, a publisher, a kind we don't know —
    // is deliberately dropped HERE and nowhere else. It stays in `items`, so
    // the merge still carries it onto the wire.
  }
  return { shows, tracks };
}

/**
 * Which of two candidate events should be treated as `latest` — the whole of
 * the read's trust decision, pulled out of the subscription closure so it can
 * be tested without a relay.
 *
 * Two rules, and the ORDER of them is the point:
 *
 *   1. An event whose author isn't the user never competes. This is DEFENCE IN
 *      DEPTH, not a hole being closed: nostr-tools already runs `verifyEvent`
 *      and `matchFilters` (which enforces `authors`) before our handler is
 *      reached, so a foreign event does not arrive here today. The check makes
 *      the invariant local rather than delegated to a library default that
 *      could be changed by a custom verifier or a version bump — and the spec
 *      asks for it explicitly.
 *   2. Otherwise the highest `created_at` wins — a relay that is merely behind,
 *      serving a real but stale version, looks exactly as reachable as one
 *      that is current.
 *
 * Rule 1 must be applied at INTAKE rather than to the winner. A foreign event
 * with a high `created_at` would otherwise take the `best` slot and displace
 * the genuine one, and rejecting it afterwards would discard the real list
 * along with it — turning a good read into an empty one, which is the exact
 * failure `trustworthy` exists to prevent. Pinned by a test.
 */
export function preferSharedFavoritesEvent(
  best: Event | null,
  candidate: Event,
  pubkey: string
): Event | null {
  if (candidate.pubkey !== pubkey) return best;
  if (!best || candidate.created_at > best.created_at) return candidate;
  return best;
}

// --- relay I/O -------------------------------------------------------------

/**
 * Read the shared list, reporting whether the absence of a result can be
 * trusted.
 *
 * `querySync` cannot tell "every relay answered and none had it" from "nothing
 * answered before the timeout", and that distinction is the difference between
 * an empty list and a wiped one. An outer `Promise.race` is worse than useless
 * for the same reason it is in `nwc-backup.ts`: it discards events healthy
 * relays already returned.
 *
 * ---------------------------------------------------------------------------
 * Why this subscribes PER RELAY instead of using `pool.subscribeMany`
 *
 * `subscribeMany`'s aggregate `oneose` cannot be used as evidence, because two
 * different non-answers are folded into it and both report as EOSE:
 *
 *   - **A synthesized EOSE.** `AbstractRelay.baseEoseTimeout` (4400ms in
 *     nostr-tools 2.x) fires `receivedEose()` on a TIMER when a relay never
 *     sends one. That is below the 5s default here, so a relay that accepted
 *     the socket and then said nothing at all used to read as `trustworthy`.
 *   - **A failed connection.** A relay that never connected also counts toward
 *     the aggregate — so with no network at all, every relay "EOSEs"
 *     immediately and an offline device reported `trustworthy` in ~19ms.
 *
 * Both were measured, and both are the precise failure this flag exists to
 * prevent: believing an empty read, merging local state on top of nothing, and
 * republishing a list stripped of every entry another app contributed.
 *
 * So a relay counts as having ANSWERED only when it (a) connected and (b) sent
 * a real EOSE inside our own window. `eoseTimeout` is pushed far beyond that
 * window so the library's synthetic one can never fire inside it.
 *
 * The bar is then: every relay we could actually reach said "I have nothing",
 * and there was at least one of them. A relay that is simply dead (the default
 * list carries one) drops out of the denominator rather than blocking the read;
 * a relay that hangs makes the read degraded, which is the conservative answer
 * — skipping a publish is retried on the next toggle, and clobbering another
 * app's favorites is not recoverable at all.
 *
 * Pinned by `shared-favorites.relay.test.ts`, which scripts relays that
 * misbehave in each of these ways.
 * ---------------------------------------------------------------------------
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

  const deadline = Date.now() + timeoutMs;
  let best: Event | null = null;
  let reached = 0; // relays that accepted a connection
  let answered = 0; // ...of those, the ones that sent a REAL eose in time

  try {
    await Promise.all(
      relays.map(async (url) => {
        let relay: any;
        try {
          relay = await (pool as any).ensureRelay(url, {
            // Capped well below the overall deadline on purpose. Sized to the
            // full remaining budget, a single dead relay in the list burns the
            // ENTIRE window before failing — the default list carries one, and
            // it turned a ~1s read into a 5s one on every page load. A relay
            // too slow to connect inside this is simply left out of the
            // denominator, which is the safe direction.
            connectionTimeout: Math.min(CONNECT_TIMEOUT_MS, Math.max(0, deadline - Date.now())),
          });
        } catch {
          // Never connected. Not an answer — and specifically NOT counted as
          // one, which is what made an offline device look trustworthy.
          return;
        }
        reached += 1;

        await new Promise<void>((resolve) => {
          let done = false;
          let sub: { close: () => void } | null = null;
          const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
              sub?.close();
            } catch {
              /* already closed */
            }
            resolve();
          };
          const timer = setTimeout(finish, Math.max(0, deadline - Date.now()));
          try {
            sub = relay.subscribe([filter], {
              // Just past our own deadline, so the library's synthetic EOSE can
              // never fire inside the window and pose as an answer. The margin
              // is deliberately SMALL: this schedules a real timer that
              // `close()` does not clear, so a large value leaves it pending
              // long after the read has returned (a 110s value here kept the
              // Node event loop alive for the full 110s, and would sit in a
              // browser tab just as long).
              eoseTimeout: timeoutMs + 1_000,
              onevent(e: Event) {
                // Author check + latest-wins, both in there. See the function.
                best = preferSharedFavoritesEvent(best, e, pubkey);
              },
              oneose() {
                answered += 1;
                finish();
              },
            });
          } catch {
            finish();
          }
        });
      })
    );

    const event = best as Event | null;
    if (!event) {
      // Trustworthy only if every relay we actually reached said "I have
      // nothing", and there was at least one. A bare timeout, a hung relay, or
      // no connectivity at all is not evidence of anything.
      return { ...empty, trustworthy: reached > 0 && answered === reached };
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
  //
  // Compares IDS ONLY, deliberately. Membership is the only thing worth a
  // publish; a hint we could now fill in is not. Widening this to notice a
  // missing medium would turn every hydration into "backfill hints onto the
  // shared list" — an unprompted write to a replaceable multi-writer event, run
  // by two apps at once, which is the shape of every failure this file guards
  // against. Hints ride along on a publish we were making anyway.
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
