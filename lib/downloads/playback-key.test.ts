import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primaryPlaybackKey, isNonDownloadableUrl } from './playback-key';

test('primaryPlaybackKey: empty / invalid inputs', () => {
  assert.equal(primaryPlaybackKey(''), '');
  assert.equal(primaryPlaybackKey(undefined), '');
  assert.equal(primaryPlaybackKey(null), '');
});

test('primaryPlaybackKey: upgrades http to https', () => {
  assert.equal(
    primaryPlaybackKey('http://example.com/a.mp3'),
    'https://example.com/a.mp3'
  );
});

test('primaryPlaybackKey: encodes stray spaces', () => {
  assert.equal(
    primaryPlaybackKey('https://example.com/my song.mp3'),
    'https://example.com/my%20song.mp3'
  );
});

test('primaryPlaybackKey: unwraps op3.dev analytics wrapper', () => {
  assert.equal(
    primaryPlaybackKey('https://op3.dev/e/https://cdn.example.com/x.mp3'),
    'https://cdn.example.com/x.mp3'
  );
});

test('primaryPlaybackKey: is idempotent (download-time key === play-time key)', () => {
  const raw = 'http://cdn.example.com/track one.mp3';
  const once = primaryPlaybackKey(raw);
  assert.equal(primaryPlaybackKey(once), once);
});

test('isNonDownloadableUrl: flags HLS', () => {
  assert.equal(isNonDownloadableUrl('https://x.com/stream.m3u8'), true);
  assert.equal(isNonDownloadableUrl('https://x.com/a.mp3'), false);
  assert.equal(isNonDownloadableUrl(undefined), false);
});
