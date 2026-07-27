import test from 'node:test';
import assert from 'node:assert/strict';

import { ClientLogBuffer, MAX_QUEUE, MAX_PER_MESSAGE, THROTTLE_WINDOW_MS } from './client-log';

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

  const { entries, dropped } = buffer.drain();
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

  const { entries } = buffer.drain();
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
    const flushed = buffer.drain();
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
  buffer.drain();

  // A fresh window starts a fresh entry rather than staying suppressed forever.
  assert.equal(buffer.add(entry('a'), THROTTLE_WINDOW_MS + 1), true);
  const { entries } = buffer.drain();
  assert.equal(entries[0].count, 1);
});

test('the queue is bounded and reports what it dropped', () => {
  const buffer = new ClientLogBuffer();

  for (let i = 0; i < MAX_QUEUE + 10; i++) {
    buffer.add(entry(`msg-${i}`), 0);
  }

  const { entries, dropped } = buffer.drain();
  assert.equal(entries.length, MAX_QUEUE);
  assert.equal(dropped, 10);
});

test('drain clears the dropped counter with the entries', () => {
  const buffer = new ClientLogBuffer();
  for (let i = 0; i < MAX_QUEUE + 3; i++) buffer.add(entry(`msg-${i}`), 0);

  assert.equal(buffer.drain().dropped, 3);
  assert.equal(buffer.drain().dropped, 0);
});

test('level is part of the throttle key, so an error is not masked by a warning', () => {
  const buffer = new ClientLogBuffer();

  assert.equal(buffer.add(entry('same', 'warn'), 0), true);
  assert.equal(buffer.add(entry('same', 'error'), 0), true);

  const { entries } = buffer.drain();
  assert.deepEqual(entries.map(e => e.level), ['warn', 'error']);
});
