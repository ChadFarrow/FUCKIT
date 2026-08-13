import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CHECK_IDS, parseCheckIds, buildTrackIdIndex } from './favorites-check-input';

test('a normal array passes through', () => {
  assert.deepEqual(parseCheckIds(['a', 'b']), ['a', 'b']);
});

test('a missing value is an empty list, not an error', () => {
  // The route destructures with `= []`, and both arrays are optional.
  assert.deepEqual(parseCheckIds(undefined), []);
  assert.deepEqual(parseCheckIds(null), []);
});

test('a non-array is rejected', () => {
  // `{"trackIds":"abc"}` used to reach Prisma as { in: "abc" } via String.length.
  for (const bad of ['abc', 42, {}, true]) {
    assert.equal(parseCheckIds(bad), null);
  }
});

test('non-string entries are dropped', () => {
  assert.deepEqual(parseCheckIds(['a', 1, null, 'b', {}]), ['a', 'b']);
});

test('duplicates are collapsed', () => {
  assert.deepEqual(parseCheckIds(['a', 'a', 'b']), ['a', 'b']);
});

test('an over-cap array is rejected, never truncated', () => {
  // Truncating would answer "not favorited" for the dropped ids, which is
  // exactly the issue #190 symptom: a favorited album with an unfilled heart.
  const over = Array.from({ length: MAX_CHECK_IDS + 1 }, (_, i) => `id-${i}`);
  assert.equal(parseCheckIds(over), null);
});

test('an exactly-at-cap array is accepted', () => {
  const atCap = Array.from({ length: MAX_CHECK_IDS }, (_, i) => `id-${i}`);
  assert.equal(parseCheckIds(atCap)?.length, MAX_CHECK_IDS);
});

test('the index finds a track by every identifier it answers to', () => {
  const track = { id: 't1', guid: 'g1', audioUrl: 'https://x/a.mp3' };
  const index = buildTrackIdIndex([track]);
  assert.deepEqual(index.get('t1'), track);
  assert.deepEqual(index.get('g1'), track);
  assert.deepEqual(index.get('https://x/a.mp3'), track);
  assert.equal(index.get('nope'), undefined);
});

test('the index tolerates null guid and audioUrl', () => {
  const track = { id: 't1', guid: null, audioUrl: null };
  const index = buildTrackIdIndex([track]);
  assert.deepEqual(index.get('t1'), track);
  assert.equal(index.size, 1);
});

test('the index preserves first-match order on a collision', () => {
  // Matches the previous Array.find behaviour, so results cannot change.
  const first = { id: 'a', guid: 'shared', audioUrl: null };
  const second = { id: 'b', guid: 'shared', audioUrl: null };
  const index = buildTrackIdIndex([first, second]);
  assert.deepEqual(index.get('shared'), first);
});
