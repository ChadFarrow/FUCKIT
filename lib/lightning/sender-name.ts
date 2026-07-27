/**
 * Boost sender-name helpers.
 *
 * The "Your Name" field feeds `sender_name` in the Helipad / BoostBox metadata an
 * artist actually reads, so it needs to hold a human name — not a Nostr identifier.
 * Two paths put one there anyway, and both stick because the value is persisted:
 *
 *  1. Pasting a copied profile link (`nostr:npub1…`) into the box. Clients copy the
 *     `nostr:` URI form, so the pasted string is not even a bare npub.
 *  2. Browser autofill reusing a value saved from a Nostr login field — the boost
 *     input is a plain unnamed `<input type="text">`, which Chrome happily fills
 *     from any previously-submitted text field (truncated to `maxLength`).
 *
 * So a stored name that looks like an identifier is treated as unset, and we fall
 * back to the signed-in user's Nostr display name before the generic default.
 */

export const DEFAULT_BOOST_SENDER_NAME = 'StableKraft.app user';

/** Matches the `maxLength` on the boost modal's name input. */
export const MAX_BOOST_SENDER_NAME_LENGTH = 50;

// Truncated values must still match, so these are prefix checks rather than full
// bech32 validation — a 50-char slice of an npub is exactly what autofill leaves.
const NOSTR_BECH32_PREFIXES = ['npub1', 'nprofile1', 'nsec1', 'nevent1', 'note1', 'naddr1'];

/**
 * True when a string is a Nostr identifier rather than a name: any `nostr:` URI,
 * a bech32 entity (whole or truncated), or a raw 64-char hex pubkey.
 */
export function looksLikeNostrIdentifier(value: string | null | undefined): boolean {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return false;

  if (trimmed.startsWith('nostr:')) return true;

  if (NOSTR_BECH32_PREFIXES.some(prefix => trimmed.startsWith(prefix))) return true;

  return /^[0-9a-f]{64}$/.test(trimmed);
}

/**
 * Pick the name to prefill the boost modal with, in preference order:
 * explicit setting → legacy localStorage value → Nostr display name → default.
 * Any candidate that looks like a Nostr identifier is skipped.
 */
export function resolveBoostSenderName(sources: {
  settingsName?: string | null;
  savedName?: string | null;
  nostrDisplayName?: string | null;
}): string {
  const candidates = [sources.settingsName, sources.savedName, sources.nostrDisplayName];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && !looksLikeNostrIdentifier(value)) {
      return value.slice(0, MAX_BOOST_SENDER_NAME_LENGTH);
    }
  }

  return DEFAULT_BOOST_SENDER_NAME;
}
