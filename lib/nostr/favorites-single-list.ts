/**
 * The single-list favorites format — kind 10333, "PC 2.0 Favorites".
 *
 * Spec: github.com/ChadFarrow/PC20-Nostr, `pc20-favorites.md`. It
 * replaces the two-list kind:30078 format, which proved overcomplicated: one
 * plain (non-`d`-tagged) replaceable event, `i` tags grouped under a running
 * `medium`, no baseline and no merge. Republishing the whole tag list IS the
 * sync. Podcasting 2.0 data, shared over Nostr.
 *
 * ---------------------------------------------------------------------------
 * The one thing to understand before editing: placement is POSITIONAL
 *
 * A `podcast:item:guid` entry carries no parent of its own. It belongs to the
 * feed group most recently opened above it, and to the medium most recently
 * declared above that. Both facts live in tag ORDER rather than in the tag, so
 * reordering the output is not cosmetic — it re-parents entries and re-labels
 * media, and it does so while leaving the event perfectly well-formed.
 *
 * Three consequences, all properties of the format rather than choices here:
 *
 *   - **A feed group is opened for every parent of a favorited track**, whether
 *     or not the feed is itself favorited, because there is no other way to say
 *     which feed a track came from. Measured on real data: 82 favorited feeds,
 *     159 distinct parents, 196 groups. Resolving the guids and deciding what
 *     to show is the consuming app's job — they are the standard Podcasting 2.0
 *     identifiers and any PC 2.0 app knows what they are.
 *   - **Unfavoriting a feed while a track of it stays favorited is invisible.**
 *     The placement group and the favorite are the same bytes, so the removal
 *     cannot be expressed until the last track goes too. Pinned by a test.
 *   - **A track whose parent feed has no `<podcast:guid>` cannot be expressed**
 *     and is dropped on write. The two-list format could carry it parentless;
 *     this one cannot. No favorite is in that state today, and the fix is an
 *     admin reparse to populate `Feed.guid`, not an invented parent.
 * ---------------------------------------------------------------------------
 *
 * `k` tags are ONE PER DISTINCT KIND, trailing — the spec's rule since PC20-Nostr
 * #8, which this implementation drove: the paired form cost 423 tags holding two
 * distinct values on the first real event, ~11 KB of 36 KB. An earlier revision
 * paired a `k` with every `i`, so the reader accepts BOTH forms and takes an
 * entry's kind from position 1, never from an adjacent tag. A reader that walks
 * `i`/`k` in pairs sees an empty library rather than an error.
 */

import type { Filter } from 'nostr-tools';

import {
  ITEM_KIND,
  SHOW_KIND,
  bareFeedGuid,
  identifierKind,
  itemId,
  parseItemGuid,
  parseShowGuid,
  showId,
  type FavoriteEntry,
} from './pc20-identifiers';
import { readReplaceableEvent } from './relay-read';

/**
 * Self-assigned, and unclaimed in the NIPs registry as of 2026-08-13.
 *
 * NIP-51's kind 10054 "Favorite podcasts list" is the nearest registered thing
 * and cannot express this: it holds only `p` (NIP-F4 podcast pubkeys) and `url`
 * tags, so it has no way to name a feed by `<podcast:guid>` and no concept of
 * an episode or track at all.
 */
export const SINGLE_LIST_KIND = 10333;

/** NIP-31 `alt`, so a generic client renders something rather than nothing. */
export const LIST_ALT = 'PC 2.0 Favorites';

/** One feed and the favorited items beneath it. */
export interface SingleListGroup {
  feedGuid: string;
  /** `<podcast:medium>` as the feed declared it, or undefined when it declared
   *  none. NEVER defaulted — see `buildSingleListTags` and `parseSingleList`. */
  medium?: string;
  itemGuids: string[];
  /** Whether the feed itself is favorited, as opposed to the group existing
   *  only to place an item. Not expressible on the wire — see the header — so
   *  it is meaningful on the way OUT and always false on the way back IN. */
  favorited: boolean;
}

export interface SingleList {
  groups: SingleListGroup[];
  /** Items that appeared before any feed group. This app never writes them;
   *  another writer might, and dropping them would lose favorites. */
  orphanItemGuids: string[];
  updatedAt: number;
  exists: boolean;
  /** See `TrustedRead` — false means "nothing answered", not "no favorites". */
  trustworthy: boolean;
}

// --- writing ---------------------------------------------------------------

/**
 * Collapse a flat favorites list into feed groups, preserving first-appearance
 * order — which is what makes a republish byte-identical when nothing changed.
 */
export function groupForSingleList(items: FavoriteEntry[]): SingleListGroup[] {
  const groups = new Map<string, SingleListGroup>();

  const ensure = (feedGuid: string, medium?: string): SingleListGroup => {
    const existing = groups.get(feedGuid);
    if (existing) {
      // A group opened by a track carries the parent feed's medium; the album
      // entry for the same feed carries its own. They come from one column, so
      // this only fills a gap — it never overwrites an answer with another.
      if (!existing.medium && medium) existing.medium = medium;
      return existing;
    }
    const created: SingleListGroup = { feedGuid, medium, itemGuids: [], favorited: false };
    groups.set(feedGuid, created);
    return created;
  };

  for (const item of items) {
    const feedGuid = parseShowGuid(item.id);
    if (feedGuid) {
      ensure(feedGuid, item.medium).favorited = true;
      continue;
    }

    const itemGuid = parseItemGuid(item.id);
    if (!itemGuid) continue; // an identifier kind this format has no place for

    // The parent arrives prefixed from this app and bare from writers on the
    // newer revisions; `bareFeedGuid` accepts both and rejects anything else.
    const parent = bareFeedGuid(item.feedRef);
    if (!parent) continue; // unplaceable — see the header

    const group = ensure(parent, item.medium);
    if (!group.itemGuids.includes(itemGuid)) group.itemGuids.push(itemGuid);
  }

  return [...groups.values()];
}

/**
 * The full tag list for the event.
 *
 * Groups whose medium is unknown are emitted FIRST, ahead of any `medium` tag.
 * The spec reads those as `podcast`, which is a guess — but every alternative
 * is worse: appending them puts them under whatever medium was declared last,
 * and inventing a `["medium", "unknown"]` tag writes a value no reader has been
 * told about. The spec is explicit that the medium is a display hint and that a
 * Podcast Index lookup wins where it disagrees, so this is the one position
 * where being wrong is recoverable. What must never happen is publishing
 * `Feed.type` here: it defaults to "album" and would make the guess look
 * authoritative.
 */
export function buildSingleListTags(items: FavoriteEntry[]): string[][] {
  return tagsFromGroups(groupForSingleList(items), []);
}

/**
 * Render ordered groups as tags.
 *
 * Group ORDER is the caller's to decide and is preserved within each medium
 * block — that is what lets `mergeSingleList` keep the order it read and append
 * new entries at the end of their block, as the spec asks.
 *
 * Where the spec's two ordering rules conflict — "preserve the order you read"
 * and "keep same-medium feeds contiguous" — contiguity wins. A foreign writer
 * interleaving media would otherwise force us to choose between reordering
 * (harmless: items always follow their own group, so nothing is reattached) and
 * emitting a layout that silently re-labels every entry after the first
 * boundary. Reordering within a block costs nothing; breaking contiguity
 * corrupts.
 */
export function tagsFromGroups(
  groups: SingleListGroup[],
  orphanItemGuids: string[]
): string[][] {
  const tags: string[][] = [['alt', LIST_ALT]];
  const kinds = new Set<string>();

  // Ahead of every group, so they are still orphans when read back. This app
  // never originates one; it re-emits what another writer left.
  for (const guid of orphanItemGuids) {
    const id = itemId(guid);
    if (!identifierKind(id)) continue;
    tags.push(['i', id]);
    kinds.add(ITEM_KIND);
  }

  const emit = (group: SingleListGroup) => {
    const feed = showId(group.feedGuid);
    if (identifierKind(feed)) {
      tags.push(['i', feed]);
      kinds.add(SHOW_KIND);
    }
    for (const guid of group.itemGuids) {
      const id = itemId(guid);
      // From position 1 ONLY, and via the kinds table rather than a scan: item
      // guids are routinely permalink URLs, so "everything before the last
      // colon" yields `podcast:item:guid:https` — a `k` no relay filter
      // matches, which breaks discovery with nothing visibly wrong.
      if (!identifierKind(id)) continue;
      tags.push(['i', id]);
      kinds.add(ITEM_KIND);
    }
  };

  for (const group of groups) {
    if (!group.medium) emit(group);
  }

  // First-appearance order, so the grouping is stable across republishes.
  const mediums: string[] = [];
  for (const group of groups) {
    if (group.medium && !mediums.includes(group.medium)) mediums.push(group.medium);
  }

  for (const medium of mediums) {
    tags.push(['medium', medium]);
    // Same-medium feeds must stay contiguous: the tag applies to everything
    // that follows it, so interleaving media would silently re-label entries.
    for (const group of groups) {
      if (group.medium === medium) emit(group);
    }
  }

  // Trailing, and one per distinct kind. Safe to append because `k` takes no
  // part in grouping — only `i` and `medium` are positional.
  for (const kind of kinds) tags.push(['k', kind]);

  return tags;
}

/**
 * What THIS DEVICE last put on the list.
 *
 * Not a wire concept and not the kind:30078 baseline coming back — nothing
 * about the event changes. It is this app remembering which identifiers it
 * published, which is the only way to answer the question the format cannot:
 * an entry on the list that we do not hold locally is either something another
 * app added or something we just removed, and those need opposite treatment.
 *
 * Empty means "this device has never agreed to anything", so it may not treat
 * anything as a removal — the conservative direction, and the same rule the
 * predecessor used for an absent baseline.
 */
export interface PublishedRecord {
  feeds: string[];
  items: string[];
}

const EMPTY_PUBLISHED: PublishedRecord = { feeds: [], items: [] };

/** The record to store after a successful publish: OUR contribution only.
 *  Entries carried on another app's behalf must stay foreign next time. */
export function publishedRecordFrom(local: SingleListGroup[]): PublishedRecord {
  return {
    feeds: local.map((g) => g.feedGuid),
    items: local.flatMap((g) => g.itemGuids),
  };
}

/**
 * Merge what we hold onto what the relays hold — the read-then-carry pass.
 *
 * There is no baseline in this format, so this is not the 30078 merge and does
 * not try to be. It answers one question per entry: is this ours to manage?
 *
 *   - **A feed group we hold** is emitted from LOCAL state, in the position it
 *     was read. Its items are ours, so an unfavorite still propagates.
 *   - **A feed group we don't hold** is carried verbatim, with its items. This
 *     is the spec's "don't clobber entries the writing app doesn't understand",
 *     and without it every publish deletes whatever the other app holds alone.
 *   - **Groups we hold that weren't on the list** are appended, so a new
 *     favorite lands at the end of its medium block rather than the top.
 *   - **Orphan items** — items that appeared before any feed group — are
 *     carried untouched. We never write one.
 *
 * **"Foreign" means we cannot account for it, NOT that we don't favorite it.**
 * Getting that backwards shipped a resurrection loop: an album the user
 * unfavorited left `local`, was read as another app's entry, carried on every
 * republish, and then read back by the reconcile — which takes an itemless
 * group as a feed favorite — and re-created. Unfavoriting an album undid itself
 * on the next page load, permanently, because each pass re-established the
 * state the previous one had removed. `published` is what tells the two apart.
 */
export function mergeSingleList(
  read: { groups: SingleListGroup[]; orphanItemGuids: string[] },
  local: SingleListGroup[],
  published: PublishedRecord = EMPTY_PUBLISHED
): { groups: SingleListGroup[]; orphanItemGuids: string[] } {
  const localByGuid = new Map(local.map((g) => [g.feedGuid, g]));
  const publishedFeeds = new Set(published.feeds);
  const publishedItems = new Set(published.items);
  const groups: SingleListGroup[] = [];
  const taken = new Set<string>();

  for (const group of read.groups) {
    if (taken.has(group.feedGuid)) continue; // a duplicate group on the wire
    taken.add(group.feedGuid);
    const mine = localByGuid.get(group.feedGuid);
    if (!mine) {
      // We put it there and no longer hold it: that is a removal, and dropping
      // it is how an unfavorite propagates. Carrying it instead makes removal
      // impossible — the group survives every republish, a reader takes an
      // itemless group as a feed favorite, and the favorite comes back on the
      // next hydration. That loop shipped once; see the module header.
      if (publishedFeeds.has(group.feedGuid)) continue;
      // Never published by us, so it is another app's. Carry it verbatim.
      groups.push(group);
      continue;
    }
    groups.push({
      ...mine,
      // Prefer what we resolved; fall back to the hint that was already there
      // rather than blanking it. A hint we didn't write is not ours to delete.
      medium: mine.medium ?? group.medium,
      // Ours in our order, then any item under this feed that we never
      // published — another app's, and not ours to delete just because it
      // sits beneath a feed we happen to hold.
      itemGuids: [
        ...mine.itemGuids,
        ...group.itemGuids.filter(
          (guid) => !publishedItems.has(guid) && !mine.itemGuids.includes(guid)
        ),
      ],
    });
  }

  for (const group of local) {
    if (taken.has(group.feedGuid)) continue;
    taken.add(group.feedGuid);
    groups.push(group);
  }

  return { groups, orphanItemGuids: read.orphanItemGuids };
}

/** The unsigned event template. `content` is empty and public, as in the spec. */
export function singleListTemplate(items: FavoriteEntry[], createdAt: number) {
  return templateFromTags(buildSingleListTags(items), createdAt);
}

export function templateFromTags(tags: string[][], createdAt: number) {
  return { kind: SINGLE_LIST_KIND, tags, content: '', created_at: createdAt };
}

/**
 * A stable digest of what would be published.
 *
 * Every publish costs a signing prompt, and a remote signer makes that a round
 * trip to the user's phone. Comparing this against the last published value
 * skips the prompt and the relay write when a favorite toggle didn't actually
 * change this event.
 */
export function singleListDigest(items: FavoriteEntry[]): string {
  return JSON.stringify(buildSingleListTags(items));
}

// --- reading ---------------------------------------------------------------

/**
 * Walk the tags back into groups.
 *
 * Tolerant by design — a writer that is newer, older or simply sloppier than
 * this one must not cost the user favorites:
 *
 *   - **Both `k` forms are accepted.** Paired with each `i` as the spec writes
 *     it, or one per kind as this app writes it. `k` is ignored entirely on the
 *     way in: an entry's kind comes from its identifier, which is the only
 *     reading that works for both.
 *   - **An item before any feed group is kept**, not dropped, as
 *     `orphanItemGuids`. It cannot be resolved through /episodes/byguid without
 *     a parent, but it can still match a local row by its own guid.
 *   - **An unknown identifier kind is skipped** rather than guessed at.
 *
 * One deliberate divergence: the spec says an entry appearing before any
 * `medium` tag defaults to `podcast`. That is treated as UNKNOWN here instead.
 * This app writes its own unknown-medium groups in exactly that position, so
 * honouring the default would round-trip "not told" into "podcast" and file a
 * music release under Podcasts. The hint is advisory and a resolved answer
 * wins, so unknown is both safer and truer.
 */
export function parseSingleList(tags: string[][]): {
  groups: SingleListGroup[];
  orphanItemGuids: string[];
} {
  const groups: SingleListGroup[] = [];
  const orphanItemGuids: string[] = [];
  let medium: string | undefined;
  let current: SingleListGroup | null = null;

  for (const tag of tags) {
    if (tag[0] === 'medium') {
      medium = tag[1] || undefined;
      continue;
    }
    if (tag[0] !== 'i' || !tag[1]) continue;

    const id = tag[1];
    const feedGuid = parseShowGuid(id);
    if (feedGuid) {
      current = { feedGuid, medium, itemGuids: [], favorited: false };
      groups.push(current);
      continue;
    }

    const itemGuid = parseItemGuid(id);
    if (!itemGuid) continue; // a kind this app has no placement for

    if (!current) {
      orphanItemGuids.push(itemGuid);
      continue;
    }
    if (!current.itemGuids.includes(itemGuid)) current.itemGuids.push(itemGuid);
  }

  return { groups, orphanItemGuids };
}

/**
 * The `{ shows, tracks }` shape `/api/favorites/sync-shared` resolves against
 * local rows. A group's medium rides along on every track under it, because
 * Podcasting 2.0 has no per-item medium — an item's is its feed's.
 */
export function partitionSingleList(list: {
  groups: SingleListGroup[];
  orphanItemGuids: string[];
}): {
  shows: Array<{ feedGuid: string; medium?: string }>;
  tracks: Array<{ itemGuid: string; feedGuid?: string; medium?: string }>;
} {
  const shows: Array<{ feedGuid: string; medium?: string }> = [];
  const tracks: Array<{ itemGuid: string; feedGuid?: string; medium?: string }> = [];

  for (const group of list.groups) {
    shows.push({ feedGuid: group.feedGuid, medium: group.medium });
    for (const itemGuid of group.itemGuids) {
      tracks.push({ itemGuid, feedGuid: group.feedGuid, medium: group.medium });
    }
  }
  for (const itemGuid of list.orphanItemGuids) tracks.push({ itemGuid });

  return { shows, tracks };
}

/**
 * Drop entries this device removed but has not yet managed to un-publish.
 *
 * The inbound path runs before the outbound one — read, reconcile, then push —
 * so between an unfavorite and its publish the list still carries the entry.
 * Reconciling it straight back in re-creates the row, and the push that follows
 * then sees it as local again, produces the tags already on the wire, and is
 * skipped as unchanged. The removal never propagates and the favorite returns
 * on every load. Observed three times before this existed.
 *
 * Same question as `mergeSingleList`, same answer: an entry we published and no
 * longer hold is ours removed, not theirs added. Anything we never published is
 * left alone, so a genuine inbound favorite from another app still arrives.
 */
export function suppressOwnRemovals<
  S extends { feedGuid: string },
  T extends { itemGuid: string },
>(
  incoming: { shows: S[]; tracks: T[] },
  local: SingleListGroup[],
  published: PublishedRecord
): { shows: S[]; tracks: T[] } {
  const localFeeds = new Set(local.map((g) => g.feedGuid));
  const localItems = new Set(local.flatMap((g) => g.itemGuids));
  const publishedFeeds = new Set(published.feeds);
  const publishedItems = new Set(published.items);

  return {
    shows: incoming.shows.filter(
      (s) => !(publishedFeeds.has(s.feedGuid) && !localFeeds.has(s.feedGuid))
    ),
    tracks: incoming.tracks.filter(
      (t) => !(publishedItems.has(t.itemGuid) && !localItems.has(t.itemGuid))
    ),
  };
}

/** Read the user's kind:10333 event. Plain replaceable — no `d` tag. */
export async function fetchSingleList(pubkey: string, relays: string[]): Promise<SingleList> {
  const filter: Filter = { kinds: [SINGLE_LIST_KIND], authors: [pubkey], limit: 1 };
  const { event, trustworthy } = await readReplaceableEvent({ pubkey, relays, filter });

  if (!event) {
    return { groups: [], orphanItemGuids: [], updatedAt: 0, exists: false, trustworthy };
  }
  const { groups, orphanItemGuids } = parseSingleList(event.tags);
  return { groups, orphanItemGuids, updatedAt: event.created_at, exists: true, trustworthy: true };
}
