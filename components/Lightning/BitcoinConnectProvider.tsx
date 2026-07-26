'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { WebLNProvider } from '@webbtc/webln-types';
import { LIGHTNING_CONFIG } from '@/lib/lightning/config';
import { useNostr } from '@/contexts/NostrContext';
import {
  WalletProviderType,
  WalletInfo,
  detectWalletProviderType,
  inferLightningAddress,
  fetchCoinosProfile,
  fetchCoinosUserByPubkey,
} from '@/lib/lightning/wallet-detection';
import { WalletConnectModal } from './WalletConnectModal';

interface BitcoinConnectContextType {
  isConnected: boolean;
  provider: WebLNProvider | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage?: string; error?: string }>;
  sendKeysend: (
    pubkey: string,
    amount: number,
    message?: string,
    helipadMetadata?: {
      app_name?: string;
      app_version?: string;
      podcast?: string;
      episode?: string;
      ts?: number;
      action?: string;
      url?: string;
      message?: string;
      name?: string;
      value_msat?: number;
      value_msat_total?: number;
      sender_name?: string;
      feed?: string;
      feedId?: string;
      episode_guid?: string;
      remote_item_guid?: string;
      remote_feed_guid?: string;
      album?: string;
      uuid?: string;
    }
  ) => Promise<{ preimage?: string; error?: string }>;
  makeInvoice: (amount: number, memo?: string) => Promise<{ invoice?: string; error?: string }>;
  isLoading: boolean;
  supportsKeysend: boolean;
  /** Open the wallet modal straight on the "save this wallet to Nostr?" step. */
  openBackupOffer: () => void;
  // Enhanced wallet info
  walletInfo: WalletInfo | null;
  balance: number | null;
  isBalanceLoading: boolean;
  refreshBalance: () => Promise<void>;
  walletProviderType: WalletProviderType;
}

const BitcoinConnectContext = createContext<BitcoinConnectContextType | null>(null);

export function BitcoinConnectProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<WebLNProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wallet_manually_disconnected') === 'true';
    }
    return false;
  });
  const { isAuthenticated: isNostrAuthenticated, user: nostrUser } = useNostr();

  // Enhanced wallet info state
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [walletProviderType, setWalletProviderType] = useState<WalletProviderType>('unknown');
  const [keysendSupported, setKeysendSupported] = useState<boolean | null>(null); // null = not probed yet
  const balanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Wallet picker (our own modal, rendered below). connect() opens it and holds
  // the caller's resolver here until it closes.
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalView, setWalletModalView] = useState<'picker' | 'offer-backup'>('picker');
  const walletModalResolveRef = useRef<(() => void) | null>(null);
  const backupOfferCheckedRef = useRef(false);

  useEffect(() => {
    // Initialize Bitcoin Connect on component mount (client-side only)
    // Note: We always initialize Bitcoin Connect even for NIP-46/NIP-55/Amber logins
    // because users may separately connect an NWC wallet for Lightning payments.
    // init() doesn't trigger popups — only requestProvider()/launchModal() do.
    // The WebLN auto-connect for Alby is guarded separately below.
    //
    // Still required even though wallet selection is now our own modal: init()
    // configures persistence, the auto-reconnect from localStorage['bc:config'],
    // and the appName passed to NWC connectors.
    if (typeof window !== 'undefined') {
      import('@getalby/bitcoin-connect').then(({ init, onConnected, onDisconnected }) => {
        init({
          appName: 'StableKraft',
          showBalance: true,
        });

        // Listen for connection events
        onConnected((provider) => {
          console.log('✅ Bitcoin Connect: onConnected event', provider);
          setProvider(provider);
          setIsConnected(true);
          setIsLoading(false);
          console.log('✅ State updated: isConnected = true');
        });

        onDisconnected(() => {
          console.log('🔌 Bitcoin Connect: onDisconnected event');
          setProvider(null);
          setIsConnected(false);
        });

        // Handle wallet restoration after Nostr login (Android fix)
        // Check if we should restore wallet connection after page reload from Nostr login
        const shouldRestoreWallet = localStorage.getItem('wallet_restore_after_login') === 'true';
        if (shouldRestoreWallet) {
          console.log('🔄 Wallet flagged for restoration after Nostr login');
          // Clear the restore flag
          localStorage.removeItem('wallet_restore_after_login');
          // Clear manual disconnect flag to allow Bitcoin Connect to auto-reconnect
          localStorage.setItem('wallet_manually_disconnected', 'false');
          setManuallyDisconnected(false);

          // Force wallet reconnection after Nostr login by calling requestProvider.
          //
          // requestProvider() LAUNCHES THE BITCOIN CONNECT MODAL when no provider
          // is available, so it must only be called when a saved connection
          // actually exists — otherwise logging in with Nostr pops up the very
          // modal we replaced.
          //
          // The check reads localStorage['bc:config'] rather than
          // getConnectorConfig(): the library kicks off its own reconnect from
          // that key at module-load time, so the in-memory connectorConfig is
          // still undefined while that attempt is in flight. localStorage is the
          // durable signal for "this user had a wallet".
          import('@getalby/bitcoin-connect').then(async ({ requestProvider }) => {
            try {
              if (!localStorage.getItem('bc:config')) {
                console.log('ℹ️ No saved wallet config — skipping restore (would open the wallet modal)');
                return; // the finally below still clears isLoading
              }
              console.log('🔍 Restoring wallet connection after Nostr login...');
              const restoredProvider = await requestProvider();
              if (restoredProvider) {
                console.log('✅ Wallet successfully restored after Nostr login');
                setProvider(restoredProvider);
                setIsConnected(true);
              }
            } catch (err) {
              console.warn('⚠️ Failed to restore wallet after Nostr login:', err);
            } finally {
              setIsLoading(false);
            }
          });
        } else {
          // Normal page load: Don't call requestProvider to avoid unwanted popups
          // Bitcoin Connect will automatically reconnect via onConnected event if:
          // 1. A saved connection exists in localStorage
          // 2. The connection is still valid
          console.log('ℹ️ Bitcoin Connect initialized. Will auto-reconnect via onConnected event if saved connection exists.');
          setIsLoading(false);
        }
      }).catch((error) => {
        console.error('Failed to load Bitcoin Connect:', error);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    // No `bc-modal` CSS shim here any more: wallet selection is now our own
    // WalletConnectModal, and nothing in the app renders bitcoin-connect's web
    // components. The library is still used for the connectors themselves.
  }, []);

  // Auto-connect WebLN when Nostr user is authenticated (Alby extension)
  // This will override any existing wallet connection to use the same Alby wallet for Lightning
  // Skip auto-connect for NIP-05 and NIP-46 logins (they don't use Alby extension)
  useEffect(() => {
    // Skip if user logged in with NIP-05 (read-only mode, no extension)
    const isNip05Login = nostrUser?.loginType === 'nip05';
    if (isNip05Login) {
      return;
    }

    // Skip if user logged in with NIP-46 (Amber) - they're not using Alby extension
    const isNip46Login = nostrUser?.loginType === 'nip46';
    if (isNip46Login) {
      return;
    }

    // Only auto-connect if user logged in with extension (NIP-07/Alby)
    const isExtensionLogin = nostrUser?.loginType === 'extension';
    if (!isExtensionLogin) {
      return;
    }

    // If Nostr user is authenticated with extension, detect WebLN (same wallet as Nostr)
    // Don't auto-enable to prevent popup - wait for user to click wallet button
    // ONLY auto-connect if user hasn't manually disconnected
    const wasManuallyDisconnected = typeof window !== 'undefined'
      ? localStorage.getItem('wallet_manually_disconnected') === 'true'
      : false;

    if (isNostrAuthenticated && typeof window !== 'undefined' && !wasManuallyDisconnected) {
      // Check if WebLN is available (Alby extension provides both Nostr and WebLN)
      if ((window as any).webln) {
        const weblnProvider = (window as any).webln;

        // Only auto-connect if NO wallet is connected yet
        // If user already connected via Bitcoin Connect (including NWC), respect that choice
        if (!provider && !isConnected) {
          // Just set the provider, don't enable yet - enable will happen when user clicks
          setProvider(weblnProvider);
          setIsConnected(true);
          setIsLoading(false);
        }
      }
    }
  }, [isNostrAuthenticated, provider, nostrUser]);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (currentProvider: WebLNProvider): Promise<number | null> => {
    try {
      // Check if getBalance method exists
      if (!currentProvider.getBalance) {
        console.log('ℹ️ Wallet does not support getBalance');
        return null;
      }

      // Ensure provider is enabled before calling getBalance
      if (currentProvider.enable && typeof currentProvider.enable === 'function') {
        try {
          await currentProvider.enable();
        } catch (enableError) {
          // Provider not enabled - silently skip balance fetch
          return null;
        }
      }

      setIsBalanceLoading(true);
      const response = await currentProvider.getBalance();
      return response.balance;
    } catch (error) {
      console.warn('Failed to fetch balance:', error);
      return null;
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  // Refresh balance function exposed to context
  const refreshBalance = useCallback(async () => {
    if (!provider) return;
    const newBalance = await fetchBalance(provider);
    if (newBalance !== null) {
      setBalance(newBalance);
    }
  }, [provider, fetchBalance]);

  // Fetch wallet info when provider changes
  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!provider || !isConnected) {
        setWalletInfo(null);
        setBalance(null);
        setWalletProviderType('unknown');
        setKeysendSupported(null);
        return;
      }

      try {
        // Detect wallet provider type
        const { type, name, nwcPubkey } = await detectWalletProviderType();
        setWalletProviderType(type);

        const hasKeysendMethod = !!provider.keysend;
        const fallbackTypeAllowsKeysend =
          type === 'alby' || type === 'alby-hub' || type === 'extension' || type === 'coinos';

        // Phase 1: eager synchronous keysend answer before getInfo()'s relay round-trip.
        // Closes the race where the boost modal opens during the 1–5s NWC get_info window
        // and the UI banner + lnaddress keysend-fallback gate see keysendSupported === null
        // even though provider.keysend is already live. Primal (type 'nwc') stays false here
        // and gets further confirmed false by the methods-array check below.
        setKeysendSupported(hasKeysendMethod && fallbackTypeAllowsKeysend);

        // Try to get wallet info via getInfo()
        let alias = '';
        let pubkey = '';
        let advertisedMethods: string[] = [];

        try {
          if (provider.getInfo) {
            // Ensure provider is enabled before calling getInfo
            if (provider.enable && typeof provider.enable === 'function') {
              await provider.enable();
            }
            const info = await provider.getInfo();
            alias = info.node?.alias || '';
            pubkey = info.node?.pubkey || '';
            advertisedMethods = Array.isArray(info.methods) ? info.methods.map(String) : [];
          }
        } catch (infoError) {
          // Silently handle enable/getInfo failures - wallet may not be unlocked yet
          console.log('ℹ️ Could not get wallet info (wallet may need to be unlocked)');
        }

        // Infer Lightning Address based on provider type and alias
        const lightningAddress = inferLightningAddress(alias, type);

        // Check capabilities - ensure provider is enabled first
        // Some providers (like Alby extension) only expose methods after enable()
        try {
          if (provider.enable && typeof provider.enable === 'function') {
            await provider.enable();
          }
        } catch (enableError) {
          // Continue anyway - some providers don't need enable
          console.log('ℹ️ Provider enable failed or not needed');
        }

        const supportsBalance = !!provider.getBalance;

        // Phase 2: combine both signals. Either a wallet's own capability advertisement
        // (WebLN GetInfoResponse.methods — NWC uses 'pay_keysend'/'multi_pay_keysend',
        // extensions use 'keysend') OR the conservative type whitelist is enough to allow
        // keysend. Using OR instead of "methods overrides" avoids a false negative when a
        // known-good wallet's methods array is partial/stale (the original methods-first
        // version in 2a927a60 flipped Alby Hub users to unsupported when get_info omitted
        // pay_keysend). Primal stays rejected because both signals fail for it (type is
        // 'nwc', not in whitelist, and its methods array lacks pay_keysend).
        const methodsAdvertiseKeysend =
          advertisedMethods.includes('pay_keysend') ||
          advertisedMethods.includes('multi_pay_keysend') ||
          advertisedMethods.includes('keysend');
        const keysendActuallySupported =
          hasKeysendMethod && (methodsAdvertiseKeysend || fallbackTypeAllowsKeysend);
        console.log('🔌 Wallet capabilities:', {
          providerType: type,
          hasKeysendMethod,
          advertisedMethods,
          methodsAdvertiseKeysend,
          keysendActuallySupported,
        });
        setKeysendSupported(keysendActuallySupported);

        // Fetch Coinos profile for avatar and username
        let avatarUrl: string | undefined;
        let username: string | undefined;

        if (type === 'coinos') {
          // First try to auto-lookup by NWC pubkey (no user input needed!)
          if (nwcPubkey) {
            const profile = await fetchCoinosUserByPubkey(nwcPubkey);
            if (profile) {
              avatarUrl = profile.avatarUrl;
              username = profile.username;
              // Save to localStorage so WalletInfoDisplay can use it
              if (username && typeof window !== 'undefined') {
                localStorage.setItem('coinos_username', username);
              }
            }
          }

          // Fallback to alias-based lookup if pubkey lookup failed
          if (!username && alias && alias !== 'ln.coinos.io') {
            const profile = await fetchCoinosProfile(alias);
            if (profile) {
              avatarUrl = profile.avatarUrl;
              username = profile.username;
            }
          }
        }

        setWalletInfo({
          alias,
          pubkey,
          lightningAddress,
          providerType: type,
          providerName: name,
          supportsBalance,
          supportsKeysend: keysendActuallySupported,
          avatarUrl,
          username,
        });

        console.log('📋 Wallet info fetched:', {
          providerType: type,
          providerName: name,
          alias,
          lightningAddress,
          supportsBalance,
        });

        // Fetch initial balance
        if (supportsBalance) {
          const initialBalance = await fetchBalance(provider);
          if (initialBalance !== null) {
            setBalance(initialBalance);
          }
        }
      } catch (error) {
        console.error('Failed to fetch wallet info:', error);
      }
    };

    fetchWalletInfo();
  }, [provider, isConnected, fetchBalance]);

  // Set up balance polling interval (every 60 seconds)
  useEffect(() => {
    // Clear any existing interval
    if (balanceIntervalRef.current) {
      clearInterval(balanceIntervalRef.current);
      balanceIntervalRef.current = null;
    }

    // Only set up polling if connected and wallet supports balance
    if (!isConnected || !provider || !provider.getBalance) {
      return;
    }

    // Poll balance every 60 seconds
    balanceIntervalRef.current = setInterval(async () => {
      const newBalance = await fetchBalance(provider);
      if (newBalance !== null) {
        setBalance(newBalance);
      }
    }, 60000);

    return () => {
      if (balanceIntervalRef.current) {
        clearInterval(balanceIntervalRef.current);
        balanceIntervalRef.current = null;
      }
    };
  }, [isConnected, provider, fetchBalance]);

  // Clear wallet info on disconnect
  useEffect(() => {
    if (!isConnected) {
      setWalletInfo(null);
      setBalance(null);
      setWalletProviderType('unknown');
      setKeysendSupported(null);
    }
  }, [isConnected]);

  /**
   * Opens StableKraft's own wallet picker (WalletConnectModal), which drives the
   * bitcoin-connect connectors directly. Connection state still arrives through
   * the onConnected subscription set up above — this function only owns the view.
   *
   * Resolves when the modal closes, which is the same fire-and-forget contract
   * callers already had: the old implementation awaited launchModal(), which
   * returns void and never waited for a connection either.
   */
  const connect = async (): Promise<void> => {
    // Clear manual disconnect flag when user explicitly connects
    setManuallyDisconnected(false);
    localStorage.setItem('wallet_manually_disconnected', 'false');

    // A second call while the picker is already open just re-uses it, and must not
    // strand the first caller's promise.
    if (walletModalResolveRef.current) {
      walletModalResolveRef.current();
      walletModalResolveRef.current = null;
    }

    setWalletModalView('picker');
    setIsWalletModalOpen(true);

    return new Promise<void>((resolve) => {
      walletModalResolveRef.current = resolve;
    });
  };

  /**
   * Open the modal on the backup offer directly. The account menu uses this so
   * an already-connected, already-signed-in user can reach the feature — they
   * have no other trigger, since the offer otherwise fires only on a fresh NWC
   * paste or a fresh login.
   */
  const openBackupOffer = useCallback(() => {
    setWalletModalView('offer-backup');
    setIsWalletModalOpen(true);
  }, []);

  const closeWalletModal = useCallback(() => {
    setIsWalletModalOpen(false);
    setWalletModalView('picker');
    walletModalResolveRef.current?.();
    walletModalResolveRef.current = null;
  }, []);

  /**
   * Post-login "back up your wallet?" offer.
   *
   * A user can connect a wallet while signed out (boosting works without Nostr —
   * auth only gates posting the boost note), so the offer can't live only at
   * connect time. Login flows drop a flag before their reload; this picks it up
   * and applies the real conditions, so the feature isn't left to be discovered.
   *
   * Every one of these gates matters:
   *   - an NWC wallet is connected  → extension connections have no string to save
   *   - the signer can encrypt      → NIP-55 and read-only nip05 cannot
   *   - the user hasn't declined    → otherwise it asks on every single login
   *   - no backup exists already    → relay query, no signer prompt
   */
  useEffect(() => {
    if (backupOfferCheckedRef.current) return;
    if (typeof window === 'undefined') return;
    if (!isNostrAuthenticated || !nostrUser?.nostrPubkey) return;

    backupOfferCheckedRef.current = true;
    const pubkey = nostrUser.nostrPubkey;
    let cancelled = false;

    (async () => {
      try {
        const { PENDING_NWC_BACKUP_OFFER_KEY } = await import('@/lib/nostr/auth-utils');
        const pending = localStorage.getItem(PENDING_NWC_BACKUP_OFFER_KEY);
        if (!pending || pending !== pubkey) return;
        localStorage.removeItem(PENDING_NWC_BACKUP_OFFER_KEY);

        const { getConnectedNwcUri, hasDeclinedBackup, hasNwcBackup } = await import(
          '@/lib/nostr/nwc-backup'
        );
        if (!getConnectedNwcUri()) return;
        if (hasDeclinedBackup(pubkey)) return;

        const { getUnifiedSigner } = await import('@/lib/nostr/signer');
        const signer = getUnifiedSigner();
        await signer.ensureInitialized();
        if (!signer.supportsNip44()) return;

        if (await hasNwcBackup(pubkey)) return;
        if (cancelled) return;

        setWalletModalView('offer-backup');
        setIsWalletModalOpen(true);
      } catch (err) {
        // Never let this surface — it's an optional nicety on top of login.
        console.warn('⚠️ NWC backup offer check failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNostrAuthenticated, nostrUser?.nostrPubkey]);

  /**
   * Disconnecting does NOT remove the Nostr backup — deliberately.
   *
   * It used to. That made restore impossible: with a wallet connected, the menu
   * offers Switch / Disconnect / NWC Backup and no "Connect", so the only route
   * to the picker (where the "Saved wallet" restore row lives) is Disconnect —
   * or Switch Wallet, which disconnects first. Both tombstoned the backup on the
   * way, so it was always destroyed before it could ever be restored from, on
   * every device rather than just across devices.
   *
   * Removal now lives solely on the account menu's "NWC Backup" row, which shows
   * "Saved" and removes on click. That's an explicit action with a visible state,
   * which is what deleting a spending credential should require.
   */
  const disconnectWallet = async () => {
    try {
      console.log('🔌 Disconnecting wallet...');
      const bitcoinConnect = await import('@getalby/bitcoin-connect');

      // Mark as manually disconnected to prevent auto-reconnect
      setManuallyDisconnected(true);
      localStorage.setItem('wallet_manually_disconnected', 'true');

      // Call disconnect - Bitcoin Connect will handle its own localStorage
      await bitcoinConnect.disconnect();

      // Force state updates immediately
      setProvider(null);
      setIsConnected(false);

      console.log('✅ Wallet disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      // Force disconnect even if there's an error
      setManuallyDisconnected(true);
      localStorage.setItem('wallet_manually_disconnected', 'true');

      setProvider(null);
      setIsConnected(false);
      throw error;
    }
  };

  const sendPayment = async (invoice: string, retryCount = 0): Promise<{ preimage?: string; error?: string }> => {
    try {
      let currentProvider = provider;

      if (!currentProvider) {
        await connect();
        currentProvider = provider;
        if (!currentProvider) {
          return { error: 'No wallet connected - please connect your Lightning wallet' };
        }
      }

      // Ensure provider is enabled before using it
      if (currentProvider.enable && typeof currentProvider.enable === 'function') {
        try {
          await currentProvider.enable();
        } catch (enableError) {
          return { error: 'Wallet must be unlocked - please check your Lightning wallet' };
        }
      }

      const result = await currentProvider.sendPayment(invoice);
      return { preimage: result.preimage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';

      // Parse common Lightning errors and provide helpful feedback
      if (errorMessage.includes('FAILURE_REASON_NO_ROUTE') || errorMessage.includes('no route')) {
        // Retry once for routing failures (routes can be temporarily unavailable)
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendPayment(invoice, retryCount + 1);
        }
        return {
          error: 'Cannot find payment route to recipient - they may be offline or unreachable via Lightning Network'
        };
      } else if (errorMessage.includes('FAILURE_REASON_INSUFFICIENT_BALANCE') || errorMessage.includes('insufficient')) {
        return { error: 'Insufficient balance in your Lightning wallet' };
      } else if (errorMessage.includes('FAILURE_REASON_TIMEOUT') || errorMessage.includes('timeout')) {
        if (retryCount < 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendPayment(invoice, retryCount + 1);
        }
        return { error: 'Payment timed out - the recipient may be experiencing issues' };
      } else if (errorMessage.includes('FAILURE_REASON_INVOICE_EXPIRED') || errorMessage.includes('expired')) {
        return { error: 'Invoice has expired - please request a new invoice' };
      } else if (errorMessage.includes('user rejected') || errorMessage.includes('user cancelled')) {
        return { error: 'Payment cancelled by user' };
      }

      return { error: errorMessage };
    }
  };

  const sendKeysend = async (
    pubkey: string,
    amount: number,
    message?: string,
    helipadMetadata?: {
      app_name?: string;
      app_version?: string;
      podcast?: string;
      episode?: string;
      ts?: number;
      action?: string;
      url?: string;
      message?: string;
      name?: string;
      value_msat?: number;
      value_msat_total?: number;
      sender_name?: string;
      feed?: string;
      feedId?: string;
      episode_guid?: string;
      remote_item_guid?: string;
      remote_feed_guid?: string;
      album?: string;
      uuid?: string;
    },
    retryCount = 0
  ): Promise<{ preimage?: string; error?: string }> => {
    try {
      let currentProvider = provider;

      if (!currentProvider) {
        await connect();
        currentProvider = provider;
        if (!currentProvider) {
          return { error: 'No wallet connected - please connect your Lightning wallet' };
        }
      }

      const customRecords: Record<string, string> = {};

      // Extract routing custom records from helipadMetadata before building the Helipad JSON.
      // These records (e.g. Alby's account-routing TLV) must appear as individual TLV entries
      // in the WebLN keysend payload so the receiving node knows which account to credit.
      // Embedding them inside the Helipad JSON blob (TLV 7629169) is not enough — the node
      // inspects raw TLV records, not the JSON payload.
      const { customRecords: routingCustomRecords, ...helipadMetadataWithoutRouting } =
        (helipadMetadata as any) || {};
      if (routingCustomRecords && typeof routingCustomRecords === 'object') {
        for (const [key, value] of Object.entries(routingCustomRecords as Record<string, string>)) {
          if (key && value != null) customRecords[key] = String(value);
        }
      }

      // Add boostagram message if provided
      if (message) {
        // TLV record 34349334 is used for boostagram messages
        // WebLN provider handles encoding - pass plain string
        customRecords['34349334'] = message;
      }

      // Add Helipad metadata if provided (routing customRecords excluded — already added above)
      if (helipadMetadata) {
        try {
          // Clean the metadata object to remove any undefined/null values that could cause issues
          const cleanMetadata = Object.fromEntries(
            Object.entries(helipadMetadataWithoutRouting).filter(([_, value]) => value !== undefined && value !== null)
          );

          // TLV record 7629169 is used for Helipad/Podcast 2.0 metadata (JSON)
          // WebLN provider handles encoding - pass plain JSON string
          customRecords['7629169'] = JSON.stringify(cleanMetadata);
        } catch (jsonError) {
          // Continue without Helipad metadata if JSON fails
        }
      }

      // Ensure provider is enabled before using it
      if (currentProvider.enable && typeof currentProvider.enable === 'function') {
        try {
          await currentProvider.enable();
        } catch (enableError) {
          // Check if Alby extension is being used by Nostr at the same time
          const loginType = typeof window !== 'undefined' ? localStorage.getItem('nostr_login_type') : null;
          if (loginType === 'extension') {
            return { error: 'Wallet locked - if using Alby for both Nostr and Lightning, try closing any Nostr popups first' };
          }
          return { error: 'Wallet must be unlocked - please check your Lightning wallet' };
        }
      }

      if (!currentProvider.keysend) {
        return { error: 'Keysend is not supported by your wallet. Try Alby or Coinos via NWC.' };
      }

      const keysendPayload = {
        destination: pubkey,
        amount: amount.toString(),
        customRecords,
      };

      console.log('🔑 Sending keysend:', { destination: pubkey.slice(0, 20) + '...', amount, hasCustomRecords: Object.keys(customRecords).length > 0 });
      const result = await currentProvider.keysend(keysendPayload);
      console.log('✅ Keysend succeeded:', { preimage: result.preimage?.slice(0, 20) + '...' });
      return { preimage: result.preimage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Keysend failed';

      // Parse common Lightning errors and provide helpful feedback
      if (errorMessage.includes('FAILURE_REASON_NO_ROUTE') || errorMessage.includes('no route')) {
        // Retry for routing failures (routes can be temporarily unavailable)
        if (retryCount < 2) {
          // Only log on first attempt, not retries
          if (retryCount === 0) {
            console.log('⚠️ Keysend: no route found, retrying...');
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendKeysend(pubkey, amount, message, helipadMetadata, retryCount + 1);
        }
        // Final failure after retries
        return {
          error: 'Cannot find payment route to recipient - they may be offline or unreachable via Lightning Network'
        };
      } else if (errorMessage.includes('FAILURE_REASON_INSUFFICIENT_BALANCE') || errorMessage.includes('insufficient')) {
        return { error: 'Insufficient balance in your Lightning wallet' };
      } else if (errorMessage.includes('FAILURE_REASON_TIMEOUT') || errorMessage.includes('timeout')) {
        if (retryCount < 1) {
          console.log('⚠️ Keysend: timeout, retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendKeysend(pubkey, amount, message, helipadMetadata, retryCount + 1);
        }
        return { error: 'Payment timed out - the recipient may be experiencing issues' };
      } else if (errorMessage.includes('user rejected') || errorMessage.includes('user cancelled')) {
        return { error: 'Payment cancelled by user' };
      } else if (errorMessage.includes('command not implemented') || errorMessage.includes('not implemented yet')) {
        // Runtime self-correction: disable keysend so we don't keep retrying
        console.log('⚠️ Keysend not implemented by wallet relay, disabling keysend support');
        setKeysendSupported(false);
        return {
          error: 'Your wallet doesn\'t support keysend payments. This artist only accepts keysend. Try Alby or Coinos.'
        };
      } else if (errorMessage === 'Keysend payment failed' || errorMessage.includes('Keysend payment failed')) {
        // Generic keysend failure from Coinos or other custodial wallets
        // Retry up to 3 times with increasing delays to give the wallet time to process
        // Coinos in particular benefits from longer delays between retries
        if (retryCount < 3) {
          const retryDelay = 4000 + (retryCount * 2000); // 4s, 6s, 8s
          console.log(`⚠️ Generic keysend failure, retrying in ${retryDelay/1000}s (attempt ${retryCount + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return sendKeysend(pubkey, amount, message, helipadMetadata, retryCount + 1);
        }
        return { error: 'Keysend payment failed - the wallet may be busy or recipient unreachable' };
      }

      return { error: errorMessage };
    }
  };

  const makeInvoice = async (
    amount: number,
    memo?: string
  ): Promise<{ invoice?: string; error?: string }> => {
    try {
      let currentProvider = provider;

      if (!currentProvider) {
        await connect();
        currentProvider = provider;
        if (!currentProvider) {
          return { error: 'No wallet connected - please connect your Lightning wallet' };
        }
      }

      // Ensure provider is enabled before using it
      if (currentProvider.enable && typeof currentProvider.enable === 'function') {
        try {
          await currentProvider.enable();
        } catch (enableError) {
          return { error: 'Wallet must be unlocked - please check your Lightning wallet' };
        }
      }

      if (!currentProvider.makeInvoice) {
        return { error: 'Your wallet does not support creating invoices' };
      }

      const result = await currentProvider.makeInvoice({
        amount,
        defaultMemo: memo || 'StableKraft deposit',
      });

      return { invoice: result.paymentRequest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create invoice';
      return { error: errorMessage };
    }
  };

  // Check if connected wallet supports keysend (direct node-to-node payments)
  // Use probed result if available. If not probed yet (null), assume false to avoid failed attempts
  // This prevents keysend attempts before the probe completes
  const supportsKeysend = keysendSupported === true;

  return (
    <BitcoinConnectContext.Provider
      value={{
        isConnected,
        provider,
        connect,
        disconnect: disconnectWallet,
        sendPayment,
        sendKeysend,
        makeInvoice,
        isLoading,
        supportsKeysend,
        openBackupOffer,
        // Enhanced wallet info
        walletInfo,
        balance,
        isBalanceLoading,
        refreshBalance,
        walletProviderType,
      }}
    >
      {children}
      {/* Rendered here so every connect() entry point — UserMenu on both
          breakpoints, LightningWalletButton, BoostButton — shares one picker.
          This provider wraps the whole app via layout.tsx → LightningWrapper. */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={closeWalletModal}
        initialView={walletModalView}
      />
    </BitcoinConnectContext.Provider>
  );
}

export function useBitcoinConnect() {
  const context = useContext(BitcoinConnectContext);
  if (!context) {
    throw new Error('useBitcoinConnect must be used within BitcoinConnectProvider');
  }
  return context;
}