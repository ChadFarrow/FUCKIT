/**
 * The public/private split, and the four things it breaks.
 *
 * READ THIS BEFORE ADDING A VECTOR: several of these need TWO cycles to say
 * anything. A single cycle emits correct bytes and only the baseline recorded
 * beside them is wrong, which is exactly why every existing vector in
 * favorites-single-list.test.ts passes over the worst defect in this file. If a
 * test here publishes once and asserts on the tags, it is not testing the thing
 * this module exists for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_BASELINE,
  claimedByBaseline,
  parseBaseline,
  publishPlan,
  reconcileInput,
  seedModeFromWire,
  withdrawalPlan,
  type PrivacyBaseline,
} from './favorites-privacy';
import {
  EMPTY_PARSED,
  groupForSingleList,
  parseSingleList,
  LIST_ALT,
} from './favorites-single-list';
import { itemId, showId, type FavoriteEntry } from './pc20-identifiers';

const MUSIC_A = '9b024349-ccf0-5f69-a609-6b82873eab3c';
const MUSIC_B = '4a7c1e58-2d93-5f04-b6e1-8c5a90d3f2b7';
const FOREIGN = 'c31ad2f6-1b7e-5b34-a2a4-6b06d5b0b4e2';

const album = (guid: string, medium?: string): FavoriteEntry => ({ id: showId(guid), medium });
const track = (guid: string, parent: string, medium?: string): FavoriteEntry => ({
  id: itemId(guid),
  feedRef: showId(parent),
  medium,
});

/** A half holding the given feed guids, as if read off the wire. */
const halfWith = (...guids: string[]) =>
  parseSingleList([
    ['alt', LIST_ALT],
    ['medium', 'music'],
    ...guids.map((g) => ['i', showId(g)]),
  ]);

const feedsOf = (tags: string[][]) =>
  tags.filter((t) => t[0] === 'i').map((t) => t[1]);

// ---------------------------------------------------------------------------
// Seeding — each half answers only for itself
// ---------------------------------------------------------------------------

test('a device seeds its mode from the wire, and asks when the wire is ambiguous', () => {
  assert.equal(seedModeFromWire(true, false), 'public');
  assert.equal(seedModeFromWire(false, true), 'private');

  // Both, or neither. Neither is a genuinely new account; both is an account
  // that has used the split. Guessing either way edits data nobody asked to
  // move, so the answer is a question.
  assert.equal(seedModeFromWire(true, true), null);
  assert.equal(seedModeFromWire(false, false), null);
});

test('testing the public half first would fail OPEN, which is why it does not', () => {
  // The disclosure bug, stated as a test so the shape cannot come back. A
  // private account has hasPublic=false, hasPrivate=true. An implementation
  // that checked `hasPublic ? 'public' : 'private'` returns 'public' here —
  // the device then paints the decrypted entries into its store and
  // republishes every one as a plaintext, relay-INDEXED `i` tag.
  assert.notEqual(seedModeFromWire(false, true), 'public');
  // And the mirror: private-first would move a genuinely public account into
  // `content`, an edit nobody asked for.
  assert.notEqual(seedModeFromWire(true, false), 'private');
});

// ---------------------------------------------------------------------------
// The baseline
// ---------------------------------------------------------------------------

test('a pre-halves baseline is read as the PUBLIC half, never as neither', () => {
  // Nothing could have written a private entry before the split existed, so
  // every claim on record is a tag claim. Reading it as `private` or dropping
  // it makes the first publish after upgrading treat this device's own public
  // entries as another app's and carry them forever.
  const old = JSON.stringify({ feeds: [MUSIC_A], items: ['t1'] });
  assert.deepEqual(parseBaseline(old), {
    public: { feeds: [MUSIC_A], items: ['t1'] },
    private: { feeds: [], items: [] },
  });
});

test('an unreadable baseline is empty, and an empty baseline removes nothing', () => {
  // The safe direction, and the same rule the single-record version had: a
  // device that has agreed to nothing may not delete anything.
  assert.deepEqual(parseBaseline('not json'), EMPTY_BASELINE);
  assert.deepEqual(parseBaseline(null), EMPTY_BASELINE);
  assert.deepEqual(parseBaseline('{"public":{"feeds":"nope"}}').public, { feeds: [], items: [] });

  const plan = publishPlan({
    mode: 'public',
    publicRead: halfWith(FOREIGN),
    privateRead: EMPTY_PARSED,
    local: [],
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(FOREIGN)], 'the foreign entry survives');
});

test('the two halves round-trip through parseBaseline', () => {
  const both: PrivacyBaseline = {
    public: { feeds: [MUSIC_A], items: [] },
    private: { feeds: [MUSIC_B], items: ['t9'] },
  };
  assert.deepEqual(parseBaseline(JSON.stringify(both)), both);
});

// ---------------------------------------------------------------------------
// Carrying the half we do not use
// ---------------------------------------------------------------------------

test('a public-mode device carries a foreign private half untouched', () => {
  const plan = publishPlan({
    mode: 'public',
    publicRead: EMPTY_PARSED,
    privateRead: halfWith(FOREIGN),
    local: groupForSingleList([album(MUSIC_A, 'music')]),
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(MUSIC_A)]);
  assert.deepEqual(feedsOf(plan.privateTags!), [showId(FOREIGN)], 'not ours, not touched');
});

test('a private-mode device carries a foreign public half untouched', () => {
  const plan = publishPlan({
    mode: 'private',
    publicRead: halfWith(FOREIGN),
    privateRead: EMPTY_PARSED,
    local: groupForSingleList([album(MUSIC_A, 'music')]),
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(FOREIGN)], 'not ours, not touched');
  assert.deepEqual(feedsOf(plan.privateTags!), [showId(MUSIC_A)]);
});

// ---------------------------------------------------------------------------
// Defect 3 — the baseline must not claim the half it does not feed.
// These need two cycles. That is the point.
// ---------------------------------------------------------------------------

test('cycle 2 does not delete the foreign half cycle 1 merely carried', () => {
  // THE FIFTEENTH DEFECT, and the one every other guard missed.
  //
  // Deriving BOTH halves' baselines from their merges is locally reasonable —
  // "this app renders the union, so it must claim what it renders". True of
  // the active half, whose merge really is backed by local state next cycle.
  // False of the other one: nothing feeds it, so the claim goes unbacked and
  // the removal test fires on the whole half at once.
  //
  // Cycle 1 emits correct bytes. Only the baseline beside them is wrong, which
  // is why a single-cycle assertion cannot see this.
  const local = groupForSingleList([album(MUSIC_A, 'music')]);

  const cycle1 = publishPlan({
    mode: 'public',
    publicRead: EMPTY_PARSED,
    privateRead: halfWith(FOREIGN),
    local,
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(feedsOf(cycle1.privateTags!), [showId(FOREIGN)], 'cycle 1 carries it');
  assert.deepEqual(
    cycle1.baseline.private,
    { feeds: [], items: [] },
    'and claims NOTHING there — this is the assertion that matters'
  );

  const cycle2 = publishPlan({
    mode: 'public',
    publicRead: parseSingleList(cycle1.tags),
    privateRead: parseSingleList(cycle1.privateTags!),
    local,
    baseline: cycle1.baseline,
  });
  assert.deepEqual(
    feedsOf(cycle2.privateTags!),
    [showId(FOREIGN)],
    'cycle 2 still carries it — a derived claim would have deleted it here'
  );
});

test('a mode switch still removes what it moved, across two cycles', () => {
  // The control for the test above. Suppressing the claim entirely would be
  // one way to pass it, and it would break this: a switch has to take the
  // entry OUT of the half it left, or the favorite exists twice.
  const local = groupForSingleList([album(MUSIC_A, 'music')]);

  // Established public.
  const before = publishPlan({
    mode: 'public',
    publicRead: EMPTY_PARSED,
    privateRead: EMPTY_PARSED,
    local,
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(before.baseline.public.feeds, [MUSIC_A]);

  // The user switches to private. The public half is now inactive, and its
  // previous claims are what authorise the removal.
  const after = publishPlan({
    mode: 'private',
    publicRead: parseSingleList(before.tags),
    privateRead: EMPTY_PARSED,
    local,
    baseline: before.baseline,
  });
  assert.deepEqual(feedsOf(after.tags), [], 'gone from the public half');
  assert.deepEqual(feedsOf(after.privateTags!), [showId(MUSIC_A)], 'and arrived in the private one');
  assert.deepEqual(after.baseline.public, { feeds: [], items: [] }, 'no longer claimed there');
  assert.deepEqual(after.baseline.private.feeds, [MUSIC_A]);

  // Cycle 2 in the new mode is stable.
  const settled = publishPlan({
    mode: 'private',
    publicRead: parseSingleList(after.tags),
    privateRead: parseSingleList(after.privateTags!),
    local,
    baseline: after.baseline,
  });
  assert.deepEqual(feedsOf(settled.privateTags!), [showId(MUSIC_A)]);
  assert.deepEqual(feedsOf(settled.tags), []);
});

test('a switch moves ours and leaves the other writer alone in the same pass', () => {
  // Both rules at once, which is where an implementation with only one of them
  // looks correct on a single-entry fixture.
  const local = groupForSingleList([album(MUSIC_A, 'music')]);
  const baseline: PrivacyBaseline = {
    public: { feeds: [MUSIC_A], items: [] },
    private: { feeds: [], items: [] },
  };

  const plan = publishPlan({
    mode: 'private',
    publicRead: halfWith(MUSIC_A, FOREIGN),
    privateRead: EMPTY_PARSED,
    local,
    baseline,
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(FOREIGN)], 'ours left, theirs stayed');
  assert.deepEqual(feedsOf(plan.privateTags!), [showId(MUSIC_A)]);
});

// ---------------------------------------------------------------------------
// Defect 1 — idempotence is decided on the decrypted array
// ---------------------------------------------------------------------------

test('a second cycle with nothing changed produces identical tags on both halves', () => {
  // NIP-44 draws a fresh nonce, so the CIPHERTEXT differs on every pass and a
  // writer comparing it republishes forever — two apps rewriting the event
  // against each other, self-inflicted. `publishPlan` returns `privateTags`
  // rather than a ciphertext precisely so the caller digests this instead.
  const local = groupForSingleList([album(MUSIC_A, 'music'), track('t1', MUSIC_A, 'music')]);
  const baseline: PrivacyBaseline = {
    public: { feeds: [], items: [] },
    private: { feeds: [MUSIC_A], items: ['t1'] },
  };
  const read = {
    publicRead: halfWith(FOREIGN),
    privateRead: parseSingleList([
      ['alt', LIST_ALT],
      ['medium', 'music'],
      ['i', showId(MUSIC_A)],
      ['i', itemId('t1')],
    ]),
  };

  const first = publishPlan({ mode: 'private', ...read, local, baseline });
  const second = publishPlan({
    mode: 'private',
    publicRead: parseSingleList(first.tags),
    privateRead: parseSingleList(first.privateTags!),
    local,
    baseline: first.baseline,
  });

  assert.deepEqual(second.tags, first.tags);
  assert.deepEqual(second.privateTags, first.privateTags);
});

// ---------------------------------------------------------------------------
// Defect 4 — the inactive half is carried, not painted into local state
// ---------------------------------------------------------------------------

test('the reconcile sees the active half whole and only our part of the other', () => {
  const baseline: PrivacyBaseline = {
    public: { feeds: [], items: [] },
    private: { feeds: [MUSIC_B], items: [] },
  };
  const input = reconcileInput({
    mode: 'public',
    publicRead: halfWith(MUSIC_A),
    privateRead: halfWith(MUSIC_B, FOREIGN),
    baseline,
  });
  const guids = input.groups.map((g) => g.feedGuid).sort();
  assert.deepEqual(
    guids,
    [MUSIC_A, MUSIC_B].sort(),
    'ours from both halves — MUSIC_B is mid-move and must not vanish from the page'
  );
  assert.equal(
    guids.includes(FOREIGN),
    false,
    "another writer's private entry is carried on the wire but never adopted"
  );
});

test('adopting a foreign private entry would republish it as a public tag', () => {
  // Why the filter above is a disclosure rule and not tidiness. Local state is
  // written through and read back as `local`, which goes wholly into the ACTIVE
  // half — so an adopted private entry comes back out as a plaintext `i` tag,
  // and `i` is indexed by relays.
  const adopted = groupForSingleList([album(FOREIGN, 'music')]);
  const plan = publishPlan({
    mode: 'public',
    publicRead: EMPTY_PARSED,
    privateRead: halfWith(FOREIGN),
    local: adopted,
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(
    feedsOf(plan.tags),
    [showId(FOREIGN)],
    'this is the outcome reconcileInput exists to prevent reaching'
  );
});

test('claimedByBaseline keeps our items and drops the rest of the group', () => {
  const groups = parseSingleList([
    ['alt', LIST_ALT],
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
    ['i', itemId('mine')],
    ['i', itemId('theirs')],
  ]).groups;

  const kept = claimedByBaseline(groups, { feeds: [], items: ['mine'] });
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].itemGuids, ['mine']);
  assert.equal(kept[0].favorited, false, 'the feed itself was never ours to claim');

  assert.deepEqual(claimedByBaseline(groups, { feeds: [], items: [] }), [], 'claim nothing, keep nothing');
});

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

test('leaving Nostr removes what this device claims and nothing else', () => {
  const plan = withdrawalPlan({
    publicRead: halfWith(MUSIC_A, FOREIGN),
    privateRead: halfWith(MUSIC_B),
    baseline: {
      public: { feeds: [MUSIC_A], items: [] },
      private: { feeds: [MUSIC_B], items: [] },
    },
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(FOREIGN)], "the other app's entry stays");
  assert.deepEqual(feedsOf(plan.privateTags!), []);
  assert.deepEqual(
    plan.baseline,
    EMPTY_BASELINE,
    'and afterwards this device claims nothing, so re-opting-in starts clean'
  );
});

test('a withdrawal on a device that claims nothing deletes nothing', () => {
  // The fresh-install case. Signing in on a new device and immediately opting
  // out must not take down a list that device never contributed to.
  const plan = withdrawalPlan({
    publicRead: halfWith(MUSIC_A, FOREIGN),
    privateRead: halfWith(MUSIC_B),
    baseline: EMPTY_BASELINE,
  });
  assert.deepEqual(feedsOf(plan.tags), [showId(MUSIC_A), showId(FOREIGN)]);
  assert.deepEqual(feedsOf(plan.privateTags!), [showId(MUSIC_B)]);
});
