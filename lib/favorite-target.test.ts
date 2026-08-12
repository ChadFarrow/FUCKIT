import { test } from 'node:test';
import assert from 'node:assert/strict';

import { singleTrackFavoriteData } from './favorite-target';

/**
 * The bug these pin: a single-track release favorited from the home "New" tab
 * appeared unfavorited on its own album page. The list row passed only
 * `feedId` (album favorite) while the album page passed track data (track
 * favorite), so the page looked up a key nothing had written.
 *
 * Every surface now derives the target here, so what matters is that this
 * function is deterministic for a given album — the same album must never
 * yield a different key depending on who asked.
 */

const track = (over: Record<string, unknown> = {}) => ({
  id: 'track-id',
  guid: 'track-guid',
  url: 'https://example.com/a.mp3',
  title: 'The Wedding',
  ...over,
});

test('a one-track album favorites as that track', () => {
  const r = singleTrackFavoriteData({ feedId: 'feed-1', artist: 'Nate Mohican', tracks: [track()] });
  assert.equal(r?.id, 'track-guid');
  assert.equal(r?.title, 'The Wedding');
  assert.equal(r?.artist, 'Nate Mohican');
});

test('a multi-track album favorites as an album', () => {
  assert.equal(
    singleTrackFavoriteData({ feedId: 'feed-1', tracks: [track(), track({ guid: 'b' })] }),
    undefined
  );
});

test('an album with no tracks favorites as an album', () => {
  assert.equal(singleTrackFavoriteData({ feedId: 'feed-1', tracks: [] }), undefined);
});

test('MISSING tracks are not treated as a single track', () => {
  // A surface that never loaded tracks cannot tell a single from a ten-track
  // record. Guessing here is what split the same album across two keys.
  assert.equal(singleTrackFavoriteData({ feedId: 'feed-1' }), undefined);
  assert.equal(singleTrackFavoriteData({ feedId: 'feed-1', tracks: null }), undefined);
  assert.equal(singleTrackFavoriteData(null), undefined);
  assert.equal(singleTrackFavoriteData(undefined), undefined);
});

test('the id chain is guid, then url, then id, then the composite', () => {
  const feedId = 'feed-1';
  assert.equal(singleTrackFavoriteData({ feedId, tracks: [track()] })?.id, 'track-guid');

  assert.equal(
    singleTrackFavoriteData({ feedId, tracks: [track({ guid: null })] })?.id,
    'https://example.com/a.mp3'
  );

  // The `id` rung existed only in AlbumCard, so a track with neither guid nor
  // url resolved differently on the card than on the album page.
  assert.equal(
    singleTrackFavoriteData({ feedId, tracks: [track({ guid: null, url: null })] })?.id,
    'track-id'
  );

  assert.equal(
    singleTrackFavoriteData({ feedId, tracks: [track({ guid: null, url: null, id: undefined })] })?.id,
    'feed-1-The Wedding'
  );
});

test('no derivable id means no track favorite, rather than a broken key', () => {
  assert.equal(
    singleTrackFavoriteData({ feedId: 'feed-1', tracks: [{ guid: null, url: null, title: null }] }),
    undefined
  );
  // Without a feedId the composite cannot be built either.
  assert.equal(
    singleTrackFavoriteData({ tracks: [{ guid: null, url: null, title: 'The Wedding' }] }),
    undefined
  );
});

test('the same album yields the same key however it is asked', () => {
  const album = { feedId: 'feed-1', artist: 'Nate Mohican', tracks: [track({ guid: null })] };
  // The list row, the card and the album page all call this now; a copy of the
  // album object (as each surface holds its own) must not change the answer.
  assert.deepEqual(
    singleTrackFavoriteData(album),
    singleTrackFavoriteData(JSON.parse(JSON.stringify(album)))
  );
});
