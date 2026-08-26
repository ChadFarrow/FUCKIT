/**
 * Public / private / not-on-Nostr, for the shared kind:10333 favorites list.
 *
 * The list is public in a stronger sense than "someone with your pubkey can
 * read it". Every entry is an `i` tag, `i` is a single-letter tag, and relays
 * INDEX those — so a `#i` filter answers *which pubkeys favorited this feed*.
 * The list is searchable in reverse. `content` is the only free slot in the
 * event, and per the spec's private-half section it takes NIP-51's split:
 * public entries stay in tags, private entries go in `content` as a NIP-44
 * encrypt-to-self of a tag array.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR THINGS A SECOND HALF BREAKS
 *
 * None is hypothetical. Boost Me Bitch shipped fifteen defects finding them,
 * and the last and worst one passed every vector the other fourteen added.
 *
 * 1. IDEMPOTENCE. NIP-44 draws a fresh nonce, so re-encrypting identical
 *    entries produces different bytes every time. A ciphertext comparison
 *    therefore always differs and every load republishes — two apps rewriting
 *    the event against each other forever, this time self-inflicted. Compare
 *    the DECRYPTED arrays. `publishPlan` returns `privateTags` for exactly
 *    that, and the caller must digest those rather than the ciphertext.
 *
 * 2. THE BASELINE HAS TO SAY WHICH HALF. Moving an entry public→private is a
 *    removal on one side and an addition on the other. Against one shared
 *    baseline those cancel and the entry is deleted outright.
 *
 * 3. THE BASELINE MUST NOT CLAIM THE HALF IT DOES NOT FEED. This is the one
 *    that hid behind every other guard. The active half's claims are derived
 *    from what we just published there. The inactive half's are CARRIED
 *    FORWARD from the previous record and then cleared by the move — never
 *    re-derived, because nothing feeds that half next cycle, so a derived
 *    claim goes unbacked and the removal test fires on the whole half at once.
 *    Cycle 1 claims another writer's entries and cycle 2 deletes them, and
 *    cycle 1 need not even publish for it to happen.
 *
 * 4. THE INACTIVE HALF IS NOT PAINTED INTO LOCAL STATE. Local favorites are
 *    written through to the database and read back as `local`, which goes
 *    wholly into the ACTIVE half. So an entry adopted out of the inactive half
 *    is republished into this one: for our own entries that is how a switch
 *    completes, but for another writer's it is a migration nobody asked for —
 *    and in the private→public direction it is a DISCLOSURE, because relays
 *    index `i`. `claimedByBaseline` filters it to what this device claims. A
 *    foreign private half is carried but not shown; that is the cost.
 * ---------------------------------------------------------------------------
 *
 * Everything here is pure. The signer, the relays and `localStorage` live in
 * `favorites-sync-client.ts`; this file is where the reasoning is testable.
 */

import {
  type ParsedSingleList,
  type PublishedRecord,
  type SingleListGroup,
  EMPTY_PARSED,
  mergeSingleList,
  publishedRecordFrom,
  tagsFromNodes,
} from './favorites-single-list';

/**
 * Where this device puts new favorites.
 *
 * `'off'` is not "stop syncing quietly" — it is a withdrawal, and it publishes
 * once to take down what this device claims before it stops. See
 * `withdrawalPlan`.
 */
export type FavoritesPrivacy = 'public' | 'private' | 'off';

/**
 * Does going private take the WHOLE list, including entries this app did not
 * write and cannot resolve?
 *
 * The spec says it must — the choice belongs to the list, not to the app — and
 * the alternative was measured: a real account went private and 13 of 449
 * entries stayed in the tags, public and relay-indexed, because a second app
 * had written them. Nothing on screen said which. A user who has made a privacy
 * choice and got 97% of it is worse off than one told plainly that they have to
 * make it again elsewhere.
 *
 * OFF UNTIL BOSTMEBITCH CAN READ THE PRIVATE HALF. The sequencing is the same
 * shape as the carry rule, one step along: an app must be able to READ and
 * RENDER `content` before anything moves entries into it on that app's behalf,
 * or the move is indistinguishable from a deletion on its screen. BMB's reader
 * is in ChadFarrow/boostmebitch#222. Flipping this is a one-line commit once it
 * ships.
 *
 * Only ever public → private. The reverse is a disclosure and stays limited to
 * what this device's baseline claims — see `publishPlan`.
 */
export const WHOLE_LIST_PRIVACY_MOVE = false;

/** The half a set of claims belongs to. `'off'` claims neither. */
export type ListHalf = 'public' | 'private';

/**
 * What this device has put on each half of the list.
 *
 * Two records rather than one, per defect 2 above. The old single-record shape
 * (`{feeds, items}`) migrates to `public`, which is true by construction —
 * everything published before this file existed went in tags.
 */
export interface PrivacyBaseline {
  public: PublishedRecord;
  private: PublishedRecord;
}

const EMPTY_RECORD: PublishedRecord = { feeds: [], items: [] };
export const EMPTY_BASELINE: PrivacyBaseline = { public: EMPTY_RECORD, private: EMPTY_RECORD };

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const record = (v: unknown): PublishedRecord => ({
  feeds: strings((v as any)?.feeds),
  items: strings((v as any)?.items),
});

/**
 * Read a stored baseline, in either shape.
 *
 * The old `{feeds, items}` is read as the PUBLIC half's claims. That is not a
 * guess: nothing could have written a private entry before this existed, so
 * every claim on record is a tag claim. Reading it as `private` — or as
 * neither — would make the first publish after upgrading treat this device's
 * own public entries as another app's and carry them forever.
 *
 * Anything unreadable becomes empty, which is the safe direction: **an empty
 * record treats nothing as a removal and suppresses nothing.** A device that
 * has agreed to nothing may not delete anything.
 */
export function parseBaseline(raw: string | null): PrivacyBaseline {
  if (!raw) return EMPTY_BASELINE;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.public || parsed.private)) {
      return { public: record(parsed.public), private: record(parsed.private) };
    }
    // The pre-halves shape. Everything on it was published as tags.
    return { public: record(parsed), private: EMPTY_RECORD };
  } catch {
    return EMPTY_BASELINE;
  }
}

/** The other half. `'off'` has no active half, so callers handle it first. */
export const otherHalf = (half: ListHalf): ListHalf =>
  half === 'public' ? 'private' : 'public';

/**
 * Which mode a device should adopt for an account that already has a list.
 *
 * Returns null for "ask the user" — and getting this wrong FAILS OPEN, which
 * is why each half answers only for itself.
 *
 * Testing the public half first is the tempting shape and it is a disclosure
 * bug: a device seeded `'public'` over an account whose entries are private
 * paints the decrypted entries into its store and republishes every one as a
 * plaintext, relay-indexed tag. Reversing the tests is wrong the other way — it
 * moves a genuinely public account into `content`, which is an edit nobody
 * asked for. Only one half having anything in it is an answer. Both, or
 * neither, is a question.
 */
export function seedModeFromWire(hasPublic: boolean, hasPrivate: boolean): FavoritesPrivacy | null {
  if (hasPublic && !hasPrivate) return 'public';
  if (hasPrivate && !hasPublic) return 'private';
  return null;
}

/**
 * The subset of a half's entries this device put there.
 *
 * Defect 4. The inactive half is carried on the wire whatever happens, but only
 * the part we claim may reach local state — an entry adopted out of another
 * writer's half is republished into ours on the next cycle, which is a
 * migration nobody asked for and, private→public, a disclosure.
 */
export function claimedByBaseline(
  groups: SingleListGroup[],
  claims: PublishedRecord
): SingleListGroup[] {
  const feeds = new Set(claims.feeds);
  const items = new Set(claims.items);
  const out: SingleListGroup[] = [];
  for (const g of groups) {
    const keptItems = g.itemGuids.filter((i) => items.has(i));
    const keptFeed = feeds.has(g.feedGuid);
    if (!keptFeed && keptItems.length === 0) continue;
    out.push({ ...g, itemGuids: keptItems, favorited: keptFeed && g.favorited });
  }
  return out;
}

/** What a publish should contain, and what to record if it lands. */
export interface PublishPlan {
  /** The event's `tags`. */
  tags: string[][];
  /**
   * The private half as a TAG ARRAY, before encryption — null when there is no
   * private half to write and `content` should be carried instead.
   *
   * Returned rather than a ciphertext because this is what the digest compares
   * and what idempotence is decided on. NIP-44's nonce makes the ciphertext
   * different on every pass, so comparing it republishes forever.
   */
  privateTags: string[][] | null;
  /** The baseline to store IF the relays accept the event, and only then. */
  baseline: PrivacyBaseline;
  /**
   * Entries left PUBLIC by a switch to private, because another app wrote them
   * and this build cannot move them yet.
   *
   * Surfaced rather than counted and forgotten: a user who chose Private and
   * got 97% of it must be told which part did not move, or the format has
   * quietly made a promise it did not keep. Zero once
   * {@link WHOLE_LIST_PRIVACY_MOVE} is on, and zero in public mode, where
   * nothing was supposed to move.
   */
  strandedInPublicHalf: number;
}

/**
 * Build the publish, given both halves as read and what this device claims.
 *
 * `mode` decides which half the local favorites are merged into. The other one
 * is carried: merged against its OWN previous claims with no local state, which
 * removes what this device put there and no longer holds — the second half of a
 * mode switch — and carries everything it never claimed.
 *
 * The baseline that comes back is the asymmetry in defect 3, and it is the
 * whole reason this function returns one instead of the caller deriving it:
 *
 *   active half   — derived from `local`, which really does back it next cycle
 *   inactive half — EMPTY, because the merge above just removed everything we
 *                   claimed there. Not re-derived from its merge: that would
 *                   claim the foreign entries we are only carrying, and nothing
 *                   feeds that half next cycle to back the claim, so the
 *                   removal test would fire on all of them at once.
 */
export function publishPlan(input: {
  mode: ListHalf;
  publicRead: ParsedSingleList;
  /** The decrypted private half, or `EMPTY_PARSED` when there is none. */
  privateRead: ParsedSingleList;
  local: SingleListGroup[];
  baseline: PrivacyBaseline;
}): PublishPlan {
  const { mode, publicRead, privateRead, local, baseline } = input;
  const inactive = otherHalf(mode);

  const activeRead = mode === 'public' ? publicRead : privateRead;
  const inactiveRead = mode === 'public' ? privateRead : publicRead;

  const activeMerged = mergeSingleList(activeRead, local, baseline[mode]);
  // No local state on this side: everything we claim here is a removal in
  // flight (the entry moved to the other half), and everything we don't claim
  // is another writer's and is carried.
  const inactiveMerged = mergeSingleList(inactiveRead, [], baseline[inactive]);

  const activeTags = tagsFromNodes(
    activeMerged.nodes,
    activeMerged.foreignTags,
    activeMerged.foreignKinds
  );
  const inactiveTags = tagsFromNodes(
    inactiveMerged.nodes,
    inactiveMerged.foreignTags,
    inactiveMerged.foreignKinds
  );

  // GOING PRIVATE TAKES THE WHOLE LIST.
  //
  // Everything left in the public half after the merge above is another app's —
  // ours was just removed from it — and it moves too. That is the spec's rule
  // and it is the difference between "private" and "97% private".
  //
  // Safe in this direction only. It strictly reduces exposure, the entries are
  // carried WHOLE rather than re-rendered, and anything that can decrypt can
  // put them back. The reverse is a disclosure and is not done: switching to
  // public moves only what `baseline.private` claims, which is what the merge
  // above already computes.
  //
  // The moved entries are NOT claimed in the baseline. Nothing local backs
  // them, so a claim would read as our own removal next cycle and delete them —
  // defect 3, arriving by a different road. They stay foreign, in the other
  // half, and are carried from there exactly as they were carried here.
  const movingWholeList = WHOLE_LIST_PRIVACY_MOVE && mode === 'private';
  const privateNodes = movingWholeList
    ? [...activeMerged.nodes, ...inactiveMerged.nodes]
    : activeMerged.nodes;
  const privateTags = movingWholeList
    ? tagsFromNodes(
        privateNodes,
        [...activeMerged.foreignTags, ...inactiveMerged.foreignTags],
        [...activeMerged.foreignKinds, ...inactiveMerged.foreignKinds]
      )
    : activeTags;

  return {
    tags: mode === 'public' ? activeTags : movingWholeList ? [] : inactiveTags,
    privateTags: mode === 'private' ? privateTags : inactiveTags,
    strandedInPublicHalf:
      mode === 'private' && !movingWholeList
        ? inactiveTags.filter((t) => t[0] === 'i').length
        : 0,
    baseline:
      mode === 'public'
        ? { public: publishedRecordFrom(local), private: EMPTY_RECORD }
        : { public: EMPTY_RECORD, private: publishedRecordFrom(local) },
  };
}

/**
 * Leaving Nostr: take down what this device claims, and nothing else.
 *
 * Both halves are merged with no local state against their own claims, so every
 * entry this device put on the list goes and every entry another app added
 * stays. Afterwards this device claims nothing in either half, which is what
 * makes a later re-opt-in start clean rather than immediately deleting
 * somebody's entries.
 *
 * It publishes once. Declining to publish would leave the relay copy in place,
 * which is a defensible choice but a different one — and a relay cannot be
 * asked to forget, so the offer has to be explicit either way.
 */
export function withdrawalPlan(input: {
  publicRead: ParsedSingleList;
  privateRead: ParsedSingleList;
  baseline: PrivacyBaseline;
}): PublishPlan {
  const { publicRead, privateRead, baseline } = input;
  const pub = mergeSingleList(publicRead, [], baseline.public);
  const priv = mergeSingleList(privateRead, [], baseline.private);
  return {
    tags: tagsFromNodes(pub.nodes, pub.foreignTags, pub.foreignKinds),
    privateTags: tagsFromNodes(priv.nodes, priv.foreignTags, priv.foreignKinds),
    // A withdrawal moves nothing, so nothing is stranded by it.
    strandedInPublicHalf: 0,
    baseline: EMPTY_BASELINE,
  };
}

/**
 * What the reconcile may see: the active half in full, plus the part of the
 * inactive half this device claims.
 *
 * The second term is what completes a mode switch — our own entries are still
 * sitting in the half we are moving out of until the publish lands, and
 * dropping them here would make them vanish from the page in between. Anything
 * we do not claim is another writer's and stays off local state entirely: see
 * defect 4.
 */
export function reconcileInput(input: {
  mode: ListHalf;
  publicRead: ParsedSingleList;
  privateRead: ParsedSingleList;
  baseline: PrivacyBaseline;
}): { groups: SingleListGroup[]; orphanItemGuids: string[] } {
  const { mode, publicRead, privateRead, baseline } = input;
  const active = mode === 'public' ? publicRead : privateRead;
  const inactive = mode === 'public' ? privateRead : publicRead;
  return {
    groups: [
      ...active.groups,
      ...claimedByBaseline(inactive.groups, baseline[otherHalf(mode)]),
    ],
    // Orphans come from the active half only. We never write one, and an
    // orphan in the half we are not feeding has no claim to check against.
    orphanItemGuids: active.orphanItemGuids,
  };
}

/** A half with nothing in it, for the "no private list yet" case. */
export const EMPTY_HALF: ParsedSingleList = EMPTY_PARSED;
