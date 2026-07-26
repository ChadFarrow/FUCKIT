'use client';

/**
 * Encrypted NWC-connection backup on Nostr.
 *
 * An NWC connection string lives only in localStorage on the device that pasted
 * it (bitcoin-connect keeps it in `bc:config`). New phone, cleared site data, or
 * a second browser and the user has to mint a fresh connection in Alby Hub or
 * Coinos. This publishes it, encrypted to the user's own key, so signing in
 * elsewhere can pull it back.
 *
 * Storage shape (NIP-78 application data):
 *   - kind:    30078
 *   - d-tag:   'stablekraft:wallet:nwc'  (replaceable — one backup per user)
 *   - content: NIP-44 v2 encrypt-to-self of JSON {"uri": "nostr+walletconnect://…"}
 *
 * Trust model: anyone holding the user's nsec can decrypt this — the same
 * boundary as logging in. An NWC string is a *budgeted spending credential*
 * though, not a preference, so this is strictly opt-in and every publish is
 * something the user was asked about first.
 *
 * `hasNwcBackup` vs `fetchNwcBackup` is a deliberate split: existence is a
 * plain relay query needing no signer, so the restore prompt can appear without
 * firing an approval request on the user's phone. Only tapping through to
 * connect triggers a decrypt.
 */

import { getDefaultRelays } from './relay';
import { getUserWriteRelays } from './nip65';

export const NWC_BACKUP_KIND = 30078;
export const NWC_BACKUP_D_TAG = 'stablekraft:wallet:nwc';

/** Pubkeys that answered "Not now", so the post-login offer doesn't nag on every sign-in. */
export const NWC_BACKUP_DECLINED_KEY = 'sk_nwc_backup_declined';

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
 * fail. The nudge toast (below) appears after 4s so the wait is never silent.
 */
const NIP44_TIMEOUT_MS = 120_000;

const RELAY_QUERY_TIMEOUT_MS = 8_000;
const MAX_READ_RELAYS = 20;

// ── pure helpers (unit-tested — see nwc-backup.test.ts) ────────────────────

/**
 * Read-side relay set: the user's write relays followed by the defaults,
 * deduped and capped.
 *
 * The union matters. On a fresh sign-in, NIP-65 hydrates in parallel with
 * everything else, so `getUserWriteRelays()` may still be empty when the user
 * opens the wallet modal. If the backup was published from a session that DID
 * have write relays it would live only on their outbox and we'd miss it.
 * Querying both sides covers either case; the publish path stays narrow.
 */
export function buildReadRelays(writeRelays: string[], defaults: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...writeRelays, ...defaults]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, MAX_READ_RELAYS);
}

/** Extract the URI from a decrypted payload, or null if it isn't one we wrote. */
export function parseBackupPayload(plaintext: string): string | null {
  try {
    const parsed = JSON.parse(plaintext);
    const uri = parsed?.uri;
    return typeof uri === 'string' && uri ? uri : null;
  } catch {
    return null;
  }
}

/** Build the encrypted-to-self payload for a connection string. */
export function buildBackupPayload(uri: string): string {
  return JSON.stringify({ uri });
}

/** Pull the NWC connection string out of bitcoin-connect's persisted config. */
export function readNwcUriFromConfig(rawConfig: string | null): string | null {
  if (!rawConfig) return null;
  try {
    const parsed = JSON.parse(rawConfig);
    const uri = parsed?.nwcUrl;
    // Extension connections persist a config with no nwcUrl — nothing to back up.
    return typeof uri === 'string' && uri ? uri : null;
  } catch {
    return null;
  }
}

// ── browser-side operations ───────────────────────────────────────────────

/** The connection string currently in use, or null (not connected / extension). */
export function getConnectedNwcUri(): string | null {
  if (typeof window === 'undefined') return null;
  return readNwcUriFromConfig(localStorage.getItem('bc:config'));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);
}

/**
 * A relay query has THREE outcomes, and collapsing them loses the important
 * one. "Could not ask" is not "there is nothing there": several defaults are
 * flaky (damus 503s, others stall), querySync waits on all of them, and a
 * timeout used to be reported as "no backup" — so the UI said Not saved and
 * asked the user to save a backup that already existed.
 */
type BackupQuery =
  | { status: 'found'; content: string }
  | { status: 'none' }
  | { status: 'error' };

async function queryBackupEvent(pubkey: string): Promise<BackupQuery> {
  const { SimplePool } = await import('nostr-tools/pool');
  const relays = buildReadRelays(getUserWriteRelays(pubkey), getDefaultRelays());
  const pool = new SimplePool();
  try {
    // maxWait, not an outer Promise.race. querySync waits for EOSE from every
    // relay, and dead ones (damus 503s, nsec.app) never send it — a racing
    // timeout rejected and DISCARDED events the healthy relays had already
    // returned, so an existing backup read as "none". maxWait returns what was
    // actually collected by the deadline. The outer race is only a backstop for
    // the pool hanging entirely.
    const events = await withTimeout(
      pool.querySync(
        relays,
        {
          kinds: [NWC_BACKUP_KIND],
          authors: [pubkey],
          '#d': [NWC_BACKUP_D_TAG],
          limit: 1,
        },
        { maxWait: RELAY_QUERY_TIMEOUT_MS }
      ),
      RELAY_QUERY_TIMEOUT_MS * 2,
      'Relay query'
    );
    if (!events || events.length === 0) return { status: 'none' };
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
    // A tombstone is the same coordinate with empty content — a real "no backup".
    if (!latest.content) return { status: 'none' };
    return { status: 'found', content: latest.content };
  } catch (error) {
    console.warn('⚠️ NWC backup: relay query failed (treating as unknown, NOT as "no backup"):', error);
    return { status: 'error' };
  } finally {
    try {
      pool.close(relays);
    } catch {
      // pool already closed — nothing to do
    }
  }
}

/**
 * Does a backup exist for this pubkey? Relay query only — no signer, no
 * decrypt, so this is safe to call speculatively when a modal opens.
 */
export async function hasNwcBackup(pubkey: string): Promise<BackupStatus> {
  const result = await queryBackupEvent(pubkey);
  return result.status === 'found' ? 'saved' : result.status === 'none' ? 'none' : 'unknown';
}

/** 'saved' | 'none' = answered; 'unknown' = relays could not be reached. */
export type BackupStatus = 'saved' | 'none' | 'unknown';

/**
 * Backup existence, cached per pubkey for the page's lifetime. Module scope so
 * it survives component remounts — the wallet modal and the account menu both
 * ask, and neither should re-hit relays for an answer we already have.
 */
const backupExistsCache = new Map<string, boolean>();

export function getCachedBackupExists(pubkey: string): boolean | undefined {
  return backupExistsCache.get(pubkey);
}

export function setCachedBackupExists(pubkey: string, exists: boolean): void {
  backupExistsCache.set(pubkey, exists);
}

/**
 * Cached backup status. An 'unknown' is never cached — the next attempt should
 * ask again rather than remember a network failure as a fact.
 */
export async function checkBackupExists(
  pubkey: string,
  options: { force?: boolean } = {}
): Promise<BackupStatus> {
  if (!options.force) {
    const cached = backupExistsCache.get(pubkey);
    if (cached !== undefined) return cached ? 'saved' : 'none';
  }
  const status = await hasNwcBackup(pubkey);
  if (status !== 'unknown') backupExistsCache.set(pubkey, status === 'saved');
  return status;
}

/**
 * Can the current session encrypt at all? False for NIP-55, for a read-only
 * nip05 session, and for extensions without window.nostr.nip44. Callers should
 * hide the backup UI rather than let it fail at use time.
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

async function nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
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

async function nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
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

/**
 * Fetch and decrypt the stored connection string. Prompts the signer, so only
 * call this after the user has explicitly asked to restore.
 */
export async function fetchNwcBackup(pubkey: string): Promise<string | null> {
  const event = await queryBackupEvent(pubkey);
  if (event.status !== 'found') return null;

  const plaintext = await withTimeout(
    nip44Decrypt(pubkey, event.content),
    NIP44_TIMEOUT_MS,
    'Decryption'
  );
  return parseBackupPayload(plaintext);
}

async function signAndPublish(pubkey: string, content: string): Promise<void> {
  const { getUnifiedSigner } = await import('./signer');
  const { RelayManager } = await import('./relay');

  const signer = getUnifiedSigner();
  await signer.ensureInitialized();

  const unsigned = {
    kind: NWC_BACKUP_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', NWC_BACKUP_D_TAG]],
    content,
    pubkey,
  };

  const signed = await signer.signEvent(unsigned as any);

  // RelayManager.publish() only reaches relays that were explicitly connected —
  // it iterates `this.relays`, which connect() populates. Skipping this step
  // doesn't error: writeRelays is empty, so publish resolves with [] and looks
  // like success while the event goes nowhere. That shipped once and made
  // "Saved" a lie.
  const relayUrls = buildReadRelays(getUserWriteRelays(pubkey), getDefaultRelays());
  const relayManager = new RelayManager();
  try {
    const connections = await Promise.allSettled(
      relayUrls.map((url) => relayManager.connect(url, { read: false, write: true }))
    );
    const connected = connections.filter((r) => r.status === 'fulfilled').length;
    if (connected === 0) {
      throw new Error('Could not reach any Nostr relay');
    }

    // Likewise check the outcome: publish() returns settled results and never
    // rejects, so an unchecked await cannot tell "stored" from "refused".
    const results = await relayManager.publish(signed);
    const accepted = results.filter((r) => r.status === 'fulfilled').length;
    if (accepted === 0) {
      throw new Error('No relay accepted the backup');
    }
    console.log(`📤 NWC backup: published to ${accepted}/${connected} relay(s)`);
  } finally {
    // Standing invariant: always disconnect, or WebSockets leak and accumulate.
    await relayManager.disconnectAll();
  }
}

/** Encrypt-to-self and publish the backup. */
export async function publishNwcBackup(pubkey: string, uri: string): Promise<void> {
  const ciphertext = await withTimeout(
    nip44Encrypt(pubkey, buildBackupPayload(uri)),
    NIP44_TIMEOUT_MS,
    'Encryption'
  );
  await signAndPublish(pubkey, ciphertext);

  // Keep the cache honest here rather than at each call site — the modal and the
  // account menu both read it, and a stale 'none' would offer to save twice.
  setCachedBackupExists(pubkey, true);
}

/**
 * Tombstone the backup: republish the same replaceable coordinate with empty
 * content and a newer timestamp, so the current version carries no secret.
 * Relays should drop the superseded event; any that retain it hold ciphertext
 * only the user's own key opens.
 */
export async function deleteNwcBackup(pubkey: string): Promise<void> {
  await signAndPublish(pubkey, '');
  setCachedBackupExists(pubkey, false);
}

// ── local flags ───────────────────────────────────────────────────────────

export function markBackupDeclined(pubkey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(NWC_BACKUP_DECLINED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(pubkey)) {
      list.push(pubkey);
      localStorage.setItem(NWC_BACKUP_DECLINED_KEY, JSON.stringify(list));
    }
  } catch {
    localStorage.setItem(NWC_BACKUP_DECLINED_KEY, JSON.stringify([pubkey]));
  }
}

export function hasDeclinedBackup(pubkey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(NWC_BACKUP_DECLINED_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(pubkey);
  } catch {
    return false;
  }
}
