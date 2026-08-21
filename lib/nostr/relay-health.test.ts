import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  noteUnreachableRelays,
  clearRelayNotes,
  partitionByRecentHealth,
} from './relay-health';

/**
 * The memo trades safety for time, so these tests are about the LIMITS rather
 * than the happy path. Each one pins a rule that, removed, turns a speed-up
 * into a way of reading a stale event and republishing over a newer list.
 */

// A localStorage stand-in, installed before the module under test is loaded.
class FakeStorage {
  store = new Map<string, string>();
  throwOnWrite = false;
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.throwOnWrite) throw new Error('QuotaExceededError');
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
}

// Installed at module scope, which runs before any test does. The module under
// test reads `window` on every call rather than capturing it at load, so a
// plain static import is enough — and a top-level `await import` would not
// even parse here, since this repo is CommonJS.
const storage = new FakeStorage();
(globalThis as any).window = { localStorage: storage };

const R = [
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://theforest.nostr1.com',
  'wss://relay.damus.io',
];

beforeEach(() => {
  storage.store.clear();
  storage.throwOnWrite = false;
});

test('a relay that just failed is held back from the next read', () => {
  noteUnreachableRelays(['wss://relay.damus.io'], true);
  const { use, skipped } = partitionByRecentHealth(R);

  assert.deepEqual(skipped, ['wss://relay.damus.io']);
  assert.equal(use.length, 4);
  assert.equal(use.includes('wss://relay.damus.io'), false);
});

test('RULE 1 — an offline device writes off nothing at all', () => {
  // Every relay failed because there is no network, not because the relays are
  // bad. Recording them would make the next read skip half the list for a
  // reason that has already gone away.
  noteUnreachableRelays(R, false);

  const { use, skipped } = partitionByRecentHealth(R);
  assert.deepEqual(skipped, []);
  assert.deepEqual(use, R);
});

test('RULE 2 — never hold back more than half the relays', () => {
  noteUnreachableRelays(R, true); // all five noted

  const { use, skipped } = partitionByRecentHealth(R);
  assert.equal(skipped.length, 2, 'floor(5/2)');
  assert.equal(use.length, 3, 'a majority still answers the read');
});

test('RULE 2 — a single-relay list is never reduced to nothing', () => {
  noteUnreachableRelays(['wss://nos.lol'], true);

  const { use, skipped } = partitionByRecentHealth(['wss://nos.lol']);
  assert.deepEqual(use, ['wss://nos.lol']);
  assert.deepEqual(skipped, []);
});

test('RULE 3 — a note expires, and the relay comes back', () => {
  noteUnreachableRelays(['wss://relay.damus.io'], true);
  assert.equal(partitionByRecentHealth(R).skipped.length, 1);

  // Rewrite the note as already expired, as the clock would.
  const raw = JSON.parse(storage.getItem('sk_relay_unreachable')!);
  raw['wss://relay.damus.io'] = Date.now() - 1;
  storage.setItem('sk_relay_unreachable', JSON.stringify(raw));

  assert.deepEqual(partitionByRecentHealth(R).skipped, []);
});

test('a relay that answers has its note cleared immediately', () => {
  noteUnreachableRelays(['wss://relay.damus.io'], true);
  clearRelayNotes(['wss://relay.damus.io']);

  assert.deepEqual(partitionByRecentHealth(R).skipped, []);
});

test('when more relays are suspect than may be skipped, the newest failures go', () => {
  noteUnreachableRelays(['wss://nos.lol', 'wss://relay.snort.social'], true);
  // A later failure must outrank the earlier ones for the two skip slots.
  const raw = JSON.parse(storage.getItem('sk_relay_unreachable')!);
  raw['wss://nos.lol'] = Date.now() + 1_000;
  raw['wss://relay.snort.social'] = Date.now() + 1_000;
  raw['wss://relay.damus.io'] = Date.now() + 600_000;
  raw['wss://relay.primal.net'] = Date.now() + 500_000;
  storage.setItem('sk_relay_unreachable', JSON.stringify(raw));

  const { skipped } = partitionByRecentHealth(R);
  assert.equal(skipped.length, 2);
  assert.equal(skipped.includes('wss://relay.damus.io'), true);
  assert.equal(skipped.includes('wss://relay.primal.net'), true);
});

test('garbage in the key is ignored rather than thrown', () => {
  storage.setItem('sk_relay_unreachable', 'not json at all');
  assert.deepEqual(partitionByRecentHealth(R).skipped, []);

  storage.setItem('sk_relay_unreachable', '["an","array"]');
  assert.deepEqual(partitionByRecentHealth(R).skipped, []);
});

test('a storage that refuses writes costs time, never correctness', () => {
  storage.throwOnWrite = true;
  assert.doesNotThrow(() => noteUnreachableRelays(['wss://relay.damus.io'], true));
  assert.deepEqual(partitionByRecentHealth(R).skipped, [], 'nothing was recorded, so nothing is skipped');
});

test('an empty relay list stays empty', () => {
  const { use, skipped } = partitionByRecentHealth([]);
  assert.deepEqual(use, []);
  assert.deepEqual(skipped, []);
});
