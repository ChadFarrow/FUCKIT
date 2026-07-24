import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAnimatedArtworkUrl } from './cdn-utils';

test('detects a plain GIF url', () => {
  assert.equal(isAnimatedArtworkUrl('https://feed.homegrownhits.xyz/assets/images/episode-144.gif'), true);
});

test('detects a GIF behind the image proxy', () => {
  const src = `/api/proxy-image?url=${encodeURIComponent('https://feed.homegrownhits.xyz/assets/images/episode-144.gif')}`;
  assert.equal(isAnimatedArtworkUrl(src), true);
});

test('is case insensitive (feeds ship .GIF too)', () => {
  const src = `/api/proxy-image?url=${encodeURIComponent('https://feed.homegrownhits.xyz/assets/images/episode-132.GIF')}`;
  assert.equal(isAnimatedArtworkUrl(src), true);
});

test('ignores query strings and fragments on the source url', () => {
  const src = `/api/proxy-image?url=${encodeURIComponent('https://example.com/art.gif?v=2#frag')}`;
  assert.equal(isAnimatedArtworkUrl(src), true);
});

test('leaves normal artwork on the optimized path', () => {
  assert.equal(isAnimatedArtworkUrl('https://wavlake.com/cover.jpg'), false);
  assert.equal(isAnimatedArtworkUrl('/album-placeholder-medium.png'), false);
  assert.equal(
    isAnimatedArtworkUrl(`/api/proxy-image?url=${encodeURIComponent('https://example.com/cover.png')}`),
    false
  );
});

test('does not match a url that merely contains "gif"', () => {
  assert.equal(isAnimatedArtworkUrl('https://example.com/gifted-artist/cover.jpg'), false);
});

test('handles empty and malformed input', () => {
  assert.equal(isAnimatedArtworkUrl(''), false);
  assert.equal(isAnimatedArtworkUrl(undefined as unknown as string), false);
  assert.equal(isAnimatedArtworkUrl('/api/proxy-image?url=%E0%A4%A.gif'), true);
});
