import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ClientLogBuffer,
  MAX_QUEUE,
  MAX_PER_MESSAGE,
  MAX_MESSAGE,
  MAX_CATEGORY,
  MAX_DATA,
  THROTTLE_WINDOW_MS,
} from './client-log';

const entry = (message = 'Playback failed', level: 'error' | 'warn' = 'warn') => ({
  level,
  category: 'audio-playback',
  message,
});

test('queues distinct messages and drains them', () => {
  const buffer = new ClientLogBuffer();

  assert.equal(buffer.add(entry('a'), 0), true);
  assert.equal(buffer.add(entry('b'), 0), true);
  assert.equal(buffer.size, 2);

  const { entries, dropped } = buffer.drain(0);
  assert.deepEqual(entries.map(e => e.message), ['a', 'b']);
  assert.equal(dropped, 0);
  assert.equal(buffer.size, 0);
});

test('a repeat collapses into the queued entry and bumps its count', () => {
  const buffer = new ClientLogBuffer();

  assert.equal(buffer.add(entry('a'), 0), true);
  // Already queued — no second flush, no second entry.
  assert.equal(buffer.add(entry('a'), 10), false);
  assert.equal(buffer.add(entry('a'), 20), false);

  const { entries } = buffer.drain(20);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].count, 3);
});

test('a wedged client cannot flood: repeats past the cap are dropped, not queued', () => {
  const buffer = new ClientLogBuffer();

  // Flushing between occurrences is the hostile case: each drain clears the queue,
  // so without a surviving throttle every repeat would queue afresh forever.
  let queued = 0;
  let dropped = 0;

  for (let i = 0; i < 40; i++) {
    buffer.add(entry('a'), i);
    const flushed = buffer.drain(i);
    queued += flushed.entries.length;
    dropped += flushed.dropped;
  }

  assert.equal(queued, MAX_PER_MESSAGE, 'only the first few occurrences reach the server');
  assert.equal(dropped, 40 - MAX_PER_MESSAGE);
});

test('the throttle window resets, so a recurring issue is still visible later', () => {
  const buffer = new ClientLogBuffer();

  for (let i = 0; i < MAX_PER_MESSAGE + 5; i++) {
    buffer.add(entry('a'), i);
  }
  // Drained inside the window, so the throttle key survives it.
  buffer.drain(MAX_PER_MESSAGE + 5);

  // A fresh window starts a fresh entry rather than staying suppressed forever.
  assert.equal(buffer.add(entry('a'), THROTTLE_WINDOW_MS + 1), true);
  const { entries } = buffer.drain(THROTTLE_WINDOW_MS + 1);
  assert.equal(entries[0].count, 1);
});

test('the queue is bounded and reports what it dropped', () => {
  const buffer = new ClientLogBuffer();

  for (let i = 0; i < MAX_QUEUE + 10; i++) {
    buffer.add(entry(`msg-${i}`), 0);
  }

  const { entries, dropped } = buffer.drain(0);
  assert.equal(entries.length, MAX_QUEUE);
  assert.equal(dropped, 10);
});

test('drain clears the dropped counter with the entries', () => {
  const buffer = new ClientLogBuffer();
  for (let i = 0; i < MAX_QUEUE + 3; i++) buffer.add(entry(`msg-${i}`), 0);

  assert.equal(buffer.drain(0).dropped, 3);
  assert.equal(buffer.drain(0).dropped, 0);
});

test('drain sweeps expired throttle keys, so the map is not a lifetime leak', () => {
  const buffer = new ClientLogBuffer();

  // add() writes a key for every message it sees, including ones it drops, so
  // nothing else would ever remove these.
  for (let i = 0; i < MAX_QUEUE + 10; i++) buffer.add(entry(`msg-${i}`), 0);
  assert.equal(buffer.seenSize, MAX_QUEUE + 10);

  buffer.drain(THROTTLE_WINDOW_MS + 1);
  assert.equal(buffer.seenSize, 0);
});

test('drain keeps keys whose window is still open — that is what suppresses repeats', () => {
  const buffer = new ClientLogBuffer();

  buffer.add(entry('a'), 0);
  buffer.drain(10);
  assert.equal(buffer.seenSize, 1);

  // Still inside the window, so this is a repeat rather than a fresh entry.
  const { entries } = (buffer.add(entry('a'), 20), buffer.drain(20));
  assert.equal(entries[0].count, 2);
});

test('a per-item message defeats the throttle — keep variable parts out of the message', () => {
  const buffer = new ClientLogBuffer();

  // The shape dataService.getAlbumsByFeedGuids had: one message per guid means one
  // throttle key per guid, so the queue fills in a single pass. That method has no
  // callers today, so this never fired in production — the point of the test is that
  // the next loop to reach for monitoring.warn cannot reintroduce it unnoticed.
  for (let i = 0; i < 60; i++) buffer.add(entry(`No match found for feedGuid: guid-${i}`), 0);
  assert.equal(buffer.drain(0).entries.length, MAX_QUEUE, 'distinct messages collapse with nothing');

  // The fix: constant message, guid in `data`.
  const fixed = new ClientLogBuffer();
  for (let i = 0; i < 60; i++) {
    fixed.add({ ...entry('No match found for feedGuid'), data: { feedGuid: `guid-${i}` } }, 0);
  }
  // No flush in between, so all 60 collapse into the single queued entry.
  const { entries } = fixed.drain(0);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].count, 60);
  assert.equal(entries[0].data, '{"feedGuid":"guid-0"}', 'first occurrence keeps its data');
});

test('entries are clamped at intake, so a flush fits in sendBeacon\'s budget', () => {
  const buffer = new ClientLogBuffer();

  buffer.add({
    level: 'error',
    category: 'c'.repeat(500),
    message: 'm'.repeat(5_000),
    data: { blob: 'd'.repeat(50_000) },
  }, 0);

  const [entry] = buffer.drain(0).entries;
  assert.equal(entry.category.length, MAX_CATEGORY);
  assert.equal(entry.message.length, MAX_MESSAGE);
  assert.equal(entry.data!.length, MAX_DATA);
});

test('a full queue of maximal entries stays well under the ~64KB beacon cap', () => {
  const buffer = new ClientLogBuffer();

  for (let i = 0; i < MAX_QUEUE; i++) {
    buffer.add({
      level: 'error',
      category: `${i}`.padEnd(500, 'c'),
      message: `${i}`.padEnd(5_000, 'm'),
      data: { blob: 'd'.repeat(50_000) },
    }, 0);
  }

  const payload = JSON.stringify({ entries: buffer.drain(0).entries, dropped: 0, context: {} });
  assert.ok(payload.length < 64_000, `payload was ${payload.length} bytes`);
});

test('data that cannot be serialised is recorded, not thrown', () => {
  const buffer = new ClientLogBuffer();

  const circular: any = {};
  circular.self = circular;
  buffer.add({ level: 'warn', category: 'x', message: 'y', data: circular }, 0);

  assert.equal(buffer.drain(0).entries[0].data, '[unserializable]');
});

test('level is part of the throttle key, so an error is not masked by a warning', () => {
  const buffer = new ClientLogBuffer();

  assert.equal(buffer.add(entry('same', 'warn'), 0), true);
  assert.equal(buffer.add(entry('same', 'error'), 0), true);

  const { entries } = buffer.drain(0);
  assert.deepEqual(entries.map(e => e.level), ['warn', 'error']);
});
