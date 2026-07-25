import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  albumSessionKey,
  rehydrateAlbum,
  resolveResumePosition,
  serializeAlbumForPersistence,
  isSessionFresh,
  AUDIO_STATE_VERSION,
  DEFAULT_MAX_SESSION_AGE_MS,
} from './playback-state';
import type { RSSAlbum } from './rss-parser/types';

function makeAlbum(overrides: Partial<RSSAlbum> = {}): RSSAlbum {
  return {
    title: 'Test Album',
    artist: 'Test Artist',
    description: 'desc',
    coverArt: 'https://example.com/cover.jpg',
    releaseDate: '2026-01-01',
    id: 'test-album',
    tracks: [
      {
        title: 'One',
        duration: '3:00',
        url: 'https://example.com/1.mp3',
        chaptersUrl: 'https://example.com/1-chapters.json',
        chapters: [{ startTime: 0, title: 'Intro' }] as any,
        valueTimeSplits: [{ startTime: 0, endTime: 10 }] as any,
      },
      {
        title: 'Two',
        duration: '4:00',
        url: 'https://example.com/2.mp3',
        chaptersUrl: 'https://example.com/2-chapters.json',
        chapters: [{ startTime: 0, title: 'Also intro' }] as any,
        valueTimeSplits: [{ startTime: 0, endTime: 20 }] as any,
      },
    ],
    ...overrides,
  };
}

// --- serializeAlbumForPersistence -------------------------------------------

test('serialize: keeps heavy fields for the current track only', () => {
  const persisted = serializeAlbumForPersistence(makeAlbum(), 1);

  assert.equal(persisted.tracks[0].chapters, undefined);
  assert.equal(persisted.tracks[0].valueTimeSplits, undefined);
  assert.ok(persisted.tracks[1].chapters);
  assert.ok(persisted.tracks[1].valueTimeSplits);
});

test('serialize: keeps chaptersUrl for every track', () => {
  const persisted = serializeAlbumForPersistence(makeAlbum(), 0);

  assert.equal(persisted.tracks[0].chaptersUrl, 'https://example.com/1-chapters.json');
  assert.equal(persisted.tracks[1].chaptersUrl, 'https://example.com/2-chapters.json');
});

test('serialize: keeps album-level V4V so a resumed boost pays the right recipients', () => {
  const album = makeAlbum({ v4vRecipient: 'chad@getalby.com', v4vValue: { foo: 'bar' } });
  const persisted = serializeAlbumForPersistence(album, 0);

  assert.equal(persisted.v4vRecipient, 'chad@getalby.com');
  assert.deepEqual(persisted.v4vValue, { foo: 'bar' });
});

test('serialize: tolerates a missing tracks array', () => {
  const album = makeAlbum({ tracks: undefined as any });
  const persisted = serializeAlbumForPersistence(album, 0);

  assert.deepEqual(persisted.tracks, []);
});

// --- rehydrateAlbum ---------------------------------------------------------

test('rehydrate: maps the legacy audioUrl field onto url', () => {
  const album = rehydrateAlbum({
    title: 'Legacy',
    artist: 'Someone',
    tracks: [{ title: 'One', audioUrl: 'https://example.com/legacy.mp3' }],
  });

  assert.ok(album);
  assert.equal(album!.tracks[0].url, 'https://example.com/legacy.mp3');
});

test('rehydrate: passes a v3 url through unchanged', () => {
  const album = rehydrateAlbum({
    title: 'Modern',
    artist: 'Someone',
    tracks: [{ title: 'One', url: 'https://example.com/modern.mp3' }],
  });

  assert.equal(album!.tracks[0].url, 'https://example.com/modern.mp3');
});

test('rehydrate: prefers url when both fields are present', () => {
  const album = rehydrateAlbum({
    title: 'Both',
    artist: 'Someone',
    tracks: [{ title: 'One', url: 'https://example.com/new.mp3', audioUrl: 'https://example.com/old.mp3' }],
  });

  assert.equal(album!.tracks[0].url, 'https://example.com/new.mp3');
});

test('rehydrate: returns null for unusable records', () => {
  assert.equal(rehydrateAlbum(null), null);
  assert.equal(rehydrateAlbum(undefined), null);
  assert.equal(rehydrateAlbum('nonsense'), null);
  assert.equal(rehydrateAlbum({}), null);
  assert.equal(rehydrateAlbum({ title: 'No tracks', tracks: [] }), null);
  assert.equal(rehydrateAlbum({ title: 'No urls', tracks: [{ title: 'One' }] }), null);
});

test('rehydrate: preserves per-track artist (the playlist "Various Artists" case)', () => {
  const album = rehydrateAlbum({
    title: 'Homegrown Hits',
    artist: 'Various Artists',
    tracks: [{ title: 'A Song', url: 'https://example.com/a.mp3', artist: 'Real Artist' }],
  });

  assert.equal(album!.artist, 'Various Artists');
  assert.equal(album!.tracks[0].artist, 'Real Artist');
});

test('rehydrate: produces the RSSAlbum-required fields', () => {
  const album = rehydrateAlbum({
    title: 'Minimal',
    tracks: [{ title: 'One', url: 'https://example.com/1.mp3' }],
  });

  assert.equal(album!.description, '');
  assert.equal(album!.releaseDate, '');
  assert.equal(album!.artist, 'Unknown Artist');
  assert.equal(album!.coverArt, null);
  assert.equal(album!.tracks[0].duration, '0:00');
});

test('rehydrate: keeps a track with no url as long as another is playable', () => {
  const album = rehydrateAlbum({
    title: 'Partial',
    tracks: [
      { title: 'Broken' },
      { title: 'Fine', url: 'https://example.com/fine.mp3' },
    ],
  });

  assert.equal(album!.tracks.length, 2);
  assert.equal(album!.tracks[0].url, undefined);
});

// --- round trip -------------------------------------------------------------

test('round trip: serialize(rehydrate(x)) is idempotent across repeated reloads', () => {
  const first = serializeAlbumForPersistence(makeAlbum(), 1);

  const second = serializeAlbumForPersistence(rehydrateAlbum(first)!, 1);
  const third = serializeAlbumForPersistence(rehydrateAlbum(second)!, 1);

  // A session must not degrade as the user reloads over and over.
  assert.deepEqual(second, third);
  assert.equal(second.tracks.length, first.tracks.length);
  assert.equal(second.tracks[1].url, 'https://example.com/2.mp3');
  assert.ok(second.tracks[1].valueTimeSplits);
});

test('round trip: a v2-shaped record survives one pass into v3 shape', () => {
  const v2 = {
    title: 'Legacy Album',
    artist: 'Legacy Artist',
    coverArt: 'https://example.com/c.jpg',
    tracks: [{ title: 'One', audioUrl: 'https://example.com/1.mp3' }],
  };

  const upgraded = serializeAlbumForPersistence(rehydrateAlbum(v2)!, 0);

  assert.equal(upgraded.tracks[0].url, 'https://example.com/1.mp3');
  assert.deepEqual(upgraded, serializeAlbumForPersistence(rehydrateAlbum(upgraded)!, 0));
});

// --- resolveResumePosition --------------------------------------------------

test('resolveResumePosition: ignores a position barely into the track', () => {
  assert.equal(resolveResumePosition({ position: 0, duration: 300 }), null);
  assert.equal(resolveResumePosition({ position: 4.9, duration: 300 }), null);
});

test('resolveResumePosition: resumes mid-track', () => {
  assert.equal(resolveResumePosition({ position: 120, duration: 300 }), 120);
});

test('resolveResumePosition: treats a near-finished track as finished', () => {
  assert.equal(resolveResumePosition({ position: 290, duration: 300 }), null);
  assert.equal(resolveResumePosition({ position: 300, duration: 300 }), null);
});

test('resolveResumePosition: works without a known duration', () => {
  assert.equal(resolveResumePosition({ position: 120 }), 120);
  assert.equal(resolveResumePosition({ position: 120, duration: NaN }), 120);
  assert.equal(resolveResumePosition({ position: 120, duration: 0 }), 120);
});

test('resolveResumePosition: measures progress from a segment start, not from zero', () => {
  // A VTS segment starting at 900s, only 2s in — not worth resuming.
  assert.equal(resolveResumePosition({ position: 902, startTime: 900, endTime: 1000 }), null);
  // 40s into the same segment — resume.
  assert.equal(resolveResumePosition({ position: 940, startTime: 900, endTime: 1000 }), 940);
});

test('resolveResumePosition: clamps into the segment range', () => {
  assert.equal(resolveResumePosition({ position: 995, startTime: 900, endTime: 1000 }), null);
  assert.equal(resolveResumePosition({ position: 950, startTime: 900, endTime: 1000 }), 950);
});

test('resolveResumePosition: rejects non-finite positions', () => {
  assert.equal(resolveResumePosition({ position: NaN, duration: 300 }), null);
  assert.equal(resolveResumePosition({ position: Infinity, duration: 300 }), null);
  assert.equal(resolveResumePosition({ position: undefined as any }), null);
});

// --- isSessionFresh ---------------------------------------------------------

test('isSessionFresh: boundary at maxAgeMs', () => {
  const now = 1_000_000_000;
  assert.equal(isSessionFresh({ timestamp: now - 1000, now, maxAgeMs: 5000 }), true);
  assert.equal(isSessionFresh({ timestamp: now - 5000, now, maxAgeMs: 5000 }), true);
  assert.equal(isSessionFresh({ timestamp: now - 5001, now, maxAgeMs: 5000 }), false);
});

test('isSessionFresh: uses a 30-day default', () => {
  const now = DEFAULT_MAX_SESSION_AGE_MS * 10;
  assert.equal(isSessionFresh({ timestamp: now - DEFAULT_MAX_SESSION_AGE_MS + 1, now }), true);
  assert.equal(isSessionFresh({ timestamp: now - DEFAULT_MAX_SESSION_AGE_MS - 1, now }), false);
});

test('isSessionFresh: tolerates clock skew into the future', () => {
  assert.equal(isSessionFresh({ timestamp: 2000, now: 1000 }), true);
});

test('isSessionFresh: rejects a missing timestamp', () => {
  assert.equal(isSessionFresh({ timestamp: undefined as any, now: 1000 }), false);
  assert.equal(isSessionFresh({ timestamp: NaN, now: 1000 }), false);
});

// --- albumSessionKey --------------------------------------------------------

test('albumSessionKey: stable across a serialize/rehydrate round trip', () => {
  const album = makeAlbum();
  const restored = rehydrateAlbum(serializeAlbumForPersistence(album, 0))!;

  assert.equal(albumSessionKey(restored), albumSessionKey(album));
});

test('albumSessionKey: distinguishes two albums sharing a title', () => {
  const a = albumSessionKey({ title: 'Greatest Hits', id: 'artist-a-hits' });
  const b = albumSessionKey({ title: 'Greatest Hits', id: 'artist-b-hits' });

  assert.notEqual(a, b);
});

test('albumSessionKey: falls back for a synthesized playlist album with no id', () => {
  const key = albumSessionKey({ title: 'Homegrown Hits', artist: 'Various Artists' });

  assert.equal(key, 'title:Homegrown Hits|Various Artists');
});

test('AUDIO_STATE_VERSION is 3', () => {
  assert.equal(AUDIO_STATE_VERSION, 3);
});
