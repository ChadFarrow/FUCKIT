import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ALLOWED_ORIGINS,
  parseCorsMode,
  parseAllowedOrigins,
  isLocalOrigin,
  resolveAllowedOrigin,
} from './cors';

const ALLOWED = parseAllowedOrigins(undefined);

test('parseCorsMode: enforce only when asked for, everything else logs', () => {
  assert.equal(parseCorsMode(undefined), 'log');
  assert.equal(parseCorsMode(''), 'log');
  assert.equal(parseCorsMode(' ENFORCE '), 'enforce');
  assert.equal(parseCorsMode('strict'), 'log');
});

test('parseAllowedOrigins: keeps ours, trims, drops trailing slashes and blanks', () => {
  assert.deepEqual(parseAllowedOrigins(undefined), [...DEFAULT_ALLOWED_ORIGINS]);
  assert.deepEqual(parseAllowedOrigins(' https://a.example/ , , https://b.example '), [
    ...DEFAULT_ALLOWED_ORIGINS,
    'https://a.example',
    'https://b.example',
  ]);
});

test('log mode answers * for everyone, exactly as before', () => {
  assert.equal(resolveAllowedOrigin(null, ALLOWED, 'log'), '*');
  assert.equal(resolveAllowedOrigin('https://attacker.example', ALLOWED, 'log'), '*');
});

test('enforce mode echoes one allowed origin, never a list', () => {
  const value = resolveAllowedOrigin('https://stablekraft.app', ALLOWED, 'enforce');
  assert.equal(value, 'https://stablekraft.app');
  assert.ok(!value.includes(','), 'a comma-joined value is invalid and every browser rejects it');
});

test('enforce mode sends no header for a foreign website', () => {
  assert.equal(resolveAllowedOrigin('https://attacker.example', ALLOWED, 'enforce'), null);
  assert.equal(resolveAllowedOrigin('https://stablekraft.app.attacker.net', ALLOWED, 'enforce'), null);
  assert.equal(resolveAllowedOrigin('http://stablekraft.app', ALLOWED, 'enforce'), null, 'scheme must match');
});

test('enforce mode sends no header when there is no Origin, which is the untouched case', () => {
  // Same-origin fetches, our Android WebView, curl, and the Node podping
  // consumer all arrive with no Origin. They need no header and must keep working.
  assert.equal(resolveAllowedOrigin(null, ALLOWED, 'enforce'), null);
  assert.equal(resolveAllowedOrigin('', ALLOWED, 'enforce'), null);
});

test('enforce mode honours an extra configured origin', () => {
  const withExtra = parseAllowedOrigins('https://itdv.example');
  assert.equal(resolveAllowedOrigin('https://itdv.example', withExtra, 'enforce'), 'https://itdv.example');
  assert.equal(resolveAllowedOrigin('https://itdv.example/', withExtra, 'enforce'), 'https://itdv.example');
});

test('localhost is allowed on any port, so development keeps working', () => {
  assert.equal(isLocalOrigin('http://localhost:3000'), true);
  assert.equal(isLocalOrigin('http://127.0.0.1:3001'), true);
  assert.equal(isLocalOrigin('https://notlocalhost.example'), false);
  assert.equal(resolveAllowedOrigin('http://localhost:3000', ALLOWED, 'enforce'), 'http://localhost:3000');
});
