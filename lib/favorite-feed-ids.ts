/**
 * The set of identifiers one album favorite can be stored under.
 *
 * `FavoriteAlbum.feedId` is POLYMORPHIC — a row may hold a `Feed.id`, a
 * `Feed.guid`, or a synthetic `artist-*` id, because each surface writes
 * whichever the album object in hand carried. There is no migration and
 * historical rows exist in every format, so **every path that looks a favorite
 * up must compare against the whole equivalence set, not the one string it was
 * handed** (see `CLAUDE.md`).
 *
 * The expansion used to be written out three times with three slightly
 * different behaviours. This is the same reason `lib/feed-lookup.ts` exists for
 * the feed-by-URL ladder, and that file records what happened last time: the
 * copies diverged and produced a silent-skip bug. Do not re-inline it.
 *
 * Pure on purpose — the route runs the query, this maps the rows — so the case
 * that actually broke is testable without a database
 * (`npx tsx --test lib/favorite-feed-ids.test.ts`).
 */

export interface FeedIdentity {
  id: string;
  guid?: string | null;
}

/**
 * Map each input id to every identifier its feed(s) answer to.
 *
 * **All matches, not the first.** `Feed.id` is the primary key and `Feed.guid`
 * is `@unique`, so one input string can match two different rows — feed A by
 * `id` and feed B by `guid`. Taking one (`feeds.find(...)`) drops the other's
 * identifiers, and a favorite stored under them misses. That is reachable
 * today: `app/api/playlist/resolve-mmm-tracks/route.ts` mints a feed whose `id`
 * IS a podcast guid, so a later normal import of the same feed produces exactly
 * that pair.
 *
 * Note what this means, because it is a widening and not only a fix: when two
 * rows collide on one string, their favorites become interchangeable for that
 * input. That is the intended reading here — two rows sharing a guid are the
 * same feed duplicated, which this codebase has a whole dedup subsystem
 * premised on — but it is a deliberate choice, not an accident of the
 * implementation. Do not "tighten" it back to a single match; that silently
 * restores the bug.
 *
 * The input is always included, even when no feed matches: synthetic `artist-*`
 * ids and guids with no local `Feed` row must still resolve to themselves.
 */
export function buildFeedIdEquivalence(
  inputIds: readonly string[],
  feeds: readonly FeedIdentity[]
): Map<string, string[]> {
  const byInput = new Map<string, string[]>();

  for (const inputId of inputIds) {
    if (!inputId || byInput.has(inputId)) continue;

    const ids = new Set<string>([inputId]);
    for (const feed of feeds) {
      if (feed.id !== inputId && feed.guid !== inputId) continue;
      if (feed.id) ids.add(feed.id);
      if (feed.guid) ids.add(feed.guid);
    }

    byInput.set(inputId, [...ids]);
  }

  return byInput;
}

/** Every identifier to query for, flattened and de-duplicated. */
export function flattenFeedIdEquivalence(byInput: Map<string, string[]>): string[] {
  return [...new Set([...byInput.values()].flat())];
}

/**
 * Is this input favorited, given the set of `feedId`s that are?
 *
 * A hit on ANY identifier in the input's equivalence set counts — that is the
 * whole point of the expansion.
 */
export function isFeedIdFavorited(
  inputId: string,
  byInput: Map<string, string[]>,
  favoritedFeedIds: ReadonlySet<string>
): boolean {
  const candidates = byInput.get(inputId) ?? [inputId];
  return candidates.some((id) => favoritedFeedIds.has(id));
}

/** The Prisma `where` that finds every feed any of these ids could name. */
export function feedLookupWhere(inputIds: readonly string[]) {
  const ids = [...new Set(inputIds.filter(Boolean))];
  return { OR: [{ id: { in: ids } }, { guid: { in: ids } }] };
}
