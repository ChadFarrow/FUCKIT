// Freshness policy for the Community tab's relay sweep.
// Repo has NO jest/vitest — node:test + tsx is the pattern.
//   npx tsx --test lib/caches/community-favorites-cache.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideCacheAction,
  refreshCommunityCache,
  getCommunityCacheEntry,
  setCommunityCacheEntry,
  invalidateCommunityCache,
  FRESH_MS,
  STALE_GRACE_MS,
} from './community-favorites-cache';

const NOW = 1_000_000_000;

test('a cold cache blocks on a real sweep', () => {
  assert.equal(decideCacheAction(null, NOW), 'block-and-fetch');
});

test('a fresh entry is served without touching relays', () => {
  assert.equal(decideCacheAction({ data: 1, timestamp: NOW }, NOW), 'serve-fresh');
  assert.equal(decideCacheAction({ data: 1, timestamp: NOW - FRESH_MS + 1 }, NOW), 'serve-fresh');
});

// The point of the whole cache: nobody should wait 4.4s just because they happened to
// arrive after the TTL lapsed.
test('a stale-but-usable entry is served immediately and refreshed behind the request', () => {
  assert.equal(
    decideCacheAction({ data: 1, timestamp: NOW - FRESH_MS - 1 }, NOW),
    'serve-stale-and-revalidate'
  );
  assert.equal(
    decideCacheAction({ data: 1, timestamp: NOW - STALE_GRACE_MS + 1 }, NOW),
    'serve-stale-and-revalidate'
  );
});

test('past the grace window we block rather than show something ancient', () => {
  assert.equal(decideCacheAction({ data: 1, timestamp: NOW - STALE_GRACE_MS }, NOW), 'block-and-fetch');
});

test('a future timestamp (clock skew) is treated as fresh, not ancient', () => {
  assert.equal(decideCacheAction({ data: 1, timestamp: NOW + 5000 }, NOW), 'serve-fresh');
});

// A burst of requests arriving on a stale cache must not each start their own sweep.
test('concurrent refreshes share one in-flight sweep', async () => {
  invalidateCommunityCache();
  let calls = 0;
  const slow = () =>
    new Promise<string>((resolve) => {
      calls++;
      setTimeout(() => resolve('result'), 20);
    });

  const [a, b, c] = await Promise.all([
    refreshCommunityCache(slow, () => true, () => NOW),
    refreshCommunityCache(slow, () => true, () => NOW),
    refreshCommunityCache(slow, () => true, () => NOW),
  ]);

  assert.equal(calls, 1, 'only one sweep should have run');
  assert.deepEqual([a, b, c], ['result', 'result', 'result']);
  assert.equal(getCommunityCacheEntry<string>()?.data, 'result');
});

test('a refusing result is returned but never stored', async () => {
  invalidateCommunityCache();
  setCommunityCacheEntry('good', NOW);
  const out = await refreshCommunityCache(
    async () => 'bad',
    (r) => r !== 'bad',
    () => NOW + 1
  );
  assert.equal(out, 'bad', 'caller still sees the result');
  assert.equal(getCommunityCacheEntry<string>()?.data, 'good', 'good entry must survive');
});

test('a thrown refresh clears the in-flight slot so the next attempt can run', async () => {
  invalidateCommunityCache();
  await assert.rejects(
    refreshCommunityCache(async () => { throw new Error('relays down'); }, () => true, () => NOW)
  );
  let ran = false;
  await refreshCommunityCache(async () => { ran = true; return 'ok'; }, () => true, () => NOW);
  assert.equal(ran, true, 'a failed refresh must not wedge the cache');
});
