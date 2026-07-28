// Run: npx tsx --test lib/admin/diagnostics.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, sortSummaryRows } from './diagnostics';

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

test('sortSummaryRows sorts by count desc, carrying through extra fields untouched', () => {
  const summary = sortSummaryRows([
    { category: 'no-route', userActionable: false, count: 2 },
    { category: 'insufficient-balance', userActionable: true, count: 1 },
  ]);

  assert.deepEqual(summary, [
    { category: 'no-route', userActionable: false, count: 2 },
    { category: 'insufficient-balance', userActionable: true, count: 1 },
  ]);
});

test('sortSummaryRows breaks a count tie by category asc, so output is deterministic', () => {
  const summary = sortSummaryRows([
    { category: 'zebra', count: 5 },
    { category: 'alpha', count: 5 },
    { category: 'middle', count: 9 },
  ]);

  assert.deepEqual(summary.map(r => r.category), ['middle', 'alpha', 'zebra']);
});

test('sortSummaryRows does not mutate its input', () => {
  const input = [
    { category: 'b', count: 1 },
    { category: 'a', count: 2 },
  ];
  const sorted = sortSummaryRows(input);

  assert.deepEqual(input, [
    { category: 'b', count: 1 },
    { category: 'a', count: 2 },
  ]);
  assert.deepEqual(sorted.map(r => r.category), ['a', 'b']);
});

test('empty input yields an empty summary, not a throw', () => {
  assert.deepEqual(sortSummaryRows([]), []);
});
