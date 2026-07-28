import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyBoostFailure } from './boost-failure';

// The literal strings the payment layer produces, so the classifier is pinned to
// real messages rather than to invented ones.
const REAL_MESSAGES: Array<[string, string, boolean]> = [
  // BitcoinConnectProvider.sendPayment / sendKeysend
  ['No wallet connected - please connect your Lightning wallet', 'no-wallet', true],
  ['Wallet must be unlocked - please check your Lightning wallet', 'no-wallet', true],
  ['Insufficient balance in your Lightning wallet', 'insufficient-balance', true],
  [
    'Cannot find payment route to recipient - they may be offline or unreachable via Lightning Network',
    'no-route',
    false,
  ],
  // ValueSplitsService remapped errors
  ['Cannot find payment route - recipient may be offline', 'no-route', false],
  ['Insufficient balance in wallet', 'insufficient-balance', true],
  ['Payment timeout - recipient may be experiencing issues', 'timeout', false],
  ['Payment rejected or cancelled', 'rejected', true],
  ['Network error - check your connection', 'network', false],
  // BoostButton guards
  ['No Value4Value configuration found for this track', 'no-v4v-config', false],
  ['Keysend is not supported by your wallet. Try Alby or Coinos via NWC.', 'keysend-unsupported', true],
  ['Lightning Address payment failed: bad callback', 'lnurl-error', false],
];

test('classifies the messages the payment layer actually produces', () => {
  for (const [message, category, userActionable] of REAL_MESSAGES) {
    const result = classifyBoostFailure(message);
    assert.equal(result.category, category, `category for: ${message}`);
    assert.equal(result.userActionable, userActionable, `userActionable for: ${message}`);
  }
});

test('specific diagnoses beat the generic words they contain', () => {
  // Contains "wallet" but is not a no-wallet condition.
  assert.equal(
    classifyBoostFailure('Keysend is not supported by your wallet').category,
    'keysend-unsupported'
  );
  // Contains "Network" but is a routing failure.
  assert.equal(
    classifyBoostFailure('unreachable via Lightning Network').category,
    'no-route'
  );
});

// The fixture above pins exact literals, which is precisely why a bare
// `includes('keysend')` rung looked correct: every real message that names the method
// also happened to be an unsupported-wallet message. These are the mixed forms.
test('naming keysend does not make an ordinary failure the sender\'s problem', () => {
  const cases: Array<[string, string, boolean]> = [
    ['Keysend payment failed: insufficient balance', 'insufficient-balance', true],
    ['Keysend failed - cannot find payment route', 'no-route', false],
    ['Keysend payment timeout - recipient may be experiencing issues', 'timeout', false],
    ['Keysend payment rejected or cancelled', 'rejected', true],
  ];

  for (const [message, category, userActionable] of cases) {
    const result = classifyBoostFailure(message);
    assert.equal(result.category, category, `category for: ${message}`);
    assert.equal(result.userActionable, userActionable, `userActionable for: ${message}`);
  }
});

test('keysend-unsupported still matches the phrasings wallets actually use', () => {
  // Same phrasings the chapter auto-boost path in AudioContext matches on.
  for (const message of [
    'Keysend not supported',
    "Your wallet doesn't support keysend",
    'Keysend is not supported by your wallet. Try Alby or Coinos via NWC.',
    'keysend not implemented',
    'pay_keysend not implemented',
  ]) {
    assert.equal(classifyBoostFailure(message).category, 'keysend-unsupported', message);
    assert.equal(classifyBoostFailure(message).userActionable, true, message);
  }
});

test('an unrecognised or missing reason is unknown, never mislabelled', () => {
  assert.equal(classifyBoostFailure('something nobody has seen before').category, 'unknown');
  assert.equal(classifyBoostFailure('').category, 'unknown');
  assert.equal(classifyBoostFailure(null).category, 'unknown');
  assert.equal(classifyBoostFailure(undefined).category, 'unknown');
  // Unknown is never assumed to be the sender's problem.
  assert.equal(classifyBoostFailure('').userActionable, false);
});

test('classification is case-insensitive', () => {
  assert.equal(classifyBoostFailure('INSUFFICIENT BALANCE').category, 'insufficient-balance');
  assert.equal(classifyBoostFailure('  Payment Rejected  ').category, 'rejected');
});
