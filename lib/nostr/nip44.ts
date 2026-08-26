'use client';

/**
 * NIP-44 encrypt/decrypt through whatever signer the user actually logged in
 * with, and the one place that decides which one to ask.
 *
 * Two features need this — the encrypted NWC wallet backup and the private half
 * of the cross-app favorites list — and they must not each grow their own copy.
 * Every hard-won rule below (the nostr-login shim, the 130s timeout, the signer
 * capability table) is invisible until it bites, and a second implementation
 * would have none of them.
 *
 * WHAT CAN ENCRYPT, and this is not universal:
 *
 *   NIP-07 extension   only if `window.nostr.nip44` exists — ask, don't assume
 *   NIP-46 remote      yes (Amber over bunker, Primal) — the transport is
 *                      itself NIP-44, so capability is just connectivity
 *   NIP-55 intent      NO. nip55-client.ts implements sign_event and nothing
 *                      else; there is no `nip44_encrypt` over the intent URI.
 *   nip05 read-only    NO. There is no signer at all.
 *
 * Gate features on `signerSupportsNip44()` and render a reason, rather than
 * letting a call fail at use time. Half of the sessions above cannot do this,
 * and "nothing happened" is the worst of the available failures.
 */

/**
 * NIP-44 encrypt/decrypt goes through the user's signer, and a REMOTE signer
 * means a human tapping Approve on their phone. This was 10s — a figure taken
 * from "iOS killed the extension's background worker" — and it silently broke
 * Amber: the relay query found the backup, the decrypt request went out, and
 * we gave up long before the user could reach for their phone
 * ("Decryption timed out").
 *
 * 120s matches what the rest of the codebase already assumes about remote
 * signers: nip46-client's own request timeout and withSignerNudge's 125s hard
 * fail. The nudge toast appears after 4s so the wait is never silent.
 */
// Sits OUTSIDE withSignerNudge's 125s hard fail, which itself sits outside
// nip46-client's 120s request timeout. That ordering is deliberate and
// documented: the innermost layer has the most specific error, so it must be
// the one that fires. An outer wrapper at exactly 120s raced the client and
// replaced its diagnosis with a bare "timed out".
export const NIP44_TIMEOUT_MS = 130_000;

/**
 * The nip44 interface from a REAL NIP-07 extension.
 *
 * The login-type gate is essential and was learned the hard way. nostr-login
 * installs its own `window.nostr` shim that advertises nip44.encrypt/decrypt
 * whether or not it has a signer behind it — and when it doesn't, calling one
 * pops its "Welcome to Nostr!" login dialog instead of encrypting. `noBanner`
 * doesn't suppress that; it only hides the passive banner.
 *
 * So presence on window proves nothing. Only trust it when the user actually
 * signed in with an extension. For nip46 (Amber, Primal, bunker) the app's own
 * UnifiedSigner holds the live connection and must be used instead — it was
 * connected the whole time while this shim was hijacking the call.
 */
function getWindowNip44(): { encrypt: Function; decrypt: Function } | null {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('nostr_login_type') !== 'extension') return null;
  const n44 = (window as any).nostr?.nip44;
  return n44 && typeof n44.encrypt === 'function' && typeof n44.decrypt === 'function' ? n44 : null;
}

/**
 * Can the current session encrypt at all? False for NIP-55, for a read-only
 * nip05 session, and for extensions without window.nostr.nip44. Callers should
 * hide or disable the feature rather than let it fail at use time.
 */
export async function signerSupportsNip44(): Promise<boolean> {
  // A real extension's nip44 is a reliable yes. Anything else has to ask the
  // app's own signer — see getWindowNip44 for why window presence is not proof.
  if (getWindowNip44()) return true;
  try {
    const { getUnifiedSigner } = await import('./signer');
    const signer = getUnifiedSigner();
    await signer.ensureInitialized();
    return signer.supportsNip44();
  } catch {
    return false;
  }
}

export async function nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
  const win = getWindowNip44();
  if (win) {
    const { withSignerNudge } = await import('./signer-nudge');
    return withSignerNudge(() => win.encrypt(pubkey, plaintext) as Promise<string>, {
      op: 'encrypt',
    });
  }
  const { getUnifiedSigner } = await import('./signer');
  const signer = getUnifiedSigner();
  await signer.ensureInitialized();
  return signer.nip44Encrypt(pubkey, plaintext);
}

export async function nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
  const win = getWindowNip44();
  if (win) {
    const { withSignerNudge } = await import('./signer-nudge');
    return withSignerNudge(() => win.decrypt(pubkey, ciphertext) as Promise<string>, {
      op: 'decrypt',
    });
  }
  const { getUnifiedSigner } = await import('./signer');
  const signer = getUnifiedSigner();
  await signer.ensureInitialized();
  return signer.nip44Decrypt(pubkey, ciphertext);
}
