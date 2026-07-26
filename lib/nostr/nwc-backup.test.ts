/**
 * Run with: npx tsx --test lib/nostr/nwc-backup.test.ts
 * (repo has no jest/vitest — node:test + tsx is the pattern)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReadRelays,
  parseBackupPayload,
  buildBackupPayload,
  readNwcUriFromConfig,
} from './nwc-backup';

test('buildReadRelays unions write relays with defaults, write relays first', () => {
  const result = buildReadRelays(
    ['wss://outbox.example'],
    ['wss://default-a', 'wss://default-b']
  );
  assert.deepEqual(result, ['wss://outbox.example', 'wss://default-a', 'wss://default-b']);
});

test('buildReadRelays dedupes overlap without reordering', () => {
  const result = buildReadRelays(
    ['wss://shared', 'wss://outbox'],
    ['wss://shared', 'wss://default']
  );
  assert.deepEqual(result, ['wss://shared', 'wss://outbox', 'wss://default']);
});

test('buildReadRelays still returns defaults when NIP-65 has not hydrated', () => {
  // The case the union exists for: fresh sign-in, write relays not loaded yet.
  const result = buildReadRelays([], ['wss://default-a', 'wss://default-b']);
  assert.deepEqual(result, ['wss://default-a', 'wss://default-b']);
});

test('buildReadRelays caps at 20 relays', () => {
  const many = Array.from({ length: 30 }, (_, i) => `wss://relay-${i}`);
  assert.equal(buildReadRelays(many, ['wss://extra']).length, 20);
});

test('buildReadRelays drops empty entries', () => {
  assert.deepEqual(buildReadRelays(['', 'wss://a'], ['']), ['wss://a']);
});

test('payload round-trips the uri', () => {
  const uri = 'nostr+walletconnect://abc?relay=wss%3A%2F%2Frelay.example&secret=deadbeef';
  assert.equal(parseBackupPayload(buildBackupPayload(uri)), uri);
});

test('parseBackupPayload rejects junk rather than returning it', () => {
  assert.equal(parseBackupPayload('not json'), null);
  assert.equal(parseBackupPayload('{}'), null);
  assert.equal(parseBackupPayload('{"uri":""}'), null);
  assert.equal(parseBackupPayload('{"uri":123}'), null);
  // A tombstone decrypts to nothing; must not surface as a connection string.
  assert.equal(parseBackupPayload(''), null);
});

test('readNwcUriFromConfig pulls nwcUrl from a bitcoin-connect NWC config', () => {
  const config = JSON.stringify({
    connectorName: 'NWC',
    connectorType: 'nwc.generic',
    nwcUrl: 'nostr+walletconnect://abc',
  });
  assert.equal(readNwcUriFromConfig(config), 'nostr+walletconnect://abc');
});

test('readNwcUriFromConfig returns null for an extension connection', () => {
  // Extension configs carry no nwcUrl — there is nothing to back up, and the
  // save offer must not appear for them.
  const config = JSON.stringify({
    connectorName: 'Browser Extension',
    connectorType: 'extension.generic',
  });
  assert.equal(readNwcUriFromConfig(config), null);
});

test('readNwcUriFromConfig tolerates absent or corrupt config', () => {
  assert.equal(readNwcUriFromConfig(null), null);
  assert.equal(readNwcUriFromConfig('{oops'), null);
});
