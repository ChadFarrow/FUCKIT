import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isFountainRecipient,
  deriveFountainLightningAddress,
  FOUNTAIN_NODE_PUBKEYS,
  FOUNTAIN_CUSTOM_KEYS,
} from './fountain';

const FOUNTAIN_PUBKEY = '03b6f613e88bd874177c28c6ad83b3baba43c4c656f56be1f8df84669556054b79';
const FOUNTAIN_PUBKEY_ALT = '0332d57355d673e217238ce3e4be8491aa6b2a13f95494133ee243e57df1653ace';

// The exact shape Fountain recipients take in the catalog. The old guard tested
// `address.endsWith('@fountain.fm')`, which is false for every one of these — the address is a
// pubkey and the Lightning Address, when present at all, is in `name`.
const REAL_FOUNTAIN_RECIPIENT = {
  name: 'middleseasonmusic@fountain.fm',
  type: 'node' as const,
  address: FOUNTAIN_PUBKEY,
  split: 10,
  customKey: '906608',
  customValue: '01h4XlHtbf6uDlRYEcHnlR',
};

// Same node, but the artist is identified only by an opaque account id — 97 of the 176 Fountain
// recipients in the catalog look like this.
const ACCOUNT_ID_ONLY_RECIPIENT = {
  name: 'Elijah Lied',
  type: 'node' as const,
  address: FOUNTAIN_PUBKEY,
  split: 90,
  customKey: '906608',
  customValue: '01hM8bTqPUsO4tRUcvJIeh',
};

test('detects the real Fountain recipient shape the old guard missed', () => {
  assert.equal(isFountainRecipient(REAL_FOUNTAIN_RECIPIENT), true);
  assert.equal(isFountainRecipient(ACCOUNT_ID_ONLY_RECIPIENT), true);

  // The guard this replaces
  assert.equal(REAL_FOUNTAIN_RECIPIENT.address.toLowerCase().endsWith('@fountain.fm'), false);
});

test('detects Fountain by each of the three signals independently', () => {
  // by node pubkey alone (customKey stripped by an adapter along the way)
  assert.equal(
    isFountainRecipient({ name: 'Alandace', type: 'node', address: FOUNTAIN_PUBKEY }),
    true
  );
  assert.equal(
    isFountainRecipient({ name: 'Steve Webb', type: 'node', address: FOUNTAIN_PUBKEY_ALT }),
    true
  );

  // by custom key alone (feed omitted or changed the pubkey)
  for (const customKey of FOUNTAIN_CUSTOM_KEYS) {
    assert.equal(
      isFountainRecipient({ name: 'Someone', type: 'node', address: 'ff'.repeat(33), customKey }),
      true,
      `customKey ${customKey} should identify Fountain`
    );
  }

  // by lightning address, both domains, case-insensitively
  assert.equal(
    isFountainRecipient({ name: 'x', type: 'lnaddress', address: 'tammy0@fountain.fm' }),
    true
  );
  assert.equal(
    isFountainRecipient({ name: 'x', type: 'lnaddress', address: 'makeheroism@fountain.me' }),
    true
  );
  assert.equal(
    isFountainRecipient({ name: 'x', type: 'lnaddress', address: 'Tammy0@Fountain.FM' }),
    true
  );
});

test('leaves non-Fountain recipients alone', () => {
  assert.equal(
    isFountainRecipient({ name: 'Artist', type: 'node', address: '02' + 'ab'.repeat(32) }),
    false
  );
  assert.equal(
    isFountainRecipient({ name: 'Artist', type: 'lnaddress', address: 'artist@getalby.com' }),
    false
  );
  // A different provider's routing key on a different node must not be swept in.
  assert.equal(
    isFountainRecipient({
      name: 'Artist',
      type: 'node',
      address: '02' + 'ab'.repeat(32),
      customKey: '696969',
      customValue: 'someone',
    }),
    false
  );
  assert.equal(isFountainRecipient(null), false);
  assert.equal(isFountainRecipient(undefined), false);
  // A domain that merely contains "fountain" is not a Fountain domain.
  assert.equal(
    isFountainRecipient({ name: 'x', type: 'lnaddress', address: 'someone@notfountain.com' }),
    false
  );
});

test('derives the LNURL address from name when the recipient is a node entry', () => {
  assert.equal(
    deriveFountainLightningAddress(REAL_FOUNTAIN_RECIPIENT),
    'middleseasonmusic@fountain.fm'
  );
});

test('derives the LNURL address directly when already an lnaddress', () => {
  assert.equal(
    deriveFountainLightningAddress({
      name: 'Tammy',
      type: 'lnaddress',
      address: 'tammy0@fountain.fm',
    }),
    'tammy0@fountain.fm'
  );
});

test('returns undefined when only an account id identifies the artist', () => {
  // This is the case that must keysend rather than silently pay nobody.
  assert.equal(deriveFountainLightningAddress(ACCOUNT_ID_ONLY_RECIPIENT), undefined);
  assert.equal(deriveFountainLightningAddress(null), undefined);
  assert.equal(
    deriveFountainLightningAddress({ name: '', type: 'node', address: FOUNTAIN_PUBKEY }),
    undefined
  );
  // A name that isn't an address must not be handed to LNURL resolution.
  assert.equal(
    deriveFountainLightningAddress({
      name: 'Kolomona - Sir Libre - LightningThrashes.com - Tech help',
      type: 'node',
      address: FOUNTAIN_PUBKEY,
    }),
    undefined
  );
});

test('pubkey set is stored lowercase so uppercase feed values still match', () => {
  for (const pubkey of FOUNTAIN_NODE_PUBKEYS) {
    assert.equal(pubkey, pubkey.toLowerCase());
    assert.equal(
      isFountainRecipient({ name: 'x', type: 'node', address: pubkey.toUpperCase() }),
      true
    );
  }
});
