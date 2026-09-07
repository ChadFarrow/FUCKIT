import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  feedToAlbum,
  trackToAlbumTrack,
  albumFeedSelect,
  ALBUM_TRACK_SELECT,
  EPISODE_TRACK_ORDER_BY,
  type AlbumSourceFeed,
  type AlbumSourceTrack,
} from './album-shape';

function track(over: Partial<AlbumSourceTrack> = {}): AlbumSourceTrack {
  return {
    id: 't1',
    guid: 'track-guid-1',
    title: 'Track One',
    duration: 240,
    audioUrl: 'https://example.com/1.mp3',
    image: 'https://example.com/1.jpg',
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    v4vRecipient: null,
    v4vValue: null,
    startTime: null,
    endTime: null,
    trackOrder: 1,
    mediaType: 'audio',
    alternateEnclosures: null,
    ...over,
  };
}

function feed(over: Partial<AlbumSourceFeed> = {}): AlbumSourceFeed {
  return {
    id: 'feed-1',
    guid: 'feed-guid-1',
    title: 'An Album',
    description: 'desc',
    originalUrl: 'https://example.com/feed.xml',
    type: 'album',
    artist: 'An Artist',
    image: 'https://example.com/art.jpg',
    priority: 'normal',
    createdAt: new Date('2023-06-06T00:00:00Z'),
    oldestItemPubdate: new Date('2021-03-03T00:00:00Z'),
    v4vRecipient: null,
    v4vValue: null,
    Track: [track()],
    _count: { Track: 12 },
    ...over,
  };
}

// The bug this module exists to make impossible: app/publisher/[id]/page.tsx
// used `feed.lastFetched || feed.createdAt` — the last POLL time — so the same
// album showed a different year there than on the home grid.
test('releaseDate is the album release date, never the fetch time', () => {
  const album = feedToAlbum(feed());
  assert.deepEqual(album.releaseDate, new Date('2021-03-03T00:00:00Z'));
  assert.deepEqual(album.dateAdded, new Date('2023-06-06T00:00:00Z'));
});

test('releaseDate falls back to createdAt when oldestItemPubdate is null', () => {
  const album = feedToAlbum(feed({ oldestItemPubdate: null }));
  assert.deepEqual(album.releaseDate, new Date('2023-06-06T00:00:00Z'));
});

test('trackCount is the real count, not the capped tracks array', () => {
  const album = feedToAlbum(feed({ Track: [track()], _count: { Track: 57 } }));
  assert.equal(album.tracks.length, 1);
  assert.equal(album.trackCount, 57);
});

test('trackCount is 0 when _count is absent', () => {
  assert.equal(feedToAlbum(feed({ _count: null })).trackCount, 0);
  assert.equal(feedToAlbum(feed({ _count: undefined })).trackCount, 0);
});

test('artist falls back to the title', () => {
  assert.equal(feedToAlbum(feed({ artist: null })).artist, 'An Album');
});

test('type defaults to album', () => {
  assert.equal(feedToAlbum(feed({ type: null })).type, 'album');
});

test('the Helipad TLV fields come from the first track, and are null otherwise', () => {
  const album = feedToAlbum(feed());
  assert.equal(album.guid, 'track-guid-1');
  assert.equal(album.episodeGuid, 'track-guid-1');
  assert.equal(album.feedGuid, 'feed-guid-1');
  assert.equal(album.remoteFeedGuid, 'feed-guid-1');

  // Never `feed.id`. A StableKraft slug published as `podcast:item:guid` is an
  // identifier only this app can resolve (#242), so absent is the real answer.
  const noTracks = feedToAlbum(feed({ Track: [] }));
  assert.equal(noTracks.guid, null, 'no track means no episode guid');
  assert.equal(noTracks.episodeGuid, null);
});

test('feed-level V4V wins over the first track, which is the fallback', () => {
  const feedLevel = feedToAlbum(feed({ v4vRecipient: 'feed@example.com' }));
  assert.equal(feedLevel.v4vRecipient, 'feed@example.com');

  const trackLevel = feedToAlbum(
    feed({ v4vRecipient: null, Track: [track({ v4vRecipient: 'track@example.com' })] })
  );
  assert.equal(trackLevel.v4vRecipient, 'track@example.com');

  assert.equal(feedToAlbum(feed({ Track: [] })).v4vRecipient, null);
});

test('dedupeTracks drops a repeat of the same url AND title', () => {
  const dup = [
    track({ id: 'a' }),
    track({ id: 'b' }), // identical url + title
    track({ id: 'c', title: 'Different', audioUrl: 'https://example.com/1.mp3' }),
    track({ id: 'd', title: 'Track One', audioUrl: 'https://example.com/2.mp3' }),
  ];
  assert.equal(feedToAlbum(feed({ Track: dup })).tracks.length, 4, 'off by default');
  const deduped = feedToAlbum(feed({ Track: dup }), { dedupeTracks: true });
  assert.equal(deduped.tracks.length, 3);
  assert.deepEqual(deduped.tracks.map((t) => t.id), ['a', 'c', 'd']);
});

test('newestFirst orders episodes by publishedAt descending', () => {
  const episodes = [
    track({ id: 'old', publishedAt: new Date('2020-01-01T00:00:00Z') }),
    track({ id: 'new', publishedAt: new Date('2026-01-01T00:00:00Z') }),
    track({ id: 'mid', publishedAt: new Date('2023-01-01T00:00:00Z') }),
  ];
  const album = feedToAlbum(feed({ Track: episodes }), { newestFirst: true });
  assert.deepEqual(album.tracks.map((t) => t.id), ['new', 'mid', 'old']);
});

test('newestFirst treats a null publishedAt as oldest', () => {
  const episodes = [
    track({ id: 'none', publishedAt: null }),
    track({ id: 'dated', publishedAt: new Date('2020-01-01T00:00:00Z') }),
  ];
  const album = feedToAlbum(feed({ Track: episodes }), { newestFirst: true });
  assert.deepEqual(album.tracks.map((t) => t.id), ['dated', 'none']);
});

test('duration falls back to 180 when a feed declares none', () => {
  assert.equal(trackToAlbumTrack(track({ duration: null })).duration, 180);
  assert.equal(trackToAlbumTrack(track({ duration: 0 })).duration, 180);
  assert.equal(trackToAlbumTrack(track({ duration: 300 })).duration, 300);
});

// These five were once cut from the catalog list on the grounds that
// app/page.tsx discards them and is the only consumer. It is not: /radio and
// the "New" tab both pass these album objects to AudioContext unmapped, so
// cutting them silently stopped chapter ticks and VTS payment splits on both.
// Radio and the home grid share one endpoint, so the fields cannot be cut for
// one without cutting them for the other.
test('the playback fields stay in the catalog track select', () => {
  for (const field of ['chapters', 'chaptersUrl', 'valueTimeSplits', 'persons', 'podcastImages']) {
    assert.equal(
      field in ALBUM_TRACK_SELECT,
      true,
      `${field} is read off the track by /radio and the New tab`
    );
  }
  const t = trackToAlbumTrack(track());
  for (const field of ['chapters', 'chaptersUrl', 'valueTimeSplits', 'persons', 'podcastImages']) {
    assert.equal(field in t, true, `${field} must survive the mapper, not just the select`);
  }
});

test('the playback fields carry their values through the mapper', () => {
  const t = trackToAlbumTrack(track({
    chaptersUrl: 'https://example.com/chapters.json',
    chapters: [{ title: 'One', startTime: 0 }],
    valueTimeSplits: [{ startTime: 0, duration: 30 }],
  }));
  assert.equal(t.chaptersUrl, 'https://example.com/chapters.json');
  assert.deepEqual(t.chapters, [{ title: 'One', startTime: 0 }]);
  assert.deepEqual(t.valueTimeSplits, [{ startTime: 0, duration: 30 }]);
});

// Track.publishedAt is nullable and PostgreSQL sorts NULLs FIRST on DESC, so
// without `nulls: 'last'` a `take: 20` returns 20 undated episodes and hides
// every dated one.
test('episode ordering puts undated episodes last, not first', () => {
  assert.deepEqual(EPISODE_TRACK_ORDER_BY[0], {
    publishedAt: { sort: 'desc', nulls: 'last' },
  });
});

// The `filter=podcasts` branch of albums-fast omitted `take` entirely and
// loaded every episode of every podcast.
test('albumFeedSelect requires an explicit take', () => {
  const select = albumFeedSelect(20);
  assert.equal((select.Track as { take?: number }).take, 20);
  assert.deepEqual(select.Track.select, ALBUM_TRACK_SELECT);
  assert.equal(select._count.select.Track.where.status, 'active');
});

test("'unbounded' omits take, and says so rather than leaving it off silently", () => {
  const select = albumFeedSelect('unbounded');
  assert.equal('take' in select.Track, false);
});

test('the playable-track filter excludes empty audio urls and inactive rows', () => {
  const select = albumFeedSelect(5);
  assert.deepEqual(select.Track.where, { audioUrl: { not: '' }, status: 'active' });
});

test('the episode guid comes from the DB order, not the newestFirst re-sort', () => {
  // All three call sites read feed.Track[0] today, including the podcast branch
  // that sorts afterwards. Deriving it from the sorted list would change which
  // episode guid goes out in Helipad TLV metadata for every podcast.
  const episodes = [
    track({ id: 'oldest', guid: 'guid-oldest', publishedAt: new Date('2020-01-01T00:00:00Z') }),
    track({ id: 'newest', guid: 'guid-newest', publishedAt: new Date('2026-01-01T00:00:00Z') }),
  ];
  const album = feedToAlbum(feed({ Track: episodes }), { newestFirst: true });
  assert.deepEqual(album.tracks.map((t) => t.id), ['newest', 'oldest'], 'display order flips');
  assert.equal(album.guid, 'guid-oldest', 'but identity does not');
  assert.equal(album.episodeGuid, 'guid-oldest');
});

test('defaultType applies only when the feed declares none', () => {
  assert.equal(feedToAlbum(feed({ type: null }), { defaultType: 'podcast' }).type, 'podcast');
  assert.equal(feedToAlbum(feed({ type: 'album' }), { defaultType: 'podcast' }).type, 'album');
});

test('v4vTrackFallback:false reports only the feed value', () => {
  const f = feed({ v4vRecipient: null, Track: [track({ v4vRecipient: 'track@example.com' })] });
  assert.equal(feedToAlbum(f).v4vRecipient, 'track@example.com', 'default falls back');
  assert.equal(feedToAlbum(f, { v4vTrackFallback: false }).v4vRecipient, null);
  assert.equal(feedToAlbum(f, { v4vTrackFallback: false }).v4vValue, null);
});

test('dedupe does not disturb the identity track', () => {
  const dup = [track({ id: 'a', guid: 'guid-a' }), track({ id: 'b', guid: 'guid-b' })];
  const album = feedToAlbum(feed({ Track: dup }), { dedupeTracks: true });
  assert.equal(album.tracks.length, 1);
  assert.equal(album.guid, 'guid-a');
});

/**
 * The client caches `/api/albums-fast` in localStorage behind `API_VERSION`
 * (app/page.tsx). A field silently dropped from this shape is served from that
 * cache as missing data until someone bumps the version — so the key set is
 * part of the contract, not an implementation detail.
 */
test('the album key set is the API contract', () => {
  const expected = [
    'artist', 'coverArt', 'dateAdded', 'description', 'episodeGuid', 'feedGuid',
    'feedId', 'feedUrl', 'guid', 'id', 'link', 'persons', 'podcastImages',
    'priority', 'releaseDate', 'remoteFeedGuid', 'title', 'tracks', 'trackCount',
    'type', 'v4vRecipient', 'v4vValue',
  ].sort();
  assert.deepEqual(Object.keys(feedToAlbum(feed())).sort(), expected);
});

test('the track key set is the API contract', () => {
  const expected = [
    'alternateEnclosures', 'duration', 'guid', 'id',
    'image', 'mediaType', 'publishedAt', 'startTime',
    'endTime', 'title', 'url', 'v4vRecipient', 'v4vValue',
    'chaptersUrl', 'chapters', 'valueTimeSplits', 'persons', 'podcastImages',
  ].sort();
  assert.deepEqual(Object.keys(trackToAlbumTrack(track())).sort(), expected);
});
