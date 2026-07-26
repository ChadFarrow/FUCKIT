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

/** Set once a backup has been published from this device, so disconnect knows to tombstone it. */
export const NWC_BACKUP_PUBKEY_KEY = 'sk_nwc_backup_pubkey';
/** Pubkeys that answered "Not now", so the post-login offer doesn't nag on every sign-in. */
export const NWC_BACKUP_DECLINED_KEY = 'sk_nwc_backup_declined';

/**
 * NIP-44 decrypt goes through the user's signer. On iOS the extension's
 * background worker (or a backgrounded Amber) can be killed between the relay
 * query and the decrypt, leaving the promise pending forever. Cap it so it
 * rejects visibly instead of hanging the UI.
 */
const NIP44_TIMEOUT_MS = 10_000;

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

async function queryBackupEvent(pubkey: string): Promise<{ content: string } | null> {
  const { SimplePool } = await import('nostr-tools/pool');
  const relays = buildReadRelays(getUserWriteRelays(pubkey), getDefaultRelays());
  const pool = new SimplePool();
  try {
    const events = await withTimeout(
      pool.querySync(relays, {
        kinds: [NWC_BACKUP_KIND],
        authors: [pubkey],
        '#d': [NWC_BACKUP_D_TAG],
        limit: 1,
      }),
      RELAY_QUERY_TIMEOUT_MS,
      'Relay query'
    );
    if (!events || events.length === 0) return null;
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
    // A tombstone is the same coordinate with empty content — treat as "no backup".
    if (!latest.content) return null;
    return { content: latest.content };
  } catch (error) {
    console.warn('⚠️ NWC backup: relay query failed:', error);
    return null;
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
export async function hasNwcBackup(pubkey: string): Promise<boolean> {
  return (await queryBackupEvent(pubkey)) !== null;
}

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

export async function checkBackupExists(
  pubkey: string,
  options: { force?: boolean } = {}
): Promise<boolean> {
  if (!options.force) {
    const cached = backupExistsCache.get(pubkey);
    if (cached !== undefined) return cached;
  }
  const exists = await hasNwcBackup(pubkey);
  backupExistsCache.set(pubkey, exists);
  return exists;
}

/**
 * Can the current session encrypt at all? False for NIP-55, for a read-only
 * nip05 session, and for extensions without window.nostr.nip44. Callers should
 * hide the backup UI rather than let it fail at use time.
 */
export async function signerSupportsNip44(): Promise<boolean> {
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
 * Fetch and decrypt the stored connection string. Prompts the signer, so only
 * call this after the user has explicitly asked to restore.
 */
export async function fetchNwcBackup(pubkey: string): Promise<string | null> {
  const event = await queryBackupEvent(pubkey);
  if (!event) return null;

  const { getUnifiedSigner } = await import('./signer');
  const signer = getUnifiedSigner();
  await signer.ensureInitialized();

  const plaintext = await withTimeout(
    signer.nip44Decrypt(pubkey, event.content),
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

  const relayManager = new RelayManager();
  try {
    await relayManager.publish(signed);
  } finally {
    // Standing invariant: always disconnect, or WebSockets leak and accumulate.
    await relayManager.disconnectAll();
  }
}

/** Encrypt-to-self and publish the backup. */
export async function publishNwcBackup(pubkey: string, uri: string): Promise<void> {
  const { getUnifiedSigner } = await import('./signer');
  const signer = getUnifiedSigner();
  await signer.ensureInitialized();

  const ciphertext = await withTimeout(
    signer.nip44Encrypt(pubkey, buildBackupPayload(uri)),
    NIP44_TIMEOUT_MS,
    'Encryption'
  );
  await signAndPublish(pubkey, ciphertext);

  // Keep the cache honest here rather than at each call site — the modal and the
  // account menu both read it, and a stale 'none' would offer to save twice.
  setCachedBackupExists(pubkey, true);
  if (typeof window !== 'undefined') {
    localStorage.setItem(NWC_BACKUP_PUBKEY_KEY, pubkey);
  }
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
  if (typeof window !== 'undefined') {
    localStorage.removeItem(NWC_BACKUP_PUBKEY_KEY);
  }
}

// ── local flags ───────────────────────────────────────────────────────────

/** Did this device publish a backup for this user? Gates the disconnect tombstone. */
export function hasLocalBackupFlag(pubkey: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(NWC_BACKUP_PUBKEY_KEY) === pubkey;
}

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
