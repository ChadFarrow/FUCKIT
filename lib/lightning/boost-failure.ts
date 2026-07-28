/**
 * Classifies a boost failure reason into a short, greppable category.
 *
 * Every failure is recorded — none of these are a reason to drop a log line. The
 * category exists so a Railway sweep can tell the two kinds apart: conditions the
 * sender has to resolve (no wallet, empty balance) versus conditions we have to fix
 * (a feed with no V4V config, an LNURL endpoint erroring, a recipient nobody can
 * route to). Without it every failure reads the same and the fixable ones are lost
 * in the noise of the ordinary ones.
 *
 * Matched against the messages the payment layer actually produces:
 * BitcoinConnectProvider's parsed wallet errors, ValueSplitsService's remapped
 * Lightning errors, and BoostButton's own guard messages.
 */

export type BoostFailureCategory =
  | 'no-wallet'
  | 'insufficient-balance'
  | 'no-route'
  | 'timeout'
  | 'rejected'
  | 'keysend-unsupported'
  | 'no-v4v-config'
  | 'lnurl-error'
  | 'network'
  | 'unknown';

export interface BoostFailureClassification {
  category: BoostFailureCategory;
  /** True when the sender can resolve it themselves; false when it needs a fix from us. */
  userActionable: boolean;
}

/**
 * Both directions matter: wallets say "keysend not supported" and also
 * "your wallet doesn't support keysend", and the latter contains neither
 * "not supported" nor "unsupported". See matchCategory.
 */
const KEYSEND_UNSUPPORTED_PHRASES = [
  'not supported',
  'unsupported',
  'not implemented',
  "doesn't support",
  'does not support',
];

const USER_ACTIONABLE: ReadonlySet<BoostFailureCategory> = new Set<BoostFailureCategory>([
  'no-wallet',
  'insufficient-balance',
  'rejected',
  'keysend-unsupported',
]);

export function classifyBoostFailure(reason: string | null | undefined): BoostFailureClassification {
  const text = reason?.toLowerCase().trim() ?? '';

  const category = matchCategory(text);
  return { category, userActionable: USER_ACTIONABLE.has(category) };
}

function matchCategory(text: string): BoostFailureCategory {
  if (!text) return 'unknown';

  // Ordered: earlier rules win. "Keysend is not supported by your wallet" contains
  // "wallet", and the no-route message contains "network", so the specific
  // diagnoses have to be tested before the generic ones.
  if (text.includes('value4value') || text.includes('no v4v')) return 'no-v4v-config';
  if (text.includes('insufficient')) return 'insufficient-balance';

  if (text.includes('no wallet connected') || text.includes('must be unlocked')) {
    return 'no-wallet';
  }

  if (text.includes('no route') || text.includes('find payment route') || text.includes('unreachable')) {
    return 'no-route';
  }

  if (text.includes('rejected') || text.includes('cancelled') || text.includes('canceled') || text.includes('denied')) {
    return 'rejected';
  }

  if (text.includes('timeout') || text.includes('timed out')) return 'timeout';

  // Sits BELOW the diagnoses above, and matches the method name only alongside an
  // "unsupported" phrasing. `keysend-unsupported` is the one category that tells the
  // sender to go and switch wallets, so it must not swallow a keysend payment that
  // failed for an ordinary reason: "Keysend failed: insufficient balance" is a balance
  // problem and "Keysend failed - cannot find payment route" is ours to fix. A bare
  // `includes('keysend')` here classified both as the sender's problem and quietly
  // emptied the fixable bucket this whole module exists to fill.
  // Phrasings mirror the predicate already used in AudioContext's chapter auto-boost.
  if (text.includes('keysend') && KEYSEND_UNSUPPORTED_PHRASES.some(phrase => text.includes(phrase))) {
    return 'keysend-unsupported';
  }

  // NWC relays without pay_keysend frequently answer with nothing more than this.
  if (text.includes('not implemented')) return 'keysend-unsupported';

  if (text.includes('lnurl') || text.includes('lightning address') || /http\s?[45]\d?\d?/.test(text)) {
    return 'lnurl-error';
  }

  if (text.includes('network error') || text.includes('failed to fetch') || text.includes('networkerror')) {
    return 'network';
  }

  return 'unknown';
}
