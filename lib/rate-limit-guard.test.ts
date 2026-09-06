import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRateLimitMode, createRouteLimiter, enforceRateLimit } from './rate-limit-guard';

function headersFor(ip: string): Headers {
  // The RIGHTMOST x-forwarded-for entry is the one Railway's edge writes, which
  // is what lib/rate-limit.ts keys on. The leftmost is client-controlled.
  return new Headers({ 'x-forwarded-for': `1.2.3.4, ${ip}` });
}

test('parseRateLimitMode: enforce only when asked for, everything else logs', () => {
  assert.equal(parseRateLimitMode(undefined), 'log');
  assert.equal(parseRateLimitMode(''), 'log');
  assert.equal(parseRateLimitMode('log'), 'log');
  assert.equal(parseRateLimitMode(' ENFORCE '), 'enforce');
  assert.equal(parseRateLimitMode('nonsense'), 'log');
});

test('log mode never refuses, however far over the limit', () => {
  const limiter = createRouteLimiter(3);
  const headers = headersFor('9.9.9.9');
  for (let i = 0; i < 50; i++) {
    assert.equal(enforceRateLimit(limiter, headers, 'test', 'log'), null, `request ${i}`);
  }
});

test('enforce mode allows up to the limit, then returns 429 with Retry-After', () => {
  const limiter = createRouteLimiter(3);
  const headers = headersFor('9.9.9.9');

  assert.equal(enforceRateLimit(limiter, headers, 'test', 'enforce'), null);
  assert.equal(enforceRateLimit(limiter, headers, 'test', 'enforce'), null);
  assert.equal(enforceRateLimit(limiter, headers, 'test', 'enforce'), null);

  const refused = enforceRateLimit(limiter, headers, 'test', 'enforce');
  assert.ok(refused, 'the fourth request must be refused');
  assert.equal(refused.status, 429);
  assert.ok(refused.headers.get('Retry-After'));
  assert.equal(refused.headers.get('X-RateLimit-Remaining'), '0');
});

test('one caller over the limit does not refuse a different caller', () => {
  const limiter = createRouteLimiter(2);
  const noisy = headersFor('9.9.9.9');
  const quiet = headersFor('8.8.8.8');

  enforceRateLimit(limiter, noisy, 'test', 'enforce');
  enforceRateLimit(limiter, noisy, 'test', 'enforce');
  assert.ok(enforceRateLimit(limiter, noisy, 'test', 'enforce'), 'noisy caller refused');

  assert.equal(enforceRateLimit(limiter, quiet, 'test', 'enforce'), null, 'quiet caller unaffected');
});

test('a forged leftmost x-forwarded-for cannot mint fresh buckets', () => {
  const limiter = createRouteLimiter(2);
  const label = 'test';
  // Same real (rightmost) IP, a different spoofed leftmost entry each time.
  const attempt = (spoof: string) =>
    enforceRateLimit(limiter, new Headers({ 'x-forwarded-for': `${spoof}, 9.9.9.9` }), label, 'enforce');

  assert.equal(attempt('1.1.1.1'), null);
  assert.equal(attempt('2.2.2.2'), null);
  assert.ok(attempt('3.3.3.3'), 'the third request is still refused despite the varied header');
});
