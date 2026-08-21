import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  favoriteForTrack,
  resolveFavoriteFeeds,
  resolveFavoriteTracks,
} from './resolve-favorite-rows';

/**
 * The ladders decide WHICH favorites exist, for every caller. The display
 * endpoints render what they return, and `/api/favorites/sync-items` publishes
 * it to a replaceable Nostr event that other apps read. A rung that resolves on
 * one path and not the other does not fail loudly — the favorite is simply on
 * the page and absent from the shared list, or the reverse.
 *
 * So the tests below assert the ladder against ids of every stored form, and
 * assert that two different selects over the same rows agree on the set.
 */

const FEEDS = [
  { id: 'feed-uuid-1', guid: 'guid-aaa', medium: 'music', type: 'album' },
  { id: 'feed-uuid-2', guid: 'guid-bbb', medium: null, type: 'album' },
  { id: 'feed-uuid-3', guid: null, medium: 'podcast', type: 'podcast' },
];

const TRACKS = [
  { id: 'track-1', guid: 'tguid-1', audioUrl: 'https://example.com/1.mp3' },
  { id: 'track-2', guid: 'tguid-2', audioUrl: 'https://example.com/2.mp3' },
  { id: 'track-3', guid: 'tguid-3', audioUrl: 'https://example.com/3.mp3' },
];

/** Stands in for `prisma.feed.findMany`, honouring only what the ladder sends. */
function fakeFeedFetch(calls: string[] = []) {
  return async (where: any) => {
    calls.push(JSON.stringify(where));
    const ids: string[] = where.OR?.[0]?.id?.in ?? [];
    const guids: string[] = where.OR?.[1]?.guid?.in ?? [];
    return FEEDS.filter(
      (f) => ids.includes(f.id) || (f.guid !== null && guids.includes(f.guid))
    );
  };
}

/** Stands in for `prisma.track.findMany`, one rung at a time. */
function fakeTrackFetch(calls: string[] = []) {
  return async (where: any) => {
    calls.push(JSON.stringify(where));
    if (where.id) return TRACKS.filter((t) => where.id.in.includes(t.id));
    if (where.guid) {
      return TRACKS.filter((t) => t.guid !== null && where.guid.in.includes(t.guid));
    }
    if (where.audioUrl) {
      return TRACKS.filter((t) => where.audioUrl.in.includes(t.audioUrl));
    }
    return [];
  };
}

test('feeds resolve whether the favorite stored a Feed.id or a Feed.guid', async () => {
  const map = await resolveFavoriteFeeds(
    ['feed-uuid-1', 'guid-bbb', 'feed-uuid-3'],
    fakeFeedFetch()
  );

  // Keyed by the id the FAVORITE holds, not the id the row holds.
  assert.equal(map.get('feed-uuid-1')?.id, 'feed-uuid-1');
  assert.equal(map.get('guid-bbb')?.id, 'feed-uuid-2');
  assert.equal(map.get('feed-uuid-3')?.id, 'feed-uuid-3');
  assert.equal(map.size, 3);
});

test('synthetic artist-* ids are skipped and never reach the query', async () => {
  const calls: string[] = [];
  const map = await resolveFavoriteFeeds(['artist-bad-luck', 'feed-uuid-1'], fakeFeedFetch(calls));

  assert.equal(map.has('artist-bad-luck'), false);
  assert.equal(map.get('feed-uuid-1')?.id, 'feed-uuid-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes('artist-bad-luck'), false);
});

test('an all-synthetic id list queries nothing at all', async () => {
  const calls: string[] = [];
  const map = await resolveFavoriteFeeds(['artist-a', 'artist-b'], fakeFeedFetch(calls));
  assert.equal(map.size, 0);
  assert.equal(calls.length, 0);
});

test('an unfavorited id resolves to nothing rather than to some other feed', async () => {
  const map = await resolveFavoriteFeeds(['not-a-real-id'], fakeFeedFetch());
  assert.equal(map.size, 0);
});

test('tracks climb all three rungs: id, then guid, then audioUrl', async () => {
  const calls: string[] = [];
  const rows = await resolveFavoriteTracks(
    ['track-1', 'tguid-2', 'https://example.com/3.mp3'],
    fakeTrackFetch(calls)
  );

  assert.deepEqual(
    rows.map((r) => r.id).sort(),
    ['track-1', 'track-2', 'track-3']
  );
  assert.equal(calls.length, 3, 'each rung runs only while ids are still unmatched');
});

test('the later rungs are skipped once every id has matched', async () => {
  const calls: string[] = [];
  await resolveFavoriteTracks(['track-1', 'track-2'], fakeTrackFetch(calls));
  assert.equal(calls.length, 1);
});

test('a track is paired back to its favorite by whichever column matched', async () => {
  const favorites = [
    { trackId: 'track-1', nostrEventId: 'ev-1' },
    { trackId: 'tguid-2', nostrEventId: null },
    { trackId: 'https://example.com/3.mp3', nostrEventId: 'ev-3' },
  ];

  assert.equal(favoriteForTrack(TRACKS[0], favorites)?.nostrEventId, 'ev-1');
  assert.equal(favoriteForTrack(TRACKS[1], favorites)?.trackId, 'tguid-2');
  assert.equal(favoriteForTrack(TRACKS[2], favorites)?.nostrEventId, 'ev-3');
});

test('the display select and the sync select resolve the SAME feed rows', async () => {
  // The whole point of sharing the ladder. Two callers, two column sets, one
  // answer about which favorites exist.
  const ids = ['feed-uuid-1', 'guid-bbb', 'feed-uuid-3', 'artist-x', 'missing'];

  const displayShaped = await resolveFavoriteFeeds(ids, async (where) =>
    (await fakeFeedFetch()(where)).map((f) => ({ ...f, image: 'x', Track: [], _count: { Track: 3 } }))
  );
  const syncShaped = await resolveFavoriteFeeds(ids, async (where) =>
    (await fakeFeedFetch()(where)).map((f) => ({ id: f.id, guid: f.guid, medium: f.medium, type: f.type }))
  );

  assert.deepEqual([...displayShaped.keys()].sort(), [...syncShaped.keys()].sort());
  for (const key of displayShaped.keys()) {
    assert.equal(displayShaped.get(key)!.id, syncShaped.get(key)!.id);
  }
});

test('the display select and the sync select resolve the SAME track rows', async () => {
  const ids = ['track-1', 'tguid-2', 'https://example.com/3.mp3', 'missing'];

  const displayShaped = await resolveFavoriteTracks(ids, async (where) =>
    (await fakeTrackFetch()(where)).map((t) => ({ ...t, title: 'T', Feed: { image: 'x' } }))
  );
  const syncShaped = await resolveFavoriteTracks(ids, async (where) =>
    (await fakeTrackFetch()(where)).map((t) => ({
      id: t.id, guid: t.guid, audioUrl: t.audioUrl, Feed: { guid: 'g', medium: 'music' },
    }))
  );

  assert.deepEqual(
    displayShaped.map((r) => r.id).sort(),
    syncShaped.map((r) => r.id).sort()
  );
});

test('no ids means no queries and an empty result', async () => {
  const feedCalls: string[] = [];
  const trackCalls: string[] = [];
  assert.equal((await resolveFavoriteFeeds([], fakeFeedFetch(feedCalls))).size, 0);
  assert.deepEqual(await resolveFavoriteTracks([], fakeTrackFetch(trackCalls)), []);
  assert.equal(feedCalls.length, 0);
  assert.equal(trackCalls.length, 0);
});
