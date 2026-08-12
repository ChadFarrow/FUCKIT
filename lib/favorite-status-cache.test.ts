import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dropClobberedKeys,
  EMPTY_FAVORITE_STATUSES,
  favoritesIdentityKey,
  localWriteKey,
  mergeFavoriteStatuses,
  selectUnknownIds,
  withFavoriteStatus,
  type FavoriteStatusMap,
} from './favorite-status-cache';

/**
 * The bug these pin (#190): an album favorited from the home "New" tab was
 * listed on /favorites with an UNFILLED heart, and a hard reload fixed it.
 *
 * The cache had no write path, so the `false` recorded when the card first
 * mounted outlived the favorite itself, and `selectUnknownIds` then reported
 * nothing left to ask about — the unfilled heart never reached the server.
 */

const empty = (): FavoriteStatusMap => ({ tracks: {}, albums: {} });

// ---------------------------------------------------------------------------
// The #190 sequence, end to end.
// ---------------------------------------------------------------------------

test('favoriting overwrites the false cached before the toggle', () => {
  // Home grid mounts and asks. Not favorited yet — a correct `false`.
  let cache = mergeFavoriteStatuses(empty(), { albums: { 'feed-a': false } });

  // The user taps the heart. THIS is the write that used to be missing.
  cache = withFavoriteStatus(cache, 'album', 'feed-a', true);

  // Client-side nav to /favorites: same provider, same cache.
  assert.equal(cache.albums['feed-a'], true);
  assert.deepEqual(selectUnknownIds(['feed-a'], cache.albums), []);
});

test('without the write-through, the stale false is served as known', () => {
  // Documents the old behaviour so nobody reintroduces it: a cached `false`
  // is indistinguishable from a checked `false`, which is exactly why the
  // toggle has to write through rather than rely on a re-check.
  const cache = mergeFavoriteStatuses(empty(), { albums: { 'feed-a': false } });

  assert.deepEqual(selectUnknownIds(['feed-a'], cache.albums), []);
  assert.equal(cache.albums['feed-a'], false);
});

test('unfavoriting writes false back', () => {
  let cache = withFavoriteStatus(empty(), 'album', 'feed-a', true);
  cache = withFavoriteStatus(cache, 'album', 'feed-a', false);

  assert.equal(cache.albums['feed-a'], false);
});

// ---------------------------------------------------------------------------
// withFavoriteStatus
// ---------------------------------------------------------------------------

test('tracks and albums are separate stores', () => {
  let cache = withFavoriteStatus(empty(), 'track', 'shared-id', true);
  cache = withFavoriteStatus(cache, 'album', 'shared-id', false);

  assert.equal(cache.tracks['shared-id'], true);
  assert.equal(cache.albums['shared-id'], false);
});

test('never mutates the previous map', () => {
  const before = empty();
  const after = withFavoriteStatus(before, 'album', 'feed-a', true);

  assert.deepEqual(before, { tracks: {}, albums: {} });
  assert.notEqual(after, before);
});

test('an unchanged write returns the same reference', () => {
  // Guards against a re-render loop: the toggle writes on every tap.
  const cache = withFavoriteStatus(empty(), 'album', 'feed-a', true);
  assert.equal(withFavoriteStatus(cache, 'album', 'feed-a', true), cache);
});

test('a missing id is a no-op rather than an undefined key', () => {
  const cache = empty();
  assert.equal(withFavoriteStatus(cache, 'album', undefined, true), cache);
  assert.equal(withFavoriteStatus(cache, 'album', '', true), cache);
});

test('the exported empty map cannot be written through', () => {
  const next = withFavoriteStatus(EMPTY_FAVORITE_STATUSES, 'album', 'feed-a', true);
  assert.equal(next.albums['feed-a'], true);
  assert.deepEqual(EMPTY_FAVORITE_STATUSES.albums, {});
});

// ---------------------------------------------------------------------------
// mergeFavoriteStatuses
// ---------------------------------------------------------------------------

test('a batch response wins over an older cached answer', () => {
  const cache = mergeFavoriteStatuses(
    withFavoriteStatus(empty(), 'album', 'feed-a', false),
    { albums: { 'feed-a': true, 'feed-b': false } }
  );

  assert.equal(cache.albums['feed-a'], true);
  assert.equal(cache.albums['feed-b'], false);
});

test('merging keeps entries the response did not mention', () => {
  const cache = mergeFavoriteStatuses(
    withFavoriteStatus(empty(), 'album', 'feed-a', true),
    { albums: { 'feed-b': true } }
  );

  assert.equal(cache.albums['feed-a'], true);
});

test('a null or partial response is tolerated', () => {
  const cache = withFavoriteStatus(empty(), 'album', 'feed-a', true);

  assert.equal(mergeFavoriteStatuses(cache, null), cache);
  assert.equal(mergeFavoriteStatuses(cache, { tracks: { t: true } }).albums['feed-a'], true);
});

// ---------------------------------------------------------------------------
// dropClobberedKeys — an in-flight answer must not undo a local write
// ---------------------------------------------------------------------------

test('a response in flight during the toggle cannot flip the heart back', () => {
  // A check for feed-a is on the wire...
  const seqAtRequestStart = 0;
  // ...the user favorites it while that request is outstanding.
  const localWrites = { [localWriteKey('album', 'feed-a')]: 1 };

  const merged = mergeFavoriteStatuses(
    withFavoriteStatus(empty(), 'album', 'feed-a', true),
    // The response says false — true when it was sent, stale now.
    dropClobberedKeys({ albums: { 'feed-a': false } }, localWrites, seqAtRequestStart)
  );

  assert.equal(merged.albums['feed-a'], true);
});

test('answers for items the user did not touch still merge', () => {
  const localWrites = { [localWriteKey('album', 'feed-a')]: 1 };
  const kept = dropClobberedKeys(
    { albums: { 'feed-a': false, 'feed-b': true } },
    localWrites,
    0
  );

  assert.deepEqual(kept.albums, { 'feed-b': true });
});

test('a write from BEFORE the request went out yields to the server', () => {
  // Otherwise a stale local write would pin the value forever.
  const localWrites = { [localWriteKey('album', 'feed-a')]: 1 };
  const kept = dropClobberedKeys({ albums: { 'feed-a': false } }, localWrites, 1);

  assert.deepEqual(kept.albums, { 'feed-a': false });
});

test('the two stores are keyed apart', () => {
  // A track write must not shield an album answer for the same string.
  const localWrites = { [localWriteKey('track', 'same-id')]: 5 };
  const kept = dropClobberedKeys(
    { tracks: { 'same-id': false }, albums: { 'same-id': false } },
    localWrites,
    0
  );

  assert.deepEqual(kept.tracks, {});
  assert.deepEqual(kept.albums, { 'same-id': false });
});

test('a null response yields nothing to merge', () => {
  assert.deepEqual(dropClobberedKeys(null, {}, 0), {});
});

// ---------------------------------------------------------------------------
// selectUnknownIds
// ---------------------------------------------------------------------------

test('only unseen ids are asked about, and only once each', () => {
  const known = { 'feed-a': true, 'feed-b': false };
  assert.deepEqual(
    selectUnknownIds(['feed-a', 'feed-b', 'feed-c', 'feed-c'], known),
    ['feed-c']
  );
});

test('empty input asks nothing', () => {
  assert.deepEqual(selectUnknownIds([], {}), []);
});

// ---------------------------------------------------------------------------
// favoritesIdentityKey — mirrors the server's scoping
// ---------------------------------------------------------------------------

test('userId wins over sessionId, matching the API scoping', () => {
  assert.equal(favoritesIdentityKey({ userId: 'u1', sessionId: 's1' }), 'user:u1');
  assert.equal(favoritesIdentityKey({ sessionId: 's1' }), 'session:s1');
  assert.equal(favoritesIdentityKey({}), 'anonymous');
});

test('signing in changes the key, so pre-auth answers are discarded', () => {
  // The pre-hydration check goes out session-scoped and misses every
  // userId-owned row (sync-shared writes those with no sessionId), caching a
  // wrong `false`. Re-keying is what throws that away.
  const beforeAuth = favoritesIdentityKey({ sessionId: 's1' });
  const afterAuth = favoritesIdentityKey({ userId: 'u1', sessionId: 's1' });

  assert.notEqual(beforeAuth, afterAuth);
});

test('the session id is irrelevant once signed in', () => {
  assert.equal(
    favoritesIdentityKey({ userId: 'u1', sessionId: 's1' }),
    favoritesIdentityKey({ userId: 'u1', sessionId: 's2' })
  );
});
