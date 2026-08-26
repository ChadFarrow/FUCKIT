import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueChallenge,
  verifyChallenge,
  isCreatedAtAcceptable,
  markChallengeUsed,
  __resetUsedChallenges,
  CHALLENGE_MAX_AGE_MS,
  CREATED_AT_SKEW_MS,
} from './challenge';

const SECRET = 'test-session-secret-not-a-real-one';
const NOW = 1_800_000_000_000;

beforeEach(() => __resetUsedChallenges());

test('a freshly issued challenge verifies and returns its nonce', () => {
  const token = issueChallenge('abc123', SECRET, NOW);
  const check = verifyChallenge(token, SECRET, NOW);
  assert.equal(check.ok, true);
  assert.equal((check as { nonce: string }).nonce, 'abc123');
});

test('the nonce is not readable as the whole challenge string', () => {
  const token = issueChallenge('abc123', SECRET, NOW);
  assert.notEqual(token, 'abc123');
  assert.equal(token.split('.').length, 3);
});

// The point of the module: a captured login body stops working.
test('a challenge older than the TTL is refused', () => {
  const token = issueChallenge('abc123', SECRET, NOW);
  const later = NOW + CHALLENGE_MAX_AGE_MS + 1000;
  const check = verifyChallenge(token, SECRET, later);
  assert.equal(check.ok, false);
  assert.equal((check as { reason: string }).reason, 'expired');
});

test('a challenge inside the TTL still verifies', () => {
  const token = issueChallenge('abc123', SECRET, NOW);
  const check = verifyChallenge(token, SECRET, NOW + CHALLENGE_MAX_AGE_MS - 1000);
  assert.equal(check.ok, true);
});

test('a challenge issued ahead of our clock is refused', () => {
  const token = issueChallenge('abc123', SECRET, NOW + 60_000);
  const check = verifyChallenge(token, SECRET, NOW);
  assert.equal(check.ok, false);
  assert.equal((check as { reason: string }).reason, 'expired');
});

test('a challenge signed with another secret is refused', () => {
  const token = issueChallenge('abc123', 'a-different-secret', NOW);
  const check = verifyChallenge(token, SECRET, NOW);
  assert.equal(check.ok, false);
  assert.equal((check as { reason: string }).reason, 'bad_signature');
});

test('a tampered payload is refused', () => {
  const token = issueChallenge('abc123', SECRET, NOW);
  const [v, , sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ n: 'evil', iat: Math.floor(NOW / 1000) }))
    .toString('base64url');
  const check = verifyChallenge(`${v}.${forged}.${sig}`, SECRET, NOW);
  assert.equal(check.ok, false);
  assert.equal((check as { reason: string }).reason, 'bad_signature');
});

test('a raw random challenge (the pre-fix format) is refused', () => {
  const check = verifyChallenge('a'.repeat(64), SECRET, NOW);
  assert.equal(check.ok, false);
  assert.equal((check as { reason: string }).reason, 'malformed');
});

test('malformed input does not throw', () => {
  for (const bad of [null, undefined, '', 'x', 'a.b', 'a.b.c.d', 'c1..', 'c1.!!!.???']) {
    const check = verifyChallenge(bad as string, SECRET, NOW);
    assert.equal(check.ok, false);
  }
});

test('created_at inside the skew window is accepted, outside is not', () => {
  const nowSeconds = Math.floor(NOW / 1000);
  assert.equal(isCreatedAtAcceptable(nowSeconds, NOW), true);
  assert.equal(isCreatedAtAcceptable(nowSeconds - 60, NOW), true, 'slightly behind is fine');
  assert.equal(isCreatedAtAcceptable(nowSeconds + 60, NOW), true, 'slightly ahead is fine');
  const outside = Math.floor((NOW + CREATED_AT_SKEW_MS + 60_000) / 1000);
  assert.equal(isCreatedAtAcceptable(outside, NOW), false);
  const longAgo = Math.floor((NOW - CREATED_AT_SKEW_MS - 60_000) / 1000);
  assert.equal(isCreatedAtAcceptable(longAgo, NOW), false, 'a captured old event is refused');
});

test('created_at rejects non-numbers', () => {
  assert.equal(isCreatedAtAcceptable(NaN, NOW), false);
  assert.equal(isCreatedAtAcceptable(Infinity, NOW), false);
  assert.equal(isCreatedAtAcceptable('now' as unknown as number, NOW), false);
});

test('a nonce can be redeemed once', () => {
  assert.equal(markChallengeUsed('nonce-1', NOW), true);
  assert.equal(markChallengeUsed('nonce-1', NOW), false, 'second redemption is refused');
  assert.equal(markChallengeUsed('nonce-2', NOW), true, 'a different nonce is unaffected');
});

test('a nonce is redeemable again once its window has passed', () => {
  assert.equal(markChallengeUsed('nonce-1', NOW), true);
  const later = NOW + CHALLENGE_MAX_AGE_MS + 1000;
  // By then verifyChallenge refuses it anyway; this only proves the map does
  // not hold entries forever.
  assert.equal(markChallengeUsed('nonce-1', later), true);
});
