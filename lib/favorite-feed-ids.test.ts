import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickFavoriteRowForWrite,
  buildFeedIdEquivalence,
  feedLookupWhere,
  flattenFeedIdEquivalence,
  isFeedIdFavorited,
} from './favorite-feed-ids';

/**
 * `FavoriteAlbum.feedId` is polymorphic and has no migration, so a lookup that
 * compares the one string it was handed misses favorites the user can see
 * listed. These pin the expansion — and specifically the case that had no
 * coverage anywhere and is the reason this was extracted (issue #192).
 */

const A = { id: 'the-doerfels-album', guid: 'guid-A' };
const B = { id: 'guid-A', guid: 'guid-B' }; // id IS another feed's guid

test('an input resolves to its own feed id and guid', () => {
  const map = buildFeedIdEquivalence(['the-doerfels-album'], [A]);
  assert.deepEqual(map.get('the-doerfels-album')?.sort(), ['guid-A', 'the-doerfels-album']);
});

test('a guid input resolves to the feed id too', () => {
  const map = buildFeedIdEquivalence(['guid-A'], [A]);
  assert.ok(map.get('guid-A')?.includes('the-doerfels-album'));
});

// ---------------------------------------------------------------------------
// The case this file exists for.
// ---------------------------------------------------------------------------

test('TWO feeds matching one input contribute BOTH sets of identifiers', () => {
  // `Feed.id` is the primary key and `Feed.guid` is @unique, so one string can
  // match two rows: A by guid, B by id. Reachable today — resolve-mmm-tracks
  // mints a feed whose id IS a podcast guid.
  const map = buildFeedIdEquivalence(['guid-A'], [A, B]);
  const ids = map.get('guid-A')!;

  assert.ok(ids.includes('the-doerfels-album'), "A's id must survive");
  assert.ok(ids.includes('guid-B'), "B's guid must survive");
  assert.ok(ids.includes('guid-A'));
});

test('taking only the first match is what dropped a favorite', () => {
  // Documents the old `feeds.find(...)` behaviour so it cannot come back
  // looking like a simplification: whichever row Prisma yielded first won, and
  // the other feed's identifiers were never queried.
  const firstMatchOnly = [A, B].find((f) => f.id === 'guid-A' || f.guid === 'guid-A');
  assert.equal(firstMatchOnly, A);

  const expanded = buildFeedIdEquivalence(['guid-A'], [A, B]).get('guid-A')!;
  assert.ok(expanded.includes('guid-B'), 'the expansion keeps what find() dropped');
});

// ---------------------------------------------------------------------------
// Inputs with no feed row at all.
// ---------------------------------------------------------------------------

test('an unmatched input still resolves to itself', () => {
  // Synthetic artist ids and guids with no local Feed row have to keep working.
  const map = buildFeedIdEquivalence(['artist-adam-curry'], []);
  assert.deepEqual(map.get('artist-adam-curry'), ['artist-adam-curry']);
});

test('a feed with a null guid contributes only its id', () => {
  const map = buildFeedIdEquivalence(['only-id'], [{ id: 'only-id', guid: null }]);
  assert.deepEqual(map.get('only-id'), ['only-id']);
});

test('duplicate inputs are collapsed', () => {
  const map = buildFeedIdEquivalence(['guid-A', 'guid-A'], [A]);
  assert.equal(map.size, 1);
});

test('empty ids are skipped rather than queried for', () => {
  assert.equal(buildFeedIdEquivalence([''], [A]).size, 0);
});

// ---------------------------------------------------------------------------
// flatten / isFeedIdFavorited
// ---------------------------------------------------------------------------

test('flattening de-duplicates across inputs', () => {
  const map = buildFeedIdEquivalence(['guid-A', 'the-doerfels-album'], [A]);
  const flat = flattenFeedIdEquivalence(map).sort();
  assert.deepEqual(flat, ['guid-A', 'the-doerfels-album']);
});

test('a hit on ANY identifier counts as favorited', () => {
  const map = buildFeedIdEquivalence(['the-doerfels-album'], [A]);

  // The row was stored under the guid; the card asks with the id.
  assert.equal(isFeedIdFavorited('the-doerfels-album', map, new Set(['guid-A'])), true);
  assert.equal(isFeedIdFavorited('the-doerfels-album', map, new Set(['guid-B'])), false);
});

test('an input absent from the map still checks itself', () => {
  assert.equal(isFeedIdFavorited('unseen', new Map(), new Set(['unseen'])), true);
  assert.equal(isFeedIdFavorited('unseen', new Map(), new Set()), false);
});

test('the two-row case resolves a favorite stored under either feed', () => {
  const map = buildFeedIdEquivalence(['guid-A'], [A, B]);

  assert.equal(isFeedIdFavorited('guid-A', map, new Set(['the-doerfels-album'])), true);
  assert.equal(isFeedIdFavorited('guid-A', map, new Set(['guid-B'])), true);
});

// ---------------------------------------------------------------------------
// feedLookupWhere
// ---------------------------------------------------------------------------

test('the lookup asks by id OR guid, de-duplicated', () => {
  const where = feedLookupWhere(['a', 'a', 'b', '']);
  assert.deepEqual(where, { OR: [{ id: { in: ['a', 'b'] } }, { guid: { in: ['a', 'b'] } }] });
});

// ---------------------------------------------------------------------------
// pickFavoriteRowForWrite — reads union, writes disambiguate
// ---------------------------------------------------------------------------

const R1 = { id: 'row-1', feedId: 'the-doerfels-album', nostrEventId: null };
const R2 = { id: 'row-2', feedId: 'guid-A', nostrEventId: null };

test('an exact feedId match wins over the rest of the equivalence set', () => {
  // The case that matters: syncFavoritesToNostr PATCHes once per row with that
  // row's OWN feedId, so each call has to land on its own row. An arbitrary
  // pick gives one row the event id published for the other's d-tag.
  assert.equal(pickFavoriteRowForWrite([R1, R2], 'guid-A')?.id, 'row-2');
  assert.equal(pickFavoriteRowForWrite([R1, R2], 'the-doerfels-album')?.id, 'row-1');
});

test('row order from the DB does not change the answer', () => {
  // `findMany` has no orderBy, so this must not depend on what Postgres yields.
  assert.equal(pickFavoriteRowForWrite([R2, R1], 'guid-A')?.id, 'row-2');
  assert.equal(pickFavoriteRowForWrite([R2, R1], 'the-doerfels-album')?.id, 'row-1');
});

test('with no exact match the fallback is deterministic, not arbitrary', () => {
  const a = pickFavoriteRowForWrite([R1, R2], 'some-other-id');
  const b = pickFavoriteRowForWrite([R2, R1], 'some-other-id');

  assert.equal(a?.id, b?.id);
  assert.equal(a?.feedId, 'guid-A'); // sorted by feedId
});

test('a single row is returned whether or not it matches exactly', () => {
  assert.equal(pickFavoriteRowForWrite([R1], 'the-doerfels-album')?.id, 'row-1');
  assert.equal(pickFavoriteRowForWrite([R1], 'guid-A')?.id, 'row-1');
});

test('no rows means no row', () => {
  assert.equal(pickFavoriteRowForWrite([], 'anything'), null);
});

test('the reachable two-row shape: guid-as-id row plus a normally-imported row', () => {
  // `resolve-mmm-tracks` mints `{ id: G, guid: null }`; a later normal import
  // of the same show adds `{ id: <slug>, guid: G }`. The value of taking ALL
  // matches is the SECOND row's slug — `find()` returning the first yields only
  // `{G}` and a favorite stored under the slug misses.
  const guidAsId = { id: 'G', guid: null };
  const normalImport = { id: 'the-doerfels-album', guid: 'G' };

  const map = buildFeedIdEquivalence(['G'], [guidAsId, normalImport]);
  assert.deepEqual(map.get('G'), ['G', 'the-doerfels-album']);

  // ...and order of the rows from the DB must not matter.
  const reversed = buildFeedIdEquivalence(['G'], [normalImport, guidAsId]);
  assert.deepEqual([...(reversed.get('G') ?? [])].sort(), ['G', 'the-doerfels-album']);

  assert.equal(isFeedIdFavorited('G', map, new Set(['the-doerfels-album'])), true);
});
