/**
 * npx tsx --test lib/nostr/shared-favorites.test.ts
 *
 * Pins the cross-app favorites merge — the function that decides what stays on
 * a Nostr list several apps write to. The same vectors are pinned on the Boost
 * Me Bitch side by `npm run check:favsync`; if you change one, change both, or
 * the two implementations drift apart on a list they share.
 *
 * Why this earns a test file: the shared list is ONE kind:30003 replaceable
 * event at a well-known address (docs/pc20-favorites.md). A replaceable event
 * has no partial update — every publish replaces the whole thing — so a merge
 * bug doesn't degrade, it DELETES, silently, on someone else's device, with no
 * undo and no error anywhere. The three ways to get it wrong all type-check:
 *
 *   - Publish the local set → every entry another app added is erased.
 *   - Publish the union → unfavoriting stops working, permanently.
 *   - Interpret before merging → identifier kinds this app doesn't implement
 *     get dropped as "unrecognized" the first time this app publishes.
 *
 * The must-still-work half is the removal cases: a merge that never deletes
 * anything is trivially safe and completely useless, so `lastSynced` semantics
 * are pinned in both directions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  identifierKind,
  itemId,
  itemsFromTags,
  mergeSharedFavorites,
  otherTagsFrom,
  partitionSharedFavorites,
  showId,
  tagsForSharedFavorites,
  SHARED_D_TAG,
  type SharedFavoriteItem,
} from './shared-favorites';

// Real-shaped identifiers. A is an album this app favorited, B a show another
// app added, C a track, X an identifier kind this app doesn't implement.
const A = showId('9b024349-ccf0-5f69-a609-6b82873eab3c');
const B = showId('c31ad2f6-1b7e-5b34-a2a4-6b06d5b0b4e2');
const C = itemId('https://example.com/ep/42');
const X = 'podcast:publisher:guid:0e8f6a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

const ids = (items: SharedFavoriteItem[]) => items.map((i) => i.id);

test('a first publish from a device with no baseline is a pure union', () => {
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [], lastSynced: [], local: [{ id: A }] })),
    [A]
  );
});

test('an entry another app added survives a republish from this app', () => {
  // THE clobber case. Boost Me Bitch added B while this app was closed: B is on
  // the relay but absent from both `local` and `lastSynced`. Publishing the
  // local set here is what wipes the other app's favorites.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: B }], lastSynced: [], local: [{ id: A }] })),
    [B, A]
  );
});

test('a local removal propagates — it was in the baseline and is now gone', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: A }, { id: B }],
        lastSynced: [A, B],
        local: [{ id: B }],
      })
    ),
    [B]
  );
});

test('a local add and a local removal apply on top of a concurrent foreign add', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: A }, { id: X }],
        lastSynced: [A],
        local: [{ id: C }],
      })
    ),
    [X, C]
  );
});

test('an empty local set with no baseline deletes nothing', () => {
  // The single most destructive input: a session that has hydrated nothing yet.
  // With no baseline there are no removals, so the relay's list must survive
  // untouched — an empty `local` must never read as "delete everything".
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }, { id: B }], lastSynced: [], local: [] })),
    [A, B]
  );
});

test('an empty local set with a full baseline is a real clear-all', () => {
  // ...but this one IS the user removing everything, and must be honoured, or
  // the list can never be emptied.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }, { id: B }], lastSynced: [A, B], local: [] })),
    []
  );
});

test('an identifier kind this app does not implement is never dropped', () => {
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: X }], lastSynced: [], local: [{ id: A }] })),
    [X, A]
  );
});

test('a foreign id in the baseline but absent locally IS a removal', () => {
  // The baseline is written from the MERGED list (which includes foreign ids),
  // so this pins that "in lastSynced but not local" means removal regardless of
  // whether we understand the id. Building the baseline from `local` instead
  // would delete X on the very next publish.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: X }], lastSynced: [X], local: [] })),
    []
  );
});

test('surviving entries keep relay order; new local entries append', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: B }, { id: X }, { id: A }],
        lastSynced: [B, X, A],
        local: [{ id: A }, { id: B }, { id: X }, { id: C }],
      })
    ),
    [B, X, A, C]
  );
});

test('a local hint upgrades a relay entry that has none', () => {
  assert.deepEqual(
    mergeSharedFavorites({
      latest: [{ id: A }],
      lastSynced: [A],
      local: [{ id: A, feedUrl: 'https://example.com/feed.xml' }],
    }),
    [{ id: A, feedUrl: 'https://example.com/feed.xml', feedRef: undefined }]
  );
});

test('a relay hint is never blanked by a local entry that lacks one', () => {
  assert.deepEqual(
    mergeSharedFavorites({
      latest: [{ id: A, feedUrl: 'https://example.com/feed.xml' }],
      lastSynced: [A],
      local: [{ id: A }],
    }),
    [{ id: A, feedUrl: 'https://example.com/feed.xml', feedRef: undefined }]
  );
});

// --- wire round trip -------------------------------------------------------

const WIRE_ITEMS: SharedFavoriteItem[] = [
  { id: A, feedUrl: 'https://example.com/feed.xml' },
  { id: C, feedUrl: 'https://example.com/feed.xml', feedRef: A },
  { id: X },
];

test('the d tag is the shared, app-neutral address', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS)[0], ['d', SHARED_D_TAG]);
});

test("another writer's tag is replayed verbatim", () => {
  const tags = tagsForSharedFavorites(WIRE_ITEMS, [['alt', 'from another client']]);
  assert.deepEqual(
    tags.filter((t) => t[0] === 'alt'),
    [['alt', 'from another client']]
  );
});

test('an album is a NIP-73 i tag with the feed URL as the position-2 hint', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS).find((t) => t[1] === A), [
    'i',
    A,
    'https://example.com/feed.xml',
  ]);
});

test('a track carries its parent feed in position 3', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS).find((t) => t[1] === C), [
    'i',
    C,
    'https://example.com/feed.xml',
    A,
  ]);
});

test('k tags are one per distinct identifier kind, not one per favorite', () => {
  assert.deepEqual(
    tagsForSharedFavorites(WIRE_ITEMS).filter((t) => t[0] === 'k'),
    [['k', 'podcast:guid'], ['k', 'podcast:item:guid'], ['k', 'podcast:publisher:guid']]
  );
});

test('a URL-shaped item guid does not corrupt its k tag', () => {
  // Track.guid is very often a permalink URL. Deriving the kind by scanning for
  // a colon yields `podcast:item:guid:https` — a k tag no relay filter matches,
  // and nothing on screen looks wrong.
  assert.equal(identifierKind(itemId('https://example.com/ep/42')), 'podcast:item:guid');
});

test('an unrecognized identifier kind gets no invented k tag', () => {
  assert.equal(identifierKind('some:other:scheme:value'), null);
});

test("but another app's k tag for that kind is preserved, not stripped", () => {
  assert.deepEqual(
    otherTagsFrom([
      ['k', 'some:other:scheme'],
      ['k', 'podcast:guid'],
      ['d', SHARED_D_TAG],
    ]),
    [['k', 'some:other:scheme']]
  );
});

test('tags → items → tags is lossless', () => {
  // What this app writes, a second app must be able to read back identically.
  //
  // Compared through JSON rather than assert.deepEqual, which treats an absent
  // key and an explicit `undefined` as different. The wire has no such
  // distinction — a missing hint is a missing hint — so the strict form would
  // fail on a round trip that is in fact lossless.
  const roundTripped = itemsFromTags(tagsForSharedFavorites(WIRE_ITEMS));
  assert.equal(JSON.stringify(roundTripped), JSON.stringify(WIRE_ITEMS));
  // And the tags themselves must survive a second pass unchanged, which is the
  // property another app actually depends on.
  assert.deepEqual(tagsForSharedFavorites(roundTripped), tagsForSharedFavorites(WIRE_ITEMS));
});

test('a feed ref with no URL hint holds position 2 open', () => {
  assert.deepEqual(tagsForSharedFavorites([{ id: C, feedRef: A }]).find((t) => t[1] === C), [
    'i',
    C,
    '',
    A,
  ]);
  assert.deepEqual(itemsFromTags([['i', C, '', A]]), [
    { id: C, feedUrl: undefined, feedRef: A },
  ]);
});

// --- resolution ------------------------------------------------------------

test('partition splits shows from tracks and drops what it cannot look up', () => {
  const { shows, tracks } = partitionSharedFavorites([
    { id: A, feedUrl: 'https://example.com/feed.xml' },
    { id: C, feedUrl: 'https://example.com/feed.xml', feedRef: A },
    { id: X },
    { id: showId('not-a-uuid') },
  ]);
  assert.deepEqual(shows, [
    { feedGuid: '9b024349-ccf0-5f69-a609-6b82873eab3c', feedUrl: 'https://example.com/feed.xml' },
  ]);
  assert.deepEqual(tracks, [
    {
      itemGuid: 'https://example.com/ep/42',
      feedGuid: '9b024349-ccf0-5f69-a609-6b82873eab3c',
      feedUrl: 'https://example.com/feed.xml',
    },
  ]);
});

test('what partition drops, the merge still carries', () => {
  // Partitioning is lossy on purpose; the wire is not. The publisher entry and
  // the malformed guid must survive a republish from this app even though it
  // has no way to display either.
  const items = [{ id: A }, { id: X }, { id: showId('not-a-uuid') }];
  assert.equal(ids(mergeSharedFavorites({ latest: items, lastSynced: [], local: [] })).length, 3);
});

test('a show identifier is never read as a track', () => {
  const { tracks } = partitionSharedFavorites([{ id: A }, { id: X }]);
  assert.deepEqual(tracks, []);
});
