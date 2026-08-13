import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isSessionExpiredResponse, SESSION_EXPIRED_EVENT } from './session-expired';

test('a 401 with the session code is an expired session', () => {
  assert.equal(isSessionExpiredResponse(401, { error: 'session_expired' }), true);
});

test('a 401 without the code is not treated as expired', () => {
  // Admin routes 401 with a different body. Prompting a Nostr re-login there
  // would be wrong and confusing.
  assert.equal(isSessionExpiredResponse(401, { error: 'Unauthorized' }), false);
});

test('a non-401 is never an expired session', () => {
  assert.equal(isSessionExpiredResponse(200, { error: 'session_expired' }), false);
  assert.equal(isSessionExpiredResponse(500, { error: 'session_expired' }), false);
});

test('a non-object body does not throw', () => {
  for (const body of [null, undefined, 'text', 42, []]) {
    assert.equal(isSessionExpiredResponse(401, body), false);
  }
});

test('the event name is stable', () => {
  assert.equal(SESSION_EXPIRED_EVENT, 'sk-session-expired');
});
