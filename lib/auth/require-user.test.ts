import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signSession } from './session';
import { resolveUserId } from './require-user';

const SECRET = 'test-secret-value';
const NOW = 1_800_000_000_000;
const UID = 'a'.repeat(64);

test('a valid cookie resolves the user', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, false), {
    userId: UID,
    reason: 'ok',
  });
});

test('the legacy header is ignored when a secret is configured', () => {
  // This is the whole point: the header must stop being an authorization.
  assert.deepEqual(resolveUserId(null, 'b'.repeat(64), SECRET, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('an invalid cookie does not fall back to the header', () => {
  assert.deepEqual(resolveUserId('garbage', 'b'.repeat(64), SECRET, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('with no secret configured it fails open to the legacy header', () => {
  // Mirrors lib/admin-auth.ts: a deploy must not break favorites for everyone
  // before the Railway env var exists.
  assert.deepEqual(resolveUserId(null, 'b'.repeat(64), undefined, NOW, false), {
    userId: 'b'.repeat(64),
    reason: 'failopen',
  });
});

test('with no secret and no header there is still no user', () => {
  assert.deepEqual(resolveUserId(null, null, undefined, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('an unproven token is accepted for reads', () => {
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, false), {
    userId: UID,
    reason: 'ok',
  });
});

test('an unproven token is rejected for writes', () => {
  // nip05-login proves no key ownership. It may read; it may not write.
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, true), {
    userId: null,
    reason: 'unproven',
  });
});

test('a proven token is accepted for writes', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, true), {
    userId: UID,
    reason: 'ok',
  });
});
