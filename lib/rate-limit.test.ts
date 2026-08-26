import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, clientIp, rateLimitHeaders } from './rate-limit';

const NOW = 1_800_000_000_000;

test('allows up to the limit, then refuses', () => {
  const limiter = new RateLimiter(3, 60_000);
  assert.equal(limiter.check('a', NOW).allowed, true);
  assert.equal(limiter.check('a', NOW).allowed, true);
  assert.equal(limiter.check('a', NOW).allowed, true);
  assert.equal(limiter.check('a', NOW).allowed, false, '4th request in the window');
});

test('reports remaining accurately', () => {
  const limiter = new RateLimiter(3, 60_000);
  assert.equal(limiter.check('a', NOW).remaining, 2);
  assert.equal(limiter.check('a', NOW).remaining, 1);
  assert.equal(limiter.check('a', NOW).remaining, 0);
  assert.equal(limiter.check('a', NOW).remaining, 0, 'never goes negative');
});

test('the window resets', () => {
  const limiter = new RateLimiter(1, 60_000);
  assert.equal(limiter.check('a', NOW).allowed, true);
  assert.equal(limiter.check('a', NOW).allowed, false);
  assert.equal(limiter.check('a', NOW + 60_001).allowed, true, 'new window');
});

test('identifiers are independent', () => {
  const limiter = new RateLimiter(1, 60_000);
  assert.equal(limiter.check('a', NOW).allowed, true);
  assert.equal(limiter.check('b', NOW).allowed, true);
  assert.equal(limiter.check('a', NOW).allowed, false);
});

// The bug in lib/api-utils.ts: its Map only ever grew.
test('expired entries are swept so the map cannot grow without bound', () => {
  const limiter = new RateLimiter(10, 1000, 100);
  for (let i = 0; i < 150; i++) limiter.check(`ip-${i}`, NOW);
  assert.ok(limiter.size > 100, 'entries accumulate inside the window');
  // A later request past the window triggers the sweep.
  limiter.check('trigger', NOW + 5000);
  assert.ok(limiter.size < 10, `expected a swept map, got ${limiter.size} entries`);
});

test('isLimited is check() as a boolean', () => {
  const limiter = new RateLimiter(1, 60_000);
  assert.equal(limiter.isLimited('a', NOW), false);
  assert.equal(limiter.isLimited('a', NOW), true);
});

// The reason clientIp exists.
test('clientIp takes the LAST x-forwarded-for entry, not the spoofable first', () => {
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });
  assert.equal(clientIp(headers), '203.0.113.9');
});

test('a client-forged x-forwarded-for cannot mint a new bucket', () => {
  const limiter = new RateLimiter(1, 60_000);
  const a = new Headers({ 'x-forwarded-for': 'FORGED-1, 203.0.113.9' });
  const b = new Headers({ 'x-forwarded-for': 'FORGED-2, 203.0.113.9' });
  assert.equal(limiter.check(clientIp(a), NOW).allowed, true);
  assert.equal(limiter.check(clientIp(b), NOW).allowed, false, 'same real IP, same bucket');
});

test('clientIp handles a single entry, whitespace, x-real-ip and nothing', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '  1.1.1.1 ,  2.2.2.2  ' })), '2.2.2.2');
  assert.equal(clientIp(new Headers({ 'x-real-ip': '203.0.113.7' })), '203.0.113.7');
  assert.equal(clientIp(new Headers()), 'unknown');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '' })), 'unknown');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': ' , , ' })), 'unknown');
});

test('rateLimitHeaders returns a Retry-After of at least 1', () => {
  const headers = rateLimitHeaders({ allowed: false, remaining: 0, resetAt: Date.now() - 5000 });
  assert.equal(headers['Retry-After'], '1');
  assert.equal(headers['X-RateLimit-Remaining'], '0');
});
