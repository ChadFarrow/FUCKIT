'use client';

/**
 * Turning `event.content` into a half of the favorites list, or admitting we
 * could not.
 *
 * THE ONLY RULE THAT MATTERS HERE: a private half we cannot read is a DEGRADED
 * READ, not an empty one. It gets the same answer a silent relay gets — carry
 * the ciphertext, publish nothing derived from it, and say so on screen.
 *
 * The two failures are indistinguishable downstream and the wrong call destroys
 * data. Publishing over a half we could not read replaces someone's private
 * favorites with an empty array, silently, with no undo, on an event that keeps
 * no history. And the user cannot otherwise tell "hidden here by choice" from
 * "this app has not shipped support yet" — both render as a shorter list.
 *
 * Not every signer can decrypt. NIP-55 (Amber over intent URIs) implements
 * `sign_event` and nothing else, and a read-only nip05 session has no signer at
 * all — so `unsupported` is a normal state for a real user, not an error, and
 * it must not be reported as a broken relay.
 */

import { decodePrivateFavorites, parseSingleList, type ParsedSingleList, EMPTY_PARSED } from './favorites-single-list';
import { NIP44_TIMEOUT_MS, nip44Decrypt, signerSupportsNip44 } from './nip44';

export type PrivateHalfStatus =
  /** `content` was empty. There is no private half, which is not a failure. */
  | 'none'
  /** Decrypted and parsed. `list` is usable. */
  | 'readable'
  /** This session has no signer that can decrypt. Carry, publish nothing from it. */
  | 'unsupported'
  /** There IS something there and we could not read it. Same treatment. */
  | 'unreadable';

export interface PrivateHalf {
  status: PrivateHalfStatus;
  /** The parsed half. Empty for every status but `readable` — and an empty list
   *  here must never be published from unless the status says `readable`. */
  list: ParsedSingleList;
  /** `event.content` exactly as it arrived, for putting back. */
  ciphertext: string;
}

/** True only when the half is safe to derive a publish from. */
export function isUsable(half: PrivateHalf): boolean {
  return half.status === 'readable' || half.status === 'none';
}

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

/**
 * Decrypt `content` into a tag array and parse it as a list.
 *
 * Never throws — every failure is a status, because the caller's job on any of
 * them is identical and a throw here would take down the public half's sync
 * with it.
 *
 * Prompts the signer, and on a remote signer that means a human tapping Approve
 * on their phone. The timeout is the same 130s the NWC backup uses, sized to
 * sit outside `withSignerNudge` rather than race it.
 */
export async function readPrivateHalf(pubkey: string, content: string): Promise<PrivateHalf> {
  if (!content) return { status: 'none', list: EMPTY_PARSED, ciphertext: '' };

  if (!(await signerSupportsNip44())) {
    // Expected for NIP-55 and read-only nip05 sessions. The bytes still go back
    // exactly as they came, which is the whole obligation.
    return { status: 'unsupported', list: EMPTY_PARSED, ciphertext: content };
  }

  let plaintext: string;
  try {
    plaintext = await withTimeout(nip44Decrypt(pubkey, content), NIP44_TIMEOUT_MS, 'Decryption');
  } catch (error) {
    console.warn('⚠️ Favorites: could not decrypt the private half —', error);
    return { status: 'unreadable', list: EMPTY_PARSED, ciphertext: content };
  }

  const tags = decodePrivateFavorites(plaintext);
  if (!tags) {
    // Decrypted fine and is not a favorites list. Someone else's payload, or a
    // format we do not know. `decodePrivateFavorites` returning null rather
    // than [] is what keeps this out of the readable branch — a JSON.parse that
    // succeeds on a non-array would otherwise mark it readable and EMPTY, and
    // the next republish would rewrite `content` from those empty lists.
    console.warn('⚠️ Favorites: the private half decrypted but is not a tag array');
    return { status: 'unreadable', list: EMPTY_PARSED, ciphertext: content };
  }

  return { status: 'readable', list: parseSingleList(tags), ciphertext: content };
}
