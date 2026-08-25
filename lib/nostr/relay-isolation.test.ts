/**
 * Pointing the build at a local relay must isolate it. Nothing else here does.
 *
 * The hole this pins was found by watching the WebSocket connections a real
 * page opened: the favorites READ went to 127.0.0.1 as intended, and the union
 * in the publish path added the user's real NIP-65 relays straight back. A
 * "local" test would have published a real event under a real key to real
 * relays — on a replaceable event that keeps no history — and it fails SILENTLY,
 * because the publish succeeds and looks exactly like the test working.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { relaysAreIsolated, resolvePublishRelays } from './relay';

const LOCAL = 'ws://127.0.0.1:7777';
/** A real NIP-65 list, which is what makes the union dangerous. */
const USER_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];

const withEnv = (value: string | undefined, fn: () => void) => {
  const had = process.env.NEXT_PUBLIC_NOSTR_RELAYS;
  const hadWindow = 'window' in globalThis;
  // getDefaultRelays reads the env var only in a browser.
  if (!hadWindow) (globalThis as any).window = {};
  if (value === undefined) delete process.env.NEXT_PUBLIC_NOSTR_RELAYS;
  else process.env.NEXT_PUBLIC_NOSTR_RELAYS = value;
  try {
    fn();
  } finally {
    if (had === undefined) delete process.env.NEXT_PUBLIC_NOSTR_RELAYS;
    else process.env.NEXT_PUBLIC_NOSTR_RELAYS = had;
    if (!hadWindow) delete (globalThis as any).window;
  }
};

test('a loopback relay set isolates the app, and the union does NOT reopen it', () => {
  withEnv(LOCAL, () => {
    assert.equal(relaysAreIsolated(), true);
    const relays = resolvePublishRelays(USER_RELAYS);
    assert.deepEqual(relays, [LOCAL]);
    // The assertion that matters: not one real relay survived.
    assert.equal(
      relays.some((r) => r.startsWith('wss://')),
      false,
      'a real relay in the publish set means a local test publishes for real'
    );
  });
});

test('several loopback relays still count as isolated', () => {
  withEnv('ws://127.0.0.1:7777,ws://localhost:8888', () => {
    assert.equal(relaysAreIsolated(), true);
    assert.equal(resolvePublishRelays(USER_RELAYS).length, 2);
  });
});

test('ONE real relay in the set means not isolated, and the union is restored', () => {
  // Half-isolation is not isolation. If a real relay is configured the user
  // meant to reach the network, so their own relays belong in the set.
  withEnv(`${LOCAL},wss://relay.damus.io`, () => {
    assert.equal(relaysAreIsolated(), false);
    assert.equal(resolvePublishRelays(USER_RELAYS).includes('wss://nos.lol'), true);
  });
});

test('with no override, production behaviour is unchanged', () => {
  // The regression guard for the fix itself: normal builds must still union the
  // user's relays with the defaults, or a NIP-65 list stops being used at all.
  withEnv(undefined, () => {
    assert.equal(relaysAreIsolated(), false);
    const relays = resolvePublishRelays(USER_RELAYS);
    for (const r of USER_RELAYS) assert.equal(relays.includes(r), true);
    assert.ok(relays.length > USER_RELAYS.length, 'defaults are still unioned in');
  });
});

test('a loopback relay is still dropped from a USER relay list', () => {
  // filterReachableRelays keeps doing its job on data we did not write: a
  // localhost entry in someone's NIP-65 list is junk, not a test instruction.
  withEnv(undefined, () => {
    assert.equal(resolvePublishRelays(['ws://127.0.0.1:7777']).includes(LOCAL), false);
  });
});
