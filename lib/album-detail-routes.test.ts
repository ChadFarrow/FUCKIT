// Run: npx tsx --test lib/album-detail-routes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAlbumDetailRoute } from './album-detail-routes';

test('matches the album detail routes', () => {
  assert.equal(isAlbumDetailRoute('/album/ariel-powell-all-that-s-haunting-me'), true);
  assert.equal(isAlbumDetailRoute('/podcast/before-the-sch3m3s'), true);
  // Deep paths under /album/ (e.g. the demo route) still render the same component.
  assert.equal(isAlbumDetailRoute('/album/beach-trash/demo'), true);
});

test('matches the sandbox route, which renders the same component', () => {
  assert.equal(isAlbumDetailRoute('/sandbox/album'), true);
  assert.equal(isAlbumDetailRoute('/sandbox/album/'), true);
});

test('does not match unrelated routes', () => {
  for (const p of ['/', '/search', '/favorites', '/downloads', '/publisher/the-doerfels', '/playlist/hgh']) {
    assert.equal(isAlbumDetailRoute(p), false, `${p} should not match`);
  }
});

test('does not match routes that merely start with the same letters', () => {
  // Guards against a bare `startsWith('/album')` without the trailing slash.
  assert.equal(isAlbumDetailRoute('/albums'), false);
  assert.equal(isAlbumDetailRoute('/podcasts'), false);
  assert.equal(isAlbumDetailRoute('/sandbox/albums'), false);
});

test('handles the null pathname next/navigation can return', () => {
  assert.equal(isAlbumDetailRoute(null), false);
  assert.equal(isAlbumDetailRoute(undefined), false);
  assert.equal(isAlbumDetailRoute(''), false);
});
