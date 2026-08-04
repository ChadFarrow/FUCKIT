import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrackAvailable, resolveAlbumRewindIndex } from './album-rewind';

test('an ordinary album rewinds to the first track', () => {
  assert.equal(resolveAlbumRewindIndex([{}, {}, {}]), 0);
});

test('a single-track album rewinds to itself', () => {
  // Worth pinning: the old branch never rewound a one-track album at all,
  // because playNextTrack's end-of-album case did no media work.
  assert.equal(resolveAlbumRewindIndex([{}]), 0);
});

test('skips leading unavailable tracks', () => {
  // The old hard-coded 0 parked the UI on a track that could never play.
  assert.equal(
    resolveAlbumRewindIndex([
      { status: 'unavailable' },
      { status: 'unavailable' },
      { status: 'active' },
    ]),
    2
  );
});

test('treats a missing status as available', () => {
  // Most Track rows carry no status at all; those must not be skipped.
  assert.equal(resolveAlbumRewindIndex([{ status: 'unavailable' }, {}]), 1);
});

test('returns null when every track is unavailable', () => {
  assert.equal(
    resolveAlbumRewindIndex([{ status: 'unavailable' }, { status: 'dead' }]),
    null
  );
});

test('returns null for an empty or missing track list', () => {
  assert.equal(resolveAlbumRewindIndex([]), null);
  assert.equal(resolveAlbumRewindIndex(undefined), null);
  assert.equal(resolveAlbumRewindIndex(null), null);
});

test('isTrackAvailable matches the advance loop rule', () => {
  assert.equal(isTrackAvailable({}), true);
  assert.equal(isTrackAvailable({ status: 'active' }), true);
  assert.equal(isTrackAvailable({ status: 'unavailable' }), false);
  assert.equal(isTrackAvailable(undefined), false);
  assert.equal(isTrackAvailable(null), false);
});
