import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedUrlVariants, extractUuidFromUrl, normalizeUrl } from './url-utils';

test('returns a single variant when the url is already normalized', () => {
  const url = 'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml';
  assert.deepEqual(buildFeedUrlVariants(url), [url]);
});

test('puts the normalized form first, raw form second', () => {
  const raw = 'https://headstarts.uk/msp/nat-hills-music/';
  const variants = buildFeedUrlVariants(raw);
  assert.equal(variants[0], normalizeUrl(raw));
  assert.equal(variants[0], 'https://headstarts.uk/msp/nat-hills-music');
  assert.equal(variants[1], raw);
  assert.equal(variants.length, 2);
});

test('normalizes unencoded spaces to %20 and keeps the raw form as a fallback', () => {
  // headstarts.uk ships feeds with literal spaces in the path; older rows may store
  // either form, so both need to be tried.
  const raw = 'https://headstarts.uk/msp/Nathan Abbott/sweet_sunshine/sweet_sunshine.xml';
  const variants = buildFeedUrlVariants(raw);
  assert.equal(variants[0], 'https://headstarts.uk/msp/Nathan%20Abbott/sweet_sunshine/sweet_sunshine.xml');
  assert.equal(variants[1], raw);
});

test('dedupes the normalized form across inputs but keeps each distinct raw form', () => {
  // refresh-by-url passes both resolvedUrl and originalUrl; they usually normalize to the
  // same thing. The shared normalized form appears once, while a raw form that differs
  // stays as a fallback (a row may have been stored pre-normalization).
  const variants = buildFeedUrlVariants(
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml',
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml/'
  );
  assert.deepEqual(variants, [
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml',
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml/',
  ]);
});

test('emits exactly one variant when both inputs are identical', () => {
  const url = 'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml';
  assert.deepEqual(buildFeedUrlVariants(url, url), [url]);
});

test('skips null/undefined/empty inputs', () => {
  const url = 'https://example.com/feed.xml';
  assert.deepEqual(buildFeedUrlVariants(null, url, undefined, ''), [url]);
  assert.deepEqual(buildFeedUrlVariants(null, undefined), []);
});

test('lowercases the host but does NOT collapse path case', () => {
  // Path casing is the case-insensitive DB rung's job (lib/feed-lookup.ts), not the
  // variant builder's — asserting it here so a future "simplification" that lowercases
  // the whole URL in normalizeUrl trips a test instead of silently changing storage.
  const variants = buildFeedUrlVariants('https://HeadStarts.UK/msp/Nat_Hills_Music.xml');
  assert.equal(variants[0], 'https://headstarts.uk/msp/Nat_Hills_Music.xml');
  assert.ok(variants.every(v => v.includes('Nat_Hills_Music.xml')));
});

test('preserves an unparseable url as-is rather than dropping it', () => {
  assert.deepEqual(buildFeedUrlVariants('not-a-url'), ['not-a-url']);
});

test('extractUuidFromUrl finds a Podhome-style uuid and lowercases it', () => {
  assert.equal(
    extractUuidFromUrl('https://serve.podhome.fm/rss/3AEBB7A8-5942-5EE7-A148-8BDC14F1F3D4'),
    '3aebb7a8-5942-5ee7-a148-8bdc14f1f3d4'
  );
});

test('extractUuidFromUrl returns null for self-hosted urls with no uuid', () => {
  // This is why the case-insensitive rung exists: for these feeds the uuid fallback
  // can never fire, so exact-string matching is otherwise the only signal.
  assert.equal(
    extractUuidFromUrl('https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml'),
    null
  );
});
