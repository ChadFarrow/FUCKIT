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

import { RelayManager, relaysAreIsolated, resolvePublishRelays } from './relay';

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

/** `withEnv` for a test that awaits. Restoring in a `finally` around the await. */
const withEnvAsync = async (value: string | undefined, fn: () => Promise<void>) => {
  const had = process.env.NEXT_PUBLIC_NOSTR_RELAYS;
  const hadWindow = 'window' in globalThis;
  if (!hadWindow) (globalThis as any).window = {};
  if (value === undefined) delete process.env.NEXT_PUBLIC_NOSTR_RELAYS;
  else process.env.NEXT_PUBLIC_NOSTR_RELAYS = value;
  try {
    await fn();
  } finally {
    if (had === undefined) delete process.env.NEXT_PUBLIC_NOSTR_RELAYS;
    else process.env.NEXT_PUBLIC_NOSTR_RELAYS = had;
    if (!hadWindow) delete (globalThis as any).window;
  }
};

/**
 * The refusal we care about, as opposed to "nothing was listening".
 *
 * The manager is ALWAYS disconnected. A live socket keeps the event loop alive
 * and `node --test` waits for it to drain, so a missing `disconnectAll` here
 * does not fail the test — it hangs the whole run.
 */
const wasRefusedAsUnreachable = async (url: string): Promise<boolean> => {
  const manager = new RelayManager();
  try {
    await manager.connect(url, { write: true, timeout: 300 });
    return false;
  } catch (err) {
    return /Skipping unreachable relay/.test((err as Error).message);
  } finally {
    await manager.disconnectAll().catch(() => {});
  }
};

test('RelayManager.connect accepts the CONFIGURED local relay', async () => {
  // The third place that stripped loopback, and the one that cost a test cycle.
  // Reads go through SimplePool and worked, so the app came up, seeded its mode
  // off the wire and reconciled — while every publish failed HERE and surfaced
  // as "Couldn't reach the relays", with the relay running and answering reads
  // on the very same URL.
  //
  // Whether anything is listening is not the assertion: a connection refused is
  // a fine outcome in CI. Being rejected before the attempt is the bug.
  await withEnvAsync(LOCAL, async () => {
    assert.equal(
      await wasRefusedAsUnreachable(LOCAL),
      false,
      'the configured local relay was refused before a connection was attempted'
    );
  });
});

test('an UNCONFIGURED loopback relay is still refused', async () => {
  // The guard keeps its real job: a loopback URL in a relay list we did not
  // write is junk and will never answer. Only the one we were pointed at is
  // exempt, and pointing at one relay does not exempt every other.
  await withEnvAsync(LOCAL, async () => {
    assert.equal(await wasRefusedAsUnreachable('ws://localhost:9999'), true);
  });
});
