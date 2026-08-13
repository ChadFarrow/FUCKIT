import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  signSession,
  verifySession,
  SESSION_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './session';

/**
 * What these pin: before this module, `User.id` (which IS the user's public
 * Nostr pubkey) was accepted from a client-supplied `x-nostr-user-id` header
 * with no verification, so anyone could destroy anyone's favorites with only
 * public information. A token is only trustworthy if forging one requires the
 * secret — so the tamper and wrong-secret cases matter more than the happy path.
 */

const SECRET = 'test-secret-value';
const NOW = 1_800_000_000_000;
const UID = 'a'.repeat(64);

test('a signed token round trips', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW), { userId: UID, proven: true });
});

test('the proven claim survives the round trip', () => {
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW), { userId: UID, proven: false });
});

test('a token signed with a different secret is rejected', () => {
  const token = signSession(UID, true, 'other-secret', NOW);
  assert.equal(verifySession(token, SECRET, NOW), null);
});

test('tampering with the payload is rejected', () => {
  const token = signSession(UID, true, SECRET, NOW);
  const [version, payload, sig] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ uid: 'b'.repeat(64), iat: Math.floor(NOW / 1000), p: 1 })
  ).toString('base64url');
  assert.notEqual(forged, payload);
  assert.equal(verifySession(`${version}.${forged}.${sig}`, SECRET, NOW), null);
});

test('promoting an unproven token to proven is rejected', () => {
  // The nip05 read-only path issues p:0. Flipping that bit must not be free.
  const token = signSession(UID, false, SECRET, NOW);
  const [version, , sig] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ uid: UID, iat: Math.floor(NOW / 1000), p: 1 })
  ).toString('base64url');
  assert.equal(verifySession(`${version}.${forged}.${sig}`, SECRET, NOW), null);
});

test('an expired token is rejected', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.equal(verifySession(token, SECRET, NOW + SESSION_MAX_AGE_MS + 1000), null);
});

test('a token at exactly max age is still accepted', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW + SESSION_MAX_AGE_MS), {
    userId: UID,
    proven: true,
  });
});

test('a token issued in the future is rejected', () => {
  // Clock skew is not a reason to accept a token minted ahead of us.
  const token = signSession(UID, true, SECRET, NOW + 600_000);
  assert.equal(verifySession(token, SECRET, NOW), null);
});

test('malformed input is rejected rather than throwing', () => {
  for (const bad of [null, undefined, '', 'garbage', 'v1.only-two', 'v1..', 'v2.a.b', '...']) {
    assert.equal(verifySession(bad as string, SECRET, NOW), null);
  }
});

test('a payload that is not valid JSON is rejected', () => {
  const junk = Buffer.from('not json').toString('base64url');
  assert.equal(verifySession(`v1.${junk}.sig`, SECRET, NOW), null);
});

test('a payload missing uid is rejected', () => {
  const noUid = Buffer.from(JSON.stringify({ iat: 1, p: 1 })).toString('base64url');
  assert.equal(verifySession(`v1.${noUid}.sig`, SECRET, NOW), null);
});

test('the cookie name is stable', () => {
  // Changing this logs every user out. It is asserted so the change is deliberate.
  assert.equal(SESSION_COOKIE_NAME, 'sk_session');
});
