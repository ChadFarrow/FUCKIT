// Run: npx tsx --test lib/admin/diagnostics.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, summarizeBoostFailures, summarizeClientErrors } from './diagnostics';

test('dayKey buckets by UTC calendar day', () => {
  assert.equal(dayKey(new Date('2026-07-27T00:00:00.000Z')), '2026-07-27');
  assert.equal(dayKey(new Date('2026-07-27T23:59:59.999Z')), '2026-07-27');
  assert.equal(dayKey(new Date('2026-07-28T00:00:00.000Z')), '2026-07-28');
});

test('dayKey is UTC, not local — the bucket boundary must not move with the server', () => {
  // 22:30 in New York on the 27th is already the 28th in UTC. If this ever reads
  // '2026-07-27', a day's counts silently split across two rows on a server whose
  // timezone is not UTC.
  assert.equal(dayKey(new Date('2026-07-28T02:30:00.000Z')), '2026-07-28');
});

test('summarizeBoostFailures counts ROWS and carries userActionable', () => {
  const summary = summarizeBoostFailures([
    { category: 'no-route', userActionable: false },
    { category: 'no-route', userActionable: false },
    { category: 'insufficient-balance', userActionable: true },
  ]);

  assert.deepEqual(summary, [
    { category: 'no-route', userActionable: false, count: 2 },
    { category: 'insufficient-balance', userActionable: true, count: 1 },
  ]);
});

test('summarizeClientErrors SUMS the stored count, it does not count rows', () => {
  // Rows are already daily aggregates, so counting rows would report "2 errors"
  // for something that happened 412 times.
  const summary = summarizeClientErrors([
    { category: 'audio-playback', count: 400 },
    { category: 'audio-playback', count: 12 },
    { category: 'data-service', count: 5 },
  ]);

  assert.deepEqual(summary, [
    { category: 'audio-playback', count: 412 },
    { category: 'data-service', count: 5 },
  ]);
});

test('summaries sort by count desc, then category asc so output is deterministic', () => {
  const summary = summarizeClientErrors([
    { category: 'zebra', count: 5 },
    { category: 'alpha', count: 5 },
    { category: 'middle', count: 9 },
  ]);

  assert.deepEqual(summary.map(r => r.category), ['middle', 'alpha', 'zebra']);
});

test('empty input yields an empty summary, not a throw', () => {
  assert.deepEqual(summarizeBoostFailures([]), []);
  assert.deepEqual(summarizeClientErrors([]), []);
});
