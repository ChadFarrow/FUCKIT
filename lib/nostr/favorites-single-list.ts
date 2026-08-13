/**
 * The single-list favorites format — kind 10333, "PC 2.0 Favorites".
 *
 * Spec: github.com/ChadFarrow/PC20-Nostr, `pc20-favorites-single-list.md`. It
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
 * **Deviation from the spec as written, pending a spec update:** the document
 * pairs a `k` tag with every `i` tag. This WRITES one `k` per distinct kind, at
 * the end, and READS both forms. The two carry identical information — `k`
 * names an identifier kind, and the kind is already the prefix of the
 * identifier — but the paired form cost 423 tags holding two distinct values on
 * the first real event, ~11 KB of 36 KB. A reader must take an entry's kind
 * from position 1; one that walks `i`/`k` in pairs will not read what this
 * writes.
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
  const groups = groupForSingleList(items);
  const tags: string[][] = [['alt', LIST_ALT]];
  const kinds = new Set<string>();

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

/** The unsigned event template. `content` is empty and public, as in the spec. */
export function singleListTemplate(items: FavoriteEntry[], createdAt: number) {
  return {
    kind: SINGLE_LIST_KIND,
    tags: buildSingleListTags(items),
    content: '',
    created_at: createdAt,
  };
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
