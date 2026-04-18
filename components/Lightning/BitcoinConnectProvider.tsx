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

  useEffect(() => {
    // Initialize Bitcoin Connect on component mount (client-side only)
    // Note: We always initialize Bitcoin Connect even for NIP-46/NIP-55/Amber logins
    // because users may separately connect an NWC wallet for Lightning payments.
    // init() doesn't trigger popups — only requestProvider()/launchModal() do.
    // The WebLN auto-connect for Alby is guarded separately below.
    if (typeof window !== 'undefined') {
      import('@getalby/bitcoin-connect').then(({ init, onConnected, onDisconnected }) => {
        init({
          appName: 'StableKraft',
          showBalance: true, // Show balance in the modal
          // Don't specify filters to allow all connection methods including browser extensions
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

          // Force wallet reconnection after Nostr login by calling requestProvider
          // This is safe because we know the user had a wallet connected before login
          import('@getalby/bitcoin-connect').then(async ({ requestProvider }) => {
            try {
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

    // Add global CSS to ensure Bitcoin Connect modal is immediately interactive
    const style = document.createElement('style');
    style.textContent = `
      bc-modal-wrapper,
      bc-modal-wrapper *,
      bc-modal,
      bc-modal * {
        pointer-events: auto !important;
      }

      /* Ensure modal overlay allows clicks through to the modal */
      bc-modal-wrapper::part(overlay) {
        pointer-events: auto !important;
      }

      /* Ensure close button is immediately clickable */
      bc-modal::part(close-button),
      bc-modal [part="close-button"],
      bc-modal button[aria-label*="Close"],
      bc-modal button[aria-label*="close"] {
        pointer-events: auto !important;
        cursor: pointer !important;
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
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

  const connect = async () => {
    try {
      setIsLoading(true);

      // Clear manual disconnect flag when user explicitly connects
      setManuallyDisconnected(false);
      localStorage.setItem('wallet_manually_disconnected', 'false');

      // Always use Bitcoin Connect modal to let user choose their wallet
      // This gives users full control over which wallet to connect
      const bitcoinConnect = await import('@getalby/bitcoin-connect');

      try {
        console.log('🔌 Launching Bitcoin Connect modal...');

        // Launch Bitcoin Connect modal
        // This will show all available wallet options (Alby, Phoenix, NWC, etc.)
        // Connection state is updated via the onConnected callback set up in useEffect
        await bitcoinConnect.launchModal();

        console.log('✅ Modal launch completed');

        // After modal closes, check if a connection was made
        // The onConnected event should fire, but let's verify the connection state
        setTimeout(async () => {
          try {
            const connectedProvider = await bitcoinConnect.requestProvider();
            if (connectedProvider && !provider) {
              console.log('🔄 Modal closed with connection, but state not updated. Forcing update...');
              setProvider(connectedProvider);
              setIsConnected(true);
            }
          } catch (err) {
            // No connection made, user likely cancelled
            console.log('ℹ️ No connection after modal close');
          }
        }, 500); // Small delay to let onConnected fire first
      } catch (providerError) {
        // User may have cancelled or there was an error
        console.log('Bitcoin Connect modal cancelled or error:', providerError);
        throw providerError;
      }

    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

      // Add boostagram message if provided
      if (message) {
        // TLV record 34349334 is used for boostagram messages
        // WebLN provider handles encoding - pass plain string
        customRecords['34349334'] = message;
      }

      // Add Helipad metadata if provided
      if (helipadMetadata) {
        try {
          // Clean the metadata object to remove any undefined/null values that could cause issues
          const cleanMetadata = Object.fromEntries(
            Object.entries(helipadMetadata).filter(([_, value]) => value !== undefined && value !== null)
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
        // Enhanced wallet info
        walletInfo,
        balance,
        isBalanceLoading,
        refreshBalance,
        walletProviderType,
      }}
    >
      {children}
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