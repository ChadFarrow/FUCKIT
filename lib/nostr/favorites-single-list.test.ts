/**
 * npx tsx --test lib/nostr/favorites-single-list.test.ts
 *
 * Pins the kind:10333 single-list format (PC20-Nostr,
 * `pc20-favorites-single-list.md`) — Podcasting 2.0 data shared over Nostr.
 *
 * Why this earns a test file: in this format an entry's parent feed and its
 * medium are both carried by tag ORDER, not by the tag itself. A reordering
 * that would be cosmetic in any other event re-parents tracks and re-labels
 * media here, and it does so silently — the event stays well-formed, every
 * identifier is still present, and only the meaning changes. So the assertions
 * below are about sequence at least as much as about content.
 *
 * The spec lists test vectors as an open question; these are a first set.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIST_ALT,
  SINGLE_LIST_KIND,
  buildSingleListTags,
  groupForSingleList,
  parseSingleList,
  partitionSingleList,
  singleListDigest,
  singleListTemplate,
} from './favorites-single-list';
import { itemId, showId, type FavoriteEntry } from './pc20-identifiers';

// Real-shaped guids. MUSIC_A and POD_B are favorited feeds; MUSIC_C is not —
// it appears only because a track of its was favorited. NO_MEDIUM_D is a feed
// that never declared <podcast:medium>.
const MUSIC_A = '9b024349-ccf0-5f69-a609-6b82873eab3c';
const POD_B = 'c31ad2f6-1b7e-5b34-a2a4-6b06d5b0b4e2';
const MUSIC_C = '4a7c1e58-2d93-5f04-b6e1-8c5a90d3f2b7';
const NO_MEDIUM_D = '791338e2-77bc-579e-8c7c-4c996cf73305';

const album = (guid: string, medium?: string): FavoriteEntry => ({ id: showId(guid), medium });
const track = (guid: string, parent: string, medium?: string): FavoriteEntry => ({
  id: itemId(guid),
  feedRef: showId(parent),
  medium,
});

/** Tags as `"type:value"` strings — the readable form for sequence assertions. */
const seq = (tags: string[][]) => tags.map((t) => `${t[0]}:${t[1]}`);

test('the event is a plain replaceable kind with an alt tag and empty content', () => {
  const template = singleListTemplate([album(MUSIC_A, 'music')], 1_700_000_000);
  assert.equal(template.kind, SINGLE_LIST_KIND);
  assert.equal(template.kind, 10333);
  assert.equal(template.content, '');
  // No `d` tag: kind 10333 is plainly replaceable, one per pubkey.
  assert.equal(
    template.tags.some((t) => t[0] === 'd'),
    false
  );
  assert.deepEqual(template.tags[0], ['alt', LIST_ALT]);
});

test('an album with no favorited tracks emits a feed group and nothing else', () => {
  assert.deepEqual(seq(buildSingleListTags([album(MUSIC_A, 'music')])), [
    `alt:${LIST_ALT}`,
    'medium:music',
    `i:podcast:guid:${MUSIC_A}`,
    'k:podcast:guid',
  ]);
});

test("a track's entry follows its parent feed's entry", () => {
  assert.deepEqual(
    seq(buildSingleListTags([album(MUSIC_A, 'music'), track('t1', MUSIC_A, 'music')])),
    [
      `alt:${LIST_ALT}`,
      'medium:music',
      `i:podcast:guid:${MUSIC_A}`,
      'i:podcast:item:guid:t1',
      'k:podcast:guid',
      'k:podcast:item:guid',
    ]
  );
});

test('k tags are one per distinct KIND, trailing — not one per entry', () => {
  // The spec pairs a `k` with every `i`. That restates position 1, which
  // already carries the kind as its prefix: on the first real event it cost
  // 423 tags holding two distinct values, ~11 KB of 36 KB. A reader must take
  // an entry's kind from the identifier, not from an adjacent tag.
  const tags = buildSingleListTags([
    album(MUSIC_A, 'music'),
    track('t1', MUSIC_A, 'music'),
    track('t2', MUSIC_A, 'music'),
    album(POD_B, 'podcast'),
  ]);
  assert.equal(tags.filter((t) => t[0] === 'i').length, 4);
  assert.deepEqual(
    tags.filter((t) => t[0] === 'k').map((t) => t[1]),
    ['podcast:guid', 'podcast:item:guid']
  );
  // Trailing, so they cannot disturb grouping — only `i` and `medium` are
  // positional, and a `k` landing mid-list would be inert but confusing.
  assert.deepEqual(
    tags.slice(-2).map((t) => t[0]),
    ['k', 'k']
  );
});

test('a parent feed group is opened even when the feed itself is not favorited', () => {
  // THE PLACEMENT CASE. There is no other way to say which feed a track came
  // from, so a favorited track drags its parent onto the list. 114 of 159
  // parents were in this state in real data. What a reader does with the guid
  // is the reader's business — this only has to say it.
  const groups = groupForSingleList([track('t9', MUSIC_C, 'music')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].feedGuid, MUSIC_C);
  assert.equal(groups[0].favorited, false);
  assert.deepEqual(seq(buildSingleListTags([track('t9', MUSIC_C, 'music')])), [
    `alt:${LIST_ALT}`,
    'medium:music',
    `i:podcast:guid:${MUSIC_C}`,
    'i:podcast:item:guid:t9',
    'k:podcast:guid',
    'k:podcast:item:guid',
  ]);
});

test('same-medium feeds stay contiguous and medium appears once per group', () => {
  // Interleaving media would re-label entries, because the tag applies to
  // everything that follows it. The input here is deliberately interleaved.
  const tags = buildSingleListTags([
    album(MUSIC_A, 'music'),
    album(POD_B, 'podcast'),
    track('t1', MUSIC_A, 'music'),
  ]);
  assert.deepEqual(seq(tags), [
    `alt:${LIST_ALT}`,
    'medium:music',
    `i:podcast:guid:${MUSIC_A}`,
    'i:podcast:item:guid:t1',
    'medium:podcast',
    `i:podcast:guid:${POD_B}`,
    'k:podcast:guid',
    'k:podcast:item:guid',
  ]);
  assert.equal(tags.filter((t) => t[0] === 'medium').length, 2);
});

test('a feed that declared no medium is not published as music', () => {
  // `Feed.medium` is NULL until a feed says otherwise and nothing may default
  // it — least of all `Feed.type`, which defaults to "album". Unknown-medium
  // groups therefore go ahead of every `medium` tag rather than inheriting one.
  const tags = buildSingleListTags([
    album(MUSIC_A, 'music'),
    track('t7', NO_MEDIUM_D, undefined),
  ]);
  assert.deepEqual(seq(tags), [
    `alt:${LIST_ALT}`,
    `i:podcast:guid:${NO_MEDIUM_D}`,
    'i:podcast:item:guid:t7',
    'medium:music',
    `i:podcast:guid:${MUSIC_A}`,
    'k:podcast:guid',
    'k:podcast:item:guid',
  ]);
  // Nothing before the first `medium` tag claims a medium at all.
  assert.equal(tags.findIndex((t) => t[0] === 'medium') > 0, true);
});

test('a URL-shaped item guid does not corrupt its k tag', () => {
  // Item guids are routinely permalinks. "Everything before the last colon"
  // yields `podcast:item:guid:https`, a k value no relay filter matches — so
  // the kind comes from the table in `identifierKind`, never from scanning.
  const tags = buildSingleListTags([track('https://example.com/ep/42', MUSIC_A, 'music')]);
  assert.deepEqual(
    tags.find((t) => t[1] === 'podcast:item:guid:https://example.com/ep/42'),
    ['i', 'podcast:item:guid:https://example.com/ep/42']
  );
  assert.deepEqual(
    tags.filter((t) => t[0] === 'k').map((t) => t[1]),
    ['podcast:guid', 'podcast:item:guid']
  );
});

test('an item with no resolvable parent is dropped, not given an invented one', () => {
  const orphan: FavoriteEntry = { id: itemId('t-orphan'), medium: 'music' };
  assert.deepEqual(groupForSingleList([orphan]), []);
  assert.deepEqual(seq(buildSingleListTags([orphan])), [`alt:${LIST_ALT}`]);
});

test('a parent given as a bare guid is accepted, as well as the prefixed form', () => {
  const bare: FavoriteEntry = { id: itemId('t2'), feedRef: MUSIC_A, medium: 'music' };
  const prefixed = track('t2', MUSIC_A, 'music');
  assert.deepEqual(buildSingleListTags([bare]), buildSingleListTags([prefixed]));
});

test('an album and a track of the same feed produce ONE group', () => {
  const groups = groupForSingleList([
    track('t1', MUSIC_A, 'music'),
    album(MUSIC_A, 'music'),
    track('t2', MUSIC_A, 'music'),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].favorited, true);
  assert.deepEqual(groups[0].itemGuids, ['t1', 't2']);
});

test('a duplicate favorite does not produce a duplicate tag', () => {
  const tags = buildSingleListTags([
    album(MUSIC_A, 'music'),
    album(MUSIC_A, 'music'),
    track('t1', MUSIC_A, 'music'),
    track('t1', MUSIC_A, 'music'),
  ]);
  assert.equal(tags.filter((t) => t[0] === 'i').length, 2);
});

test('a group opened by a track picks up the medium, wherever it arrives from', () => {
  // The track carries its PARENT's medium — Podcasting 2.0 has no per-item one
  // — so a group opened by a track is already labelled correctly, and the album
  // entry arriving later must not be needed to fix it.
  assert.equal(groupForSingleList([track('t1', MUSIC_C, 'music')])[0].medium, 'music');
  assert.equal(
    groupForSingleList([track('t1', MUSIC_A, undefined), album(MUSIC_A, 'music')])[0].medium,
    'music'
  );
});

test('idempotence — the same inputs twice produce byte-identical tags', () => {
  // Republishing replaces the whole event, so churn here is a real cost: a new
  // signature, a new relay write, and a `created_at` bump for nothing.
  const items = [
    album(MUSIC_A, 'music'),
    track('t1', MUSIC_A, 'music'),
    album(POD_B, 'podcast'),
    track('t9', MUSIC_C, 'music'),
    track('t7', NO_MEDIUM_D, undefined),
  ];
  assert.equal(singleListDigest(items), singleListDigest(items));
  assert.deepEqual(buildSingleListTags(items), buildSingleListTags([...items]));
  // ...and the digest is what it is FOR: a favorite toggle that does change
  // this event must be detectable, or the publish would be skipped.
  assert.notEqual(singleListDigest(items), singleListDigest(items.slice(0, -1)));
});

test('unfavoriting a feed whose track is still favorited is INVISIBLE on the wire', () => {
  // Not a bug in this module — a property of the format, and the sharpest edge
  // in it. A feed group opened for placement is byte-identical to one opened
  // because the user favorited the feed, so removing the feed favorite while a
  // track of it remains favorited produces the exact same event.
  //
  // The consequence for a reader: it cannot be told that the album was
  // unfavorited, and this app cannot say so. The two-list format could — the
  // parent lived on the item's own tag, so the feed entry was free to vanish.
  const withAlbum = [album(MUSIC_A, 'music'), track('t1', MUSIC_A, 'music')];
  const withoutAlbum = [track('t1', MUSIC_A, 'music')];
  assert.equal(singleListDigest(withAlbum), singleListDigest(withoutAlbum));

  // It IS visible once the last track goes too, which is the only way out.
  assert.notEqual(singleListDigest(withoutAlbum), singleListDigest([]));

  // And the local distinction survives even though the wire one doesn't, so a
  // future reader has something to work with if the spec ever gains a marker.
  assert.equal(groupForSingleList(withAlbum)[0].favorited, true);
  assert.equal(groupForSingleList(withoutAlbum)[0].favorited, false);
});

test('an empty library is a well-formed event, not a broken one', () => {
  assert.deepEqual(buildSingleListTags([]), [['alt', LIST_ALT]]);
});

// --- reading ---------------------------------------------------------------

test('round trip — what we write is what we read back', () => {
  const items = [
    album(MUSIC_A, 'music'),
    track('t1', MUSIC_A, 'music'),
    album(POD_B, 'podcast'),
    track('t9', MUSIC_C, 'music'),
  ];
  const { groups, orphanItemGuids } = parseSingleList(buildSingleListTags(items));

  assert.deepEqual(orphanItemGuids, []);
  assert.deepEqual(
    groups.map((g) => [g.feedGuid, g.medium, g.itemGuids]),
    [
      [MUSIC_A, 'music', ['t1']],
      [MUSIC_C, 'music', ['t9']],
      [POD_B, 'podcast', []],
    ]
  );
});

test('the running medium applies until the next medium tag, not just to one entry', () => {
  const { groups } = parseSingleList([
    ['alt', LIST_ALT],
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
    ['i', showId(MUSIC_C)],
    ['medium', 'podcast'],
    ['i', showId(POD_B)],
  ]);
  assert.deepEqual(
    groups.map((g) => [g.feedGuid, g.medium]),
    [
      [MUSIC_A, 'music'],
      [MUSIC_C, 'music'],
      [POD_B, 'podcast'],
    ]
  );
});

test('an entry before any medium tag is UNKNOWN, not podcast', () => {
  // Deliberate divergence from the spec's default. This app writes its own
  // unknown-medium groups in exactly that position, so honouring the default
  // would round-trip "not told" into "podcast" and file a music release under
  // Podcasts. The hint is advisory and a resolved answer wins.
  const { groups } = parseSingleList([
    ['alt', LIST_ALT],
    ['i', showId(NO_MEDIUM_D)],
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
  ]);
  assert.equal(groups[0].medium, undefined);
  assert.equal(groups[1].medium, 'music');
});

test('an item attaches to the most recently opened group, not the first', () => {
  const { groups } = parseSingleList([
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
    ['i', itemId('t1')],
    ['i', showId(MUSIC_C)],
    ['i', itemId('t9')],
  ]);
  assert.deepEqual(groups.map((g) => g.itemGuids), [['t1'], ['t9']]);
});

test('BOTH k forms parse the same — paired as the spec writes it, or trailing', () => {
  // The reader must accept what other apps write, including the form this app
  // no longer emits. `k` is ignored entirely: an entry's kind comes from its
  // identifier, which is the only reading that works for both.
  const paired = parseSingleList([
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
    ['k', 'podcast:guid'],
    ['i', itemId('t1')],
    ['k', 'podcast:item:guid'],
  ]);
  const trailing = parseSingleList([
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
    ['i', itemId('t1')],
    ['k', 'podcast:guid'],
    ['k', 'podcast:item:guid'],
  ]);
  assert.deepEqual(paired, trailing);
});

test('an item before any feed group is KEPT as an orphan, not dropped', () => {
  // This app never writes one; another writer might, and dropping it loses a
  // favorite. It cannot resolve through /episodes/byguid without a parent, but
  // it can still match a local row by its own guid.
  const { groups, orphanItemGuids } = parseSingleList([
    ['alt', LIST_ALT],
    ['i', itemId('t-loose')],
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
  ]);
  assert.deepEqual(orphanItemGuids, ['t-loose']);
  assert.equal(groups.length, 1);
  const { tracks } = partitionSingleList({ groups, orphanItemGuids });
  assert.deepEqual(tracks, [{ itemGuid: 't-loose' }]);
});

test('an unrecognized identifier kind is skipped, never guessed at', () => {
  const { groups, orphanItemGuids } = parseSingleList([
    ['i', 'podcast:publisher:guid:0e8f6a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b'],
    ['i', 'something:else:entirely'],
    ['medium', 'music'],
    ['i', showId(MUSIC_A)],
  ]);
  assert.deepEqual(groups.map((g) => g.feedGuid), [MUSIC_A]);
  assert.deepEqual(orphanItemGuids, []);
});

test('partition carries the group medium onto every track under it', () => {
  // Podcasting 2.0 has no per-item medium — an item's is its feed's — and the
  // reconcile needs one per track to type a new row.
  const { shows, tracks } = partitionSingleList(
    parseSingleList(buildSingleListTags([album(POD_B, 'podcast'), track('t1', POD_B, 'podcast')]))
  );
  assert.deepEqual(shows, [{ feedGuid: POD_B, medium: 'podcast' }]);
  assert.deepEqual(tracks, [{ itemGuid: 't1', feedGuid: POD_B, medium: 'podcast' }]);
});

test('a degraded read is not an empty list — parse never invents that distinction', () => {
  // The trust flag lives in `relay-read.ts`; this only pins that an event with
  // no entries parses as empty rather than throwing, so the two states stay
  // distinguishable by the caller rather than here.
  assert.deepEqual(parseSingleList([['alt', LIST_ALT]]), { groups: [], orphanItemGuids: [] });
});
