'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Puzzle, Zap, ClipboardPaste, ShieldCheck, RotateCcw } from 'lucide-react';
import { useNostr } from '@/contexts/NostrContext';
import {
  checkBackupExists,
  getCachedBackupExists,
  setCachedBackupExists,
  fetchNwcBackup,
  publishNwcBackup,
  getConnectedNwcUri,
  markBackupDeclined,
  signerSupportsNip44,
} from '@/lib/nostr/nwc-backup';

/**
 * StableKraft's own wallet picker, replacing the @getalby/bitcoin-connect modal.
 *
 * Why: bitcoin-connect's modal lists ~10 wallet tiles, but every tile except the
 * browser extension resolves to the SAME NWCConnector — they are setup instructions
 * for pasting an NWC string, not distinct connection methods. Worse, it offers
 * wallets whose NWC relay can't do keysend (Primal), so users pick one and then
 * their boosts fail.
 *
 * This is a UI-only replacement. It drives the same library connectors
 * (`connect()` / `connectNWC()`), which persist to localStorage['bc:config'] and
 * fire the same `onConnected` event BitcoinConnectProvider already listens for.
 * The WebLNProvider that reaches sendKeysend/sendPayment is unchanged.
 */

type View = 'picker' | 'nwc' | 'offer-backup';

// bitcoin-connect's connect functions swallow their own errors — they log, reset
// state, and never reject (the public `connect` is even typed `=> void`). So a
// failed connection is only observable as "onConnected never fired". This is how
// long we wait before calling it a failure. NWC connects go out over a relay, so
// it needs to be generous.
const CONNECT_TIMEOUT_MS = 30_000;

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Open straight into the save offer instead of the picker. Used by the
   * post-login prompt, when the user signs in with a wallet already connected.
   */
  initialView?: View;
}

export function WalletConnectModal({ isOpen, onClose, initialView = 'picker' }: WalletConnectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>('picker');
  const [hasExtension, setHasExtension] = useState(false);
  const [nwcUri, setNwcUri] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Nostr-backup state
  const { user, isAuthenticated } = useNostr();
  const pubkey = user?.nostrPubkey || null;
  const [canBackup, setCanBackup] = useState(false);
  const [backupFound, setBackupFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Re-detect on every open: an extension can be installed mid-session, and this
  // has to run client-side anyway (window.webln doesn't exist during SSR).
  useEffect(() => {
    if (!isOpen) return;
    setHasExtension(typeof window !== 'undefined' && !!(window as any).webln);
    setView(initialView);
    setError(null);
    setIsConnecting(false);
    setIsSaving(false);
    setIsRestoring(false);
  }, [isOpen, initialView]);

  // Can this session encrypt at all? NIP-55 and read-only nip05 sessions can't,
  // and not every extension implements window.nostr.nip44 — so ask the signer
  // rather than assuming, and hide the feature when the answer is no.
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !pubkey) {
      setCanBackup(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supported = await signerSupportsNip44();
      if (!cancelled) setCanBackup(supported);
    })();
    return () => { cancelled = true; };
  }, [isOpen, isAuthenticated, pubkey]);

  // Look for an existing backup so the picker can offer to restore it. This is a
  // plain relay query — no signer, no decrypt — so it can run speculatively
  // without firing an approval prompt on the user's phone. Decryption happens
  // only if they tap Connect.
  useEffect(() => {
    if (!isOpen || view !== 'picker' || !canBackup || !pubkey) return;
    const cached = getCachedBackupExists(pubkey);
    if (cached !== undefined) {
      setBackupFound(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const status = await checkBackupExists(pubkey);
        // Only offer to restore on a definite 'saved'. An 'unknown' (relays
        // unreachable) must not render a row that would then fail to decrypt.
        if (!cancelled) setBackupFound(status === 'saved');
      } catch {
        if (!cancelled) setBackupFound(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, view, canBackup, pubkey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConnecting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isConnecting, onClose]);

  /**
   * Resolves true once a provider actually lands, false on timeout.
   *
   * `onConnected` fires SYNCHRONOUSLY at subscribe time if a provider is already
   * available. That would report success for a connection attempt that hasn't
   * happened yet, any time this modal is opened while a wallet is still
   * connected. The `ignoreImmediate` flag drops that synchronous fire and only
   * accepts a later one.
   */
  const waitForConnection = useCallback(async (): Promise<boolean> => {
    const { onConnected } = await import('@getalby/bitcoin-connect');
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let ignoreImmediate = true;
      let unsubscribe: (() => void) | undefined;

      const finish = (connected: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          unsubscribe?.();
        } catch {
          // no-op — unsubscribing a already-torn-down listener is harmless
        }
        resolve(connected);
      };

      const timer = setTimeout(() => finish(false), CONNECT_TIMEOUT_MS);

      unsubscribe = onConnected(() => {
        if (ignoreImmediate) return;
        finish(true);
      });
      ignoreImmediate = false;
    });
  }, []);

  const handleExtensionConnect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const { connect } = await import('@getalby/bitcoin-connect');
      const connected = waitForConnection();
      connect({ connectorName: 'Browser Extension', connectorType: 'extension.generic' });
      if (await connected) {
        onClose();
      } else {
        setError('Could not enable your extension. Unlock it and try again.');
      }
    } catch (err) {
      console.error('Extension connect failed:', err);
      setError('Could not enable your extension. Unlock it and try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [onClose, waitForConnection]);

  const handleNwcConnect = useCallback(async () => {
    const uri = nwcUri.trim();
    setError(null);

    if (!uri.startsWith('nostr+walletconnect://') && !uri.startsWith('nostrwalletconnect://')) {
      setError('That doesn’t look like an NWC connection string. It should start with nostr+walletconnect://');
      return;
    }

    setIsConnecting(true);
    try {
      const { connectNWC } = await import('@getalby/bitcoin-connect');
      const connected = waitForConnection();
      connectNWC(uri);
      if (await connected) {
        setNwcUri('');
        // They just typed a connection string in. If it can be backed up, ask —
        // this is the moment it makes sense, not buried in a settings screen.
        if (canBackup && pubkey) {
          setView('offer-backup');
        } else {
          onClose();
        }
      } else {
        // Keep the pasted text — these strings are far too long to re-paste on a phone.
        setError('Couldn’t connect. Check the connection string and try again.');
      }
    } catch (err) {
      console.error('NWC connect failed:', err);
      setError('Couldn’t connect. Check the connection string and try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [nwcUri, onClose, waitForConnection]);

  /** Save the currently connected NWC string to Nostr, encrypted to the user. */
  const handleSaveBackup = useCallback(async () => {
    if (!pubkey) return;
    // Read from bc:config rather than component state: it's the source of truth
    // for what's actually connected, and covers the post-login entry point where
    // this modal never saw the string typed.
    const uri = getConnectedNwcUri();
    if (!uri) {
      setError('No NWC wallet is connected, so there is nothing to save.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      // publishNwcBackup updates the shared existence cache itself, so the
      // account menu's status row reflects this without another relay query.
      await publishNwcBackup(pubkey, uri);
      onClose();
    } catch (err) {
      console.error('NWC backup failed:', err);
      setError(err instanceof Error ? err.message : 'Could not save the backup. Try again.');
    } finally {
      setIsSaving(false);
    }
  }, [pubkey, onClose]);

  const handleDeclineBackup = useCallback(() => {
    // Remember the refusal so signing in again doesn't ask the same question.
    if (pubkey) markBackupDeclined(pubkey);
    onClose();
  }, [pubkey, onClose]);

  /** Decrypt the saved string and connect it. First and only signer prompt. */
  const handleRestoreBackup = useCallback(async () => {
    if (!pubkey) return;
    setError(null);
    setIsRestoring(true);
    try {
      const uri = await fetchNwcBackup(pubkey);
      if (!uri) {
        setError('Could not read your saved wallet. It may have been removed.');
        setCachedBackupExists(pubkey, false);
        setBackupFound(false);
        return;
      }
      const { connectNWC } = await import('@getalby/bitcoin-connect');
      const connected = waitForConnection();
      connectNWC(uri);
      if (await connected) {
        // Came from the backup, so there's nothing new to offer saving.
        onClose();
      } else {
        setError('Your saved wallet could not connect. It may have been revoked.');
      }
    } catch (err) {
      console.error('NWC restore failed:', err);
      setError(err instanceof Error ? err.message : 'Could not restore your saved wallet.');
    } finally {
      setIsRestoring(false);
    }
  }, [pubkey, onClose, waitForConnection]);

  // The connection string arrives from another app and is far too long to type,
  // so on mobile this button is the realistic path in.
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNwcUri(text.trim());
        setError(null);
      }
    } catch {
      // Permission denied or no clipboard access — the field still accepts a manual paste.
    }
  }, []);

  if (!mounted || !isOpen) return null;

  /**
   * Touch devices only.
   *
   * navigator.clipboard.readText() reads the clipboard programmatically, so
   * browsers demand a separate confirmation — Firefox and Safari pop their own
   * little "Paste" button, Chrome asks for permission. That makes the control
   * TWO clicks on a desktop, where ⌘V into the field is one keystroke: strictly
   * worse than not having it. On a phone it's the opposite, since the
   * alternative is long-press → tap → Paste and the string is far too long to
   * type. `pointer: coarse` asks about the input device rather than sniffing
   * the user agent.
   */
  const canPaste =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.readText === 'function' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches === true;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
      style={{
        // Must clear the notch and the Android nav bar. Always var(--sk-safe-*),
        // never bare env(safe-area-inset-*) — Chromium doesn't reliably report
        // system-bar insets through env() in the Capacitor WebView.
        paddingTop: 'calc(var(--sk-safe-top) + 16px)',
        paddingBottom: 'calc(var(--sk-safe-bottom) + 16px)',
        zIndex: 2147483647,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) onClose();
      }}
    >
      <div
        className="bg-gray-950 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Connect a Lightning wallet"
      >
        <div className="flex justify-between items-start mb-1 gap-3">
          <h2 className="text-xl font-bold text-white">
            {view === 'picker'
              ? 'Connect a wallet'
              : view === 'nwc'
                ? 'Nostr Wallet Connect'
                : 'Save this wallet to Nostr?'}
          </h2>
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-40 flex items-center justify-center flex-shrink-0"
            // px, not rem — Android's font-size setting scales rem units, which
            // would inflate controls along with the text.
            style={{ width: 44, height: 44, marginTop: -10, marginRight: -10 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {view === 'picker' && (
          <p className="text-sm text-gray-400 mb-4">Pick one to send Lightning payments.</p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {view === 'picker' && (
          <div className="grid grid-cols-1 gap-2">
            {/* Restore row. Only rendered once a relay query confirmed a backup
                exists; tapping it is what triggers the decrypt. */}
            {backupFound && (
              <button
                onClick={handleRestoreBackup}
                disabled={isConnecting || isRestoring}
                className="w-full text-left p-4 rounded-lg bg-stablekraft-teal/10 border border-stablekraft-teal/50 hover:border-stablekraft-teal hover:bg-stablekraft-teal/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center gap-3"
                style={{ minHeight: 64 }}
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-lg bg-stablekraft-teal/20 transition-colors"
                  style={{ width: 40, height: 40 }}
                  aria-hidden
                >
                  <RotateCcw size={20} className="text-stablekraft-teal" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white leading-tight">
                    {isRestoring ? 'Restoring…' : 'Saved wallet'}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Connect the wallet you backed up to Nostr.
                  </p>
                </div>
              </button>
            )}

            {hasExtension && (
              <button
                onClick={handleExtensionConnect}
                disabled={isConnecting}
                className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center gap-3"
                style={{ minHeight: 64 }}
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors"
                  style={{ width: 40, height: 40 }}
                  aria-hidden
                >
                  <Puzzle size={20} className="text-blue-300" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white leading-tight">
                    {isConnecting ? 'Connecting…' : 'Browser Extension'}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Alby or another WebLN extension · tap to enable.
                  </p>
                </div>
              </button>
            )}

            <button
              onClick={() => {
                setError(null);
                setView('nwc');
              }}
              disabled={isConnecting}
              className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 group flex items-center gap-3"
              style={{ minHeight: 64 }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-lg bg-yellow-500/20 group-hover:bg-yellow-500/30 transition-colors"
                style={{ width: 40, height: 40 }}
                aria-hidden
              >
                <Zap size={20} className="text-yellow-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white leading-tight">Nostr Wallet Connect</div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Paste a connection string from Alby Hub, Coinos, and others.
                </p>
              </div>
            </button>
          </div>
        )}

        {view === 'nwc' && (
          <div>
            <button
              onClick={() => {
                setView('picker');
                setError(null);
              }}
              disabled={isConnecting}
              className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1 transition-colors disabled:opacity-40"
              style={{ minHeight: 44 }}
            >
              ← Back
            </button>

            <label
              htmlFor="nwc-uri"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Paste your <code className="text-stablekraft-teal">nostr+walletconnect://</code> string
            </label>
            <textarea
              id="nwc-uri"
              value={nwcUri}
              onChange={(e) => setNwcUri(e.target.value)}
              placeholder="nostr+walletconnect://…"
              disabled={isConnecting}
              rows={3}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-stablekraft-teal focus:border-transparent disabled:opacity-50 font-mono text-xs mb-2 resize-none break-all"
              autoFocus
            />

            {canPaste && (
              <button
                onClick={handlePaste}
                disabled={isConnecting}
                className="mb-3 px-3 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:border-stablekraft-teal hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ minHeight: 44 }}
              >
                <ClipboardPaste size={16} />
                Paste from clipboard
              </button>
            )}

            <button
              onClick={handleNwcConnect}
              disabled={isConnecting || !nwcUri.trim()}
              className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              style={{ minHeight: 48 }}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        )}

        {view === 'offer-backup' && (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-lg bg-stablekraft-teal/20"
                style={{ width: 40, height: 40 }}
                aria-hidden
              >
                <ShieldCheck size={20} className="text-stablekraft-teal" />
              </span>
              <p className="text-sm text-gray-300">
                Encrypted with your Nostr key, so only you can read it. Sign in on another
                device and you can connect this wallet there without pasting it again.
              </p>
            </div>

            {/* Two plain buttons, neither preselected — publishing a spending
                credential should be a decision, not a default. */}
            <button
              onClick={handleSaveBackup}
              disabled={isSaving}
              className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors mb-2"
              style={{ minHeight: 48 }}
            >
              {isSaving ? 'Saving…' : 'Save to Nostr'}
            </button>
            <button
              onClick={handleDeclineBackup}
              disabled={isSaving}
              className="w-full px-4 py-2 text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-500 hover:text-white transition-colors disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default WalletConnectModal;
