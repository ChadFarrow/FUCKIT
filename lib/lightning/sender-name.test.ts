import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BOOST_SENDER_NAME,
  looksLikeNostrIdentifier,
  resolveBoostSenderName,
} from './sender-name';

const NPUB = 'npub1xgyjasdztryl9sg6nfdm2wcj0j3qjs03sqhh7l3n6xk4xkq0m3nqbcd3fg';

test('looksLikeNostrIdentifier flags nostr: URIs, including truncated ones', () => {
  assert.equal(looksLikeNostrIdentifier(`nostr:${NPUB}`), true);
  // What a 50-char maxLength leaves behind — this is the value seen in the wild.
  assert.equal(looksLikeNostrIdentifier(`nostr:${NPUB}`.slice(0, 50)), true);
  assert.equal(looksLikeNostrIdentifier('NOSTR:npub1abc'), true);
});

test('looksLikeNostrIdentifier flags bare bech32 entities and hex pubkeys', () => {
  assert.equal(looksLikeNostrIdentifier(NPUB), true);
  assert.equal(looksLikeNostrIdentifier(NPUB.slice(0, 50)), true);
  assert.equal(looksLikeNostrIdentifier('nprofile1qqsw3'), true);
  assert.equal(looksLikeNostrIdentifier('a'.repeat(64)), true);
  assert.equal(looksLikeNostrIdentifier('  ' + NPUB + '  '), true);
});

test('looksLikeNostrIdentifier leaves real names alone', () => {
  assert.equal(looksLikeNostrIdentifier('Chad'), false);
  assert.equal(looksLikeNostrIdentifier('note taker'), false);
  assert.equal(looksLikeNostrIdentifier('Nostradamus'), false);
  assert.equal(looksLikeNostrIdentifier(''), false);
  assert.equal(looksLikeNostrIdentifier(null), false);
  assert.equal(looksLikeNostrIdentifier(undefined), false);
  // 64 chars but not hex.
  assert.equal(looksLikeNostrIdentifier('z'.repeat(64)), false);
});

test('resolveBoostSenderName prefers the explicit setting', () => {
  assert.equal(
    resolveBoostSenderName({
      settingsName: 'Chad',
      savedName: 'Old Name',
      nostrDisplayName: 'Profile Name',
    }),
    'Chad'
  );
});

test('resolveBoostSenderName falls through to the legacy saved name', () => {
  assert.equal(
    resolveBoostSenderName({ settingsName: '', savedName: 'Old Name' }),
    'Old Name'
  );
});

test('resolveBoostSenderName skips identifier-shaped values at every rung', () => {
  assert.equal(
    resolveBoostSenderName({
      settingsName: `nostr:${NPUB}`.slice(0, 50),
      savedName: NPUB,
      nostrDisplayName: 'Profile Name',
    }),
    'Profile Name'
  );
});

test('resolveBoostSenderName falls back to the default when nothing usable exists', () => {
  assert.equal(resolveBoostSenderName({}), DEFAULT_BOOST_SENDER_NAME);
  assert.equal(
    resolveBoostSenderName({ settingsName: NPUB, savedName: `nostr:${NPUB}` }),
    DEFAULT_BOOST_SENDER_NAME
  );
});

test('resolveBoostSenderName trims and caps at the input maxLength', () => {
  assert.equal(resolveBoostSenderName({ settingsName: '  Chad  ' }), 'Chad');
  assert.equal(resolveBoostSenderName({ settingsName: 'x'.repeat(80) }).length, 50);
});
