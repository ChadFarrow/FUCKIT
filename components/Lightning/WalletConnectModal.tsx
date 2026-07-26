'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Puzzle, Zap, ClipboardPaste } from 'lucide-react';

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

type View = 'picker' | 'nwc';

// bitcoin-connect's connect functions swallow their own errors — they log, reset
// state, and never reject (the public `connect` is even typed `=> void`). So a
// failed connection is only observable as "onConnected never fired". This is how
// long we wait before calling it a failure. NWC connects go out over a relay, so
// it needs to be generous.
const CONNECT_TIMEOUT_MS = 30_000;

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>('picker');
  const [hasExtension, setHasExtension] = useState(false);
  const [nwcUri, setNwcUri] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Re-detect on every open: an extension can be installed mid-session, and this
  // has to run client-side anyway (window.webln doesn't exist during SSR).
  useEffect(() => {
    if (!isOpen) return;
    setHasExtension(typeof window !== 'undefined' && !!(window as any).webln);
    setView('picker');
    setError(null);
    setIsConnecting(false);
  }, [isOpen]);

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
   * happened yet (e.g. "Switch Wallet" from LightningWalletButton, which opens
   * this modal without disconnecting first). The `ignoreImmediate` flag drops
   * that synchronous fire and only accepts a later one.
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
        onClose();
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

  const canPaste =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

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
            {view === 'picker' ? 'Connect a wallet' : 'Nostr Wallet Connect'}
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

            <p className="text-xs text-gray-400 mb-3">
              Boosts are sent with keysend. Alby Hub and Coinos support it — Primal’s NWC does not.
            </p>

            <button
              onClick={handleNwcConnect}
              disabled={isConnecting || !nwcUri.trim()}
              className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              style={{ minHeight: 48 }}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>

            <p className="mt-3 text-xs text-gray-400">
              Get a string from your wallet: Alby Hub → Connections → Add Connection, or Coinos →
              Settings → Nostr Wallet Connect.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default WalletConnectModal;
