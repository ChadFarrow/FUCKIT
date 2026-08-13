/**
 * The single-list favorites format — kind 10333, "PC 2.0 Favorites".
 *
 * Spec: github.com/ChadFarrow/PC20-Nostr, `pc20-favorites-single-list.md`. It
 * replaces the two-list kind:30078 format in `shared-favorites.ts`, which
 * proved overcomplicated: one plain (non-`d`-tagged) replaceable event, paired
 * `i`/`k` tags, grouped under a running `medium`, no baseline and no merge.
 * Republishing the whole tag list IS the sync.
 *
 * This module is the FORMAT only — pure, no relay I/O, no signing — so the
 * shape can be pinned by unit tests the way `shared-favorites.ts` separates its
 * pure half from `fetchSharedFavorites`.
 *
 * ---------------------------------------------------------------------------
 * The one thing to understand before editing: placement is POSITIONAL
 *
 * A `podcast:item:guid` pair carries no parent of its own. It belongs to the
 * feed group most recently opened above it, and to the medium most recently
 * declared above that. Both facts live in tag ORDER rather than in the tag, so
 * reordering the output is not cosmetic — it re-parents entries.
 *
 * Two consequences, both deliberate and neither a bug here:
 *
 *   - **A feed group is opened for every parent of a favorited track**, whether
 *     or not the feed is itself favorited, because there is no other way to say
 *     which feed a track came from. Nothing on the wire distinguishes a group
 *     opened for placement from a feed the user chose. Measured against real
 *     data at the time of writing: 82 favorited feeds, 159 distinct parents,
 *     114 of them not favorited. Resolving the guids and deciding what to show
 *     is the consuming app's job — they are the standard Podcasting 2.0
 *     identifiers and any PC 2.0 app knows what they are.
 *   - **A track whose parent feed has no `<podcast:guid>` cannot be expressed**
 *     and is dropped. The two-list format could carry it parentless; this one
 *     cannot. Zero favorites are in that state today, and the fix is an admin
 *     reparse to populate `Feed.guid`, not an invented parent.
 * ---------------------------------------------------------------------------
 */

import {
  ITEM_KIND,
  bareFeedGuid,
  identifierKind,
  itemId,
  parseItemGuid,
  parseShowGuid,
  showId,
  type SharedFavoriteItem,
} from './shared-favorites';

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
   *  none. NEVER defaulted — see `buildSingleListTags`. */
  medium?: string;
  itemGuids: string[];
  /** Whether the feed itself is favorited, as opposed to the group existing
   *  only to place an item. Not expressible on the wire; kept because the
   *  distinction is real and worth asserting in tests. */
  favorited: boolean;
}

/**
 * Collapse a flat favorites list into feed groups, preserving first-appearance
 * order — which is what makes a republish byte-identical when nothing changed.
 */
export function groupForSingleList(items: SharedFavoriteItem[]): SingleListGroup[] {
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

    // The parent arrives as `podcast:guid:<uuid>` from this app and as a bare
    // uuid from writers on the newer two-list revision; `bareFeedGuid` accepts
    // both and rejects anything that isn't a guid.
    const parent = bareFeedGuid(item.feedRef);
    if (!parent) continue; // unplaceable — see the header

    const group = ensure(parent, item.medium);
    if (!group.itemGuids.includes(itemGuid)) group.itemGuids.push(itemGuid);
  }

  return [...groups.values()];
}

/** The `i`/`k` pair for one identifier, or nothing when its kind is unknown. */
function pairFor(id: string): string[][] {
  const kind = identifierKind(id);
  return kind ? [['i', id], ['k', kind]] : [];
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
export function buildSingleListTags(items: SharedFavoriteItem[]): string[][] {
  const groups = groupForSingleList(items);
  const tags: string[][] = [['alt', LIST_ALT]];

  const emit = (group: SingleListGroup) => {
    tags.push(...pairFor(showId(group.feedGuid)));
    for (const guid of group.itemGuids) tags.push(...pairFor(itemId(guid)));
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

  return tags;
}

/** The unsigned event template. `content` is empty and public, as in the spec. */
export function singleListTemplate(items: SharedFavoriteItem[], createdAt: number) {
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
 * Every publish costs a signing prompt — two now that this runs beside the
 * kind:30078 sync, and a remote signer makes that a round trip to the user's
 * phone. Comparing this against the last published value skips the prompt and
 * the relay write when a favorite toggle didn't actually change this event.
 */
export function singleListDigest(items: SharedFavoriteItem[]): string {
  return JSON.stringify(buildSingleListTags(items));
}

export { ITEM_KIND };
