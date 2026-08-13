/**
 * The Podcasting 2.0 identifier vocabulary shared over Nostr — NIP-73 external
 * content identifiers and the helpers that read them.
 *
 * Lives on its own because it outlives any one event format. It was written for
 * the kind:30078 two-list spec, it is what kind 10333 is built from, and the
 * inbound reconcile route resolves guids with it without knowing about either.
 */

/** `<podcast:guid>` — a feed: a podcast, an album, a single. */
export const SHOW_KIND = 'podcast:guid';
export const SHOW_PREFIX = `${SHOW_KIND}:`;

/** An RSS `<item>` — an episode or a track. */
export const ITEM_KIND = 'podcast:item:guid';
export const ITEM_PREFIX = `${ITEM_KIND}:`;

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
const KNOWN_IDENTIFIER_KINDS = ['podcast:publisher:guid', ITEM_KIND, SHOW_KIND];

/** Podcasting 2.0 `<podcast:guid>` is a UUID (v5 in spec, any version tolerated). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One favorite, as an identifier plus the hints an event may carry with it. */
export interface FavoriteEntry {
  /** Full NIP-73 identifier, e.g. `podcast:guid:<uuid>`. */
  id: string;
  /**
   * The parent feed of an item, as `podcast:guid:<uuid>` or a bare uuid.
   *
   * Podcast Index's /episodes/byguid wants `podcastguid`, so an item guid on
   * its own is not a reliable lookup. In kind 10333 this is not written as a
   * field at all — it is the feed group the item sits under — so it exists here
   * as the in-memory form on both sides of that translation.
   */
  feedRef?: string;
  /**
   * The entry's `<podcast:medium>` — `music`, `podcast`, `audiobook`, and
   * whatever the namespace adds next. The vocabulary is NOT a closed set.
   *
   * ADVISORY. It is a cache of what a reader could work out by resolving the
   * guid, it goes stale when a feed retags, and a resolved answer wins over it.
   * Absent means "not told", which is NOT a default: guessing `music` is wrong
   * for exactly the half of a list the hint exists to separate, and guessing
   * `podcast` is wrong for the other half.
   */
  medium?: string;
}

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

/**
 * A parent-feed reference as a bare uuid, accepting BOTH the prefixed
 * `podcast:guid:<uuid>` form and the bare one.
 *
 * Handing a prefixed value to Podcast Index as `podcastguid` matches nothing,
 * so an app that treats the reference as opaque renders a user's whole item
 * library as unresolved while carrying it faithfully.
 */
export function bareFeedGuid(feedRef: string | undefined): string | undefined {
  if (!feedRef) return undefined;
  const bare = feedRef.startsWith(SHOW_PREFIX) ? feedRef.slice(SHOW_PREFIX.length) : feedRef;
  return UUID_RE.test(bare) ? bare : undefined;
}
