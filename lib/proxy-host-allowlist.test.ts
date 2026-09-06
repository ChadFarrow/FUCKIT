import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProxyHostMode,
  hostMatches,
  hostOf,
  STATIC_ALLOWED_HOSTS,
  checkProxyTarget,
  guardProxyTarget,
} from './proxy-host-allowlist';

test('parseProxyHostMode: enforce only when asked for, everything else logs', () => {
  assert.equal(parseProxyHostMode(undefined), 'log');
  assert.equal(parseProxyHostMode(''), 'log');
  assert.equal(parseProxyHostMode('log'), 'log');
  assert.equal(parseProxyHostMode(' ENFORCE '), 'enforce');
  assert.equal(parseProxyHostMode('yes'), 'log');
});

test('hostMatches: exact host and true subdomains only', () => {
  assert.equal(hostMatches('wavlake.com', ['wavlake.com']), true);
  assert.equal(hostMatches('cdn.wavlake.com', ['wavlake.com']), true);
  assert.equal(hostMatches('a.b.wavlake.com', ['wavlake.com']), true);
  assert.equal(hostMatches('WAVLAKE.COM', ['wavlake.com']), true, 'case insensitive');
  assert.equal(hostMatches('wavlake.com.', ['wavlake.com']), true, 'trailing root dot');
});

test('hostMatches: the suffix-confusion attacks an includes() check would let through', () => {
  // These are exactly why this does not use String.includes.
  assert.equal(hostMatches('wavlake.com.attacker.net', ['wavlake.com']), false);
  assert.equal(hostMatches('notwavlake.com', ['wavlake.com']), false);
  assert.equal(hostMatches('evil-wavlake.com', ['wavlake.com']), false);
  assert.equal(hostMatches('wavlake.com.evil.io', ['wavlake.com']), false);
  assert.equal(hostMatches('attacker.net', ['wavlake.com']), false);
});

test('hostMatches: empty allowlist entries never match', () => {
  assert.equal(hostMatches('anything.com', ['', '   ']), false);
  assert.equal(hostMatches('anything.com', []), false);
});

test('hostOf: hostname or null, never a throw', () => {
  assert.equal(hostOf('https://cdn.wavlake.com/track/abc.mp3'), 'cdn.wavlake.com');
  assert.equal(hostOf('http://Example.COM:8080/a'), 'example.com');
  assert.equal(hostOf('not a url'), null);
  assert.equal(hostOf(''), null);
  assert.equal(hostOf(null), null);
  assert.equal(hostOf(undefined), null);
});

test('STATIC_ALLOWED_HOSTS: carries the audio path hosts and has no duplicates', () => {
  assert.ok(STATIC_ALLOWED_HOSTS.includes('wavlake.com'));
  assert.ok(STATIC_ALLOWED_HOSTS.includes('doerfelverse.com'), 'from CORS_PROBLEMATIC_DOMAINS');
  assert.ok(STATIC_ALLOWED_HOSTS.includes('heycitizen.xyz'), 'from DIRECT_FIRST_DOMAINS');
  assert.equal(new Set(STATIC_ALLOWED_HOSTS).size, STATIC_ALLOWED_HOSTS.length);
});

test('checkProxyTarget: a static host is allowed without touching the database', async () => {
  // No DATABASE_URL is configured in this test run, so reaching the catalog
  // query at all would show up as a failure or a hang here.
  assert.deepEqual(await checkProxyTarget('https://cdn.wavlake.com/t.mp3', 'enforce'), {
    allowed: true,
    host: 'cdn.wavlake.com',
    reason: 'static',
  });
  assert.deepEqual(await checkProxyTarget('https://stablekraft.app/x.png', 'enforce'), {
    allowed: true,
    host: 'stablekraft.app',
    reason: 'static',
  });
});

test('checkProxyTarget: an unparseable url is allowed, not refused', async () => {
  assert.deepEqual(await checkProxyTarget('nonsense', 'enforce'), {
    allowed: true,
    host: null,
    reason: 'unavailable',
  });
});

/** A stand-in for what the catalog query returns. */
const CATALOG = new Set(['media.example-artist.com', 'files.someartist.net']);

test('checkProxyTarget: a catalog host and its subdomains are allowed', async () => {
  assert.deepEqual(await checkProxyTarget('https://media.example-artist.com/a.mp3', 'enforce', CATALOG), {
    allowed: true,
    host: 'media.example-artist.com',
    reason: 'catalog',
  });
  assert.equal(
    (await checkProxyTarget('https://cdn.files.someartist.net/x.png', 'enforce', CATALOG)).reason,
    'catalog'
  );
});

test('checkProxyTarget: enforce mode REFUSES a host the catalog never references', async () => {
  // The abuse being closed: piping any file on the internet through this server.
  assert.deepEqual(await checkProxyTarget('https://attacker.example/huge.iso', 'enforce', CATALOG), {
    allowed: false,
    host: 'attacker.example',
    reason: 'foreign',
  });
  // And the suffix-confusion attempt against a real catalog host.
  assert.equal(
    (await checkProxyTarget('https://media.example-artist.com.attacker.net/x', 'enforce', CATALOG)).allowed,
    false
  );
});

test('checkProxyTarget: log mode allows the same foreign host, and says so', async () => {
  assert.deepEqual(await checkProxyTarget('https://attacker.example/huge.iso', 'log', CATALOG), {
    allowed: true,
    host: 'attacker.example',
    reason: 'log-mode',
  });
});

test('checkProxyTarget: a failed catalog load allows everything rather than breaking the catalog', async () => {
  assert.deepEqual(await checkProxyTarget('https://attacker.example/huge.iso', 'enforce', null), {
    allowed: true,
    host: 'attacker.example',
    reason: 'unavailable',
  });
});

test('guardProxyTarget: refusal only in enforce mode against a loaded catalog', async () => {
  assert.deepEqual(await guardProxyTarget('https://attacker.example/x', 'test', 'enforce', CATALOG), {
    refusal: { error: 'Host not allowed', status: 403 },
  });
  assert.deepEqual(await guardProxyTarget('https://attacker.example/x', 'test', 'log', CATALOG), { refusal: null });
  assert.deepEqual(await guardProxyTarget('https://attacker.example/x', 'test', 'enforce', null), { refusal: null });
  assert.deepEqual(await guardProxyTarget('https://cdn.wavlake.com/x', 'test', 'enforce', CATALOG), { refusal: null });
});
