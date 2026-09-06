'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { APP_NAME } from '@/lib/constants';
import { NIP46Client } from '@/lib/nostr/nip46-client';

export interface Nip46ConnectionState {
  // Core state
  nip46Client: NIP46Client | null;
  showNip46Connect: boolean;
  nip46ConnectionToken: string;
  nip46SignerUrl: string;

  // Auto-init state
  amberConnectionInitialized: boolean;
  amberConnectionError: string | null;
  isInitializingAmber: boolean;

  // Paste URI state
  pastedConnectionUri: string;
  showPasteUri: boolean;
}

export interface Nip46ConnectionActions {
  // State setters
  setShowNip46Connect: (show: boolean) => void;
  setPastedConnectionUri: (uri: string) => void;
  setShowPasteUri: (show: boolean) => void;
  setAmberConnectionError: (error: string | null) => void;
  setAmberConnectionInitialized: (initialized: boolean) => void;
  setNip46Client: (client: NIP46Client | null) => void;
  setNip46ConnectionToken: (token: string) => void;
  setNip46SignerUrl: (url: string) => void;

  // Actions
  cleanupAmberConnection: () => Promise<void>;
  initializeAmberConnection: () => Promise<void>;

  // Ref access
  nip46ClientRef: React.MutableRefObject<NIP46Client | null>;
}

export interface UseNip46ConnectionOptions {
  loginMethod: 'nostr-login' | 'primal' | 'amber';
  isSubmitting: boolean;
}

export function useNip46Connection(options: UseNip46ConnectionOptions): Nip46ConnectionState & Nip46ConnectionActions {
  const { loginMethod, isSubmitting } = options;

  // Core NIP-46 state
  const [nip46Client, setNip46Client] = useState<NIP46Client | null>(null);
  const nip46ClientRef = useRef<NIP46Client | null>(null);
  const [showNip46Connect, setShowNip46Connect] = useState(false);
  const [nip46ConnectionToken, setNip46ConnectionToken] = useState<string>('');
  const [nip46SignerUrl, setNip46SignerUrl] = useState<string>('');

  // Auto-init state for Amber connection
  const [amberConnectionInitialized, setAmberConnectionInitialized] = useState(false);
  const [amberConnectionError, setAmberConnectionError] = useState<string | null>(null);
  const [isInitializingAmber, setIsInitializingAmber] = useState(false);

  // Paste URI state
  const [pastedConnectionUri, setPastedConnectionUri] = useState<string>('');
  const [showPasteUri, setShowPasteUri] = useState(false);

  // Cleanup function for Amber connection
  const cleanupAmberConnection = useCallback(async () => {
    if (nip46ClientRef.current) {
      try {
        await nip46ClientRef.current.disconnect();
      } catch (err) {
        console.warn('Failed to disconnect NIP-46 client:', err);
      }
      nip46ClientRef.current = null;
    }
    setNip46Client(null);
    setShowNip46Connect(false);
    setNip46ConnectionToken('');
    setNip46SignerUrl('');
    setAmberConnectionInitialized(false);
    setAmberConnectionError(null);
    setIsInitializingAmber(false);
  }, []);

  // Initialize Amber connection - extracted from handleNip46Connect for auto-init
  const initializeAmberConnection = useCallback(async () => {
    // Check if localStorage is available and persistent
    try {
      const testKey = '_nip46_storage_test';
      localStorage.setItem(testKey, 'test');
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== 'test') {
        throw new Error('localStorage is not working properly. You may be in incognito/private mode.');
      }
    } catch (err) {
      throw new Error('localStorage is blocked. You may be in incognito/private mode.');
    }

    // Check for existing valid connection and try to auto-reconnect
    const { hasValidConnection, loadNIP46Connection, clearNIP46Connection } = await import('@/lib/nostr/nip46-storage');
    const { getUnifiedSigner } = await import('@/lib/nostr/signer');

    if (hasValidConnection()) {
      console.log('🔄 NIP-46: Found existing connection, attempting auto-reconnect...');

      // Get current user pubkey for validation
      let currentUserPubkey: string | undefined;
      try {
        const storedUser = localStorage.getItem('nostr_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          currentUserPubkey = userData.nostrPubkey;
        }
      } catch (err) {
        console.warn('⚠️ Failed to get current user pubkey:', err);
      }

      // Load the stored connection (with user pubkey validation)
      const storedConnection = loadNIP46Connection(currentUserPubkey);
      if (storedConnection && storedConnection.pubkey) {
        // Validate connection matches current user
        if (currentUserPubkey && storedConnection.pubkey !== currentUserPubkey) {
          throw new Error('Stored connection is for a different user. Please reconnect.');
        }
        // Create client and restore connection using proper connect() to
        // establish a real relay WebSocket. The old code injected the stored
        // connection object directly, which left the client with no relay
        // link — signing requests would silently fail.
        const client = new NIP46Client();
        await client.connect(
          storedConnection.signerUrl,
          storedConnection.token,
          false,
          storedConnection.pubkey,
          storedConnection.signerAppPubkey // Restore signer's actual pubkey for sign_event targeting
        );
        await client.authenticate();

        setNip46Client(client);
        nip46ClientRef.current = client;

        // Register with unified signer
        const signer = getUnifiedSigner();
        await signer.setNIP46Signer(client);

        console.log('✅ NIP-46: Auto-reconnect successful');

        // Set state to show we're ready (but don't show QR - we'll auto-login)
        setShowNip46Connect(true);
        return;
      }
    }

    // Clear any existing connections to start fresh
    clearNIP46Connection();

    // Disconnect any active NIP-46 signer in UnifiedSigner
    const signer = getUnifiedSigner();
    try {
      await signer.disconnectNIP46();
    } catch (err) {
      console.log('ℹ️ NIP-46: No active connection to disconnect');
    }

    // Clean up any existing client connection
    if (nip46ClientRef.current) {
      try {
        await nip46ClientRef.current.disconnect();
      } catch (err) {
        console.warn('Failed to disconnect existing client:', err);
      }
      nip46ClientRef.current = null;
    }
    setNip46Client(null);

    // Get or create a persistent app key pair
    const { getOrCreateAppKeyPair } = await import('@/lib/nostr/nip46-storage');
    const keyPair = getOrCreateAppKeyPair();
    const { privateKey, publicKey } = keyPair;

    // Get default relay for connection
    const { getDefaultRelays } = await import('@/lib/nostr/relay');
    const relays = getDefaultRelays();
    // nsec.app is no longer in getDefaultRelays() (dropped 2026-07-26, 502s), so
    // that half of this filter is now belt-and-braces — it still guards against
    // the relay coming back into the defaults or arriving from a user's NIP-65.
    const preferredRelays = relays.filter(r => !r.includes('relay.damus.io') && !r.includes('relay.nsec.app'));
    const relayUrl = preferredRelays[0] || 'wss://nos.lol';

    // Generate connection token
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Store connection info temporarily in sessionStorage
    const connectionInfo = {
      token,
      privateKey,
      publicKey,
      relayUrl,
      createdAt: Date.now(),
    };
    sessionStorage.setItem('nip46_pending_connection', JSON.stringify(connectionInfo));

    // Initialize NIP-46 client
    const client = new NIP46Client();
    nip46ClientRef.current = client;
    setNip46Client(client);

    // Set up connection callback
    client.setOnConnection((signerPubkey: string) => {
      console.log('✅ NIP-46: Connection established with signer:', signerPubkey);
    });

    // Start listening on relay for connection
    try {
      await client.connect(relayUrl, token, true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ initializeAmberConnection: Failed to start relay connection:', errorMessage);
      throw new Error(`Failed to connect to relay: ${errorMessage}`);
    }

    // Generate nostrconnect URI with permissions
    const relayEncoded = encodeURIComponent(relayUrl);
    const secretEncoded = encodeURIComponent(token);
    const appName = encodeURIComponent(APP_NAME);
    const appUrl = encodeURIComponent('https://stablekraft.app/');
    // Request broad permissions - some signers (Primal) don't support kind-specific permissions
    // Use generic sign_event to allow all event signing, plus specific kinds for signers that support it
    const perms = encodeURIComponent('nip04_encrypt,nip04_decrypt,nip44_encrypt,nip44_decrypt,sign_event,get_public_key');
    const nostrconnectUri = `nostrconnect://${publicKey}?relay=${relayEncoded}&secret=${secretEncoded}&name=${appName}&url=${appUrl}&perms=${perms}`;

    console.log('NIP-46: Generated connection URI for relay:', relayUrl);

    setNip46ConnectionToken(nostrconnectUri);
    setNip46SignerUrl(relayUrl);
    setShowNip46Connect(true);
  }, []);

  // Auto-initialize Amber connection when tab is selected
  useEffect(() => {
    let cancelled = false;

    const initConnection = async () => {
      if ((loginMethod === 'primal' || loginMethod === 'amber') && !amberConnectionInitialized && !showPasteUri && !isSubmitting && !isInitializingAmber) {
        setIsInitializingAmber(true);
        setAmberConnectionError(null);

        try {
          await initializeAmberConnection();
          if (!cancelled) {
            setAmberConnectionInitialized(true);
          }
        } catch (err) {
          if (!cancelled) {
            setAmberConnectionError(err instanceof Error ? err.message : 'Failed to initialize connection');
          }
        } finally {
          if (!cancelled) {
            setIsInitializingAmber(false);
          }
        }
      }
    };

    initConnection();

    return () => {
      cancelled = true;
    };
  }, [loginMethod, amberConnectionInitialized, showPasteUri, isSubmitting, isInitializingAmber, initializeAmberConnection]);

  // Cleanup when switching away from Amber tab
  useEffect(() => {
    if (loginMethod !== 'primal' && loginMethod !== 'amber' && amberConnectionInitialized) {
      cleanupAmberConnection();
    }
  }, [loginMethod, amberConnectionInitialized, cleanupAmberConnection]);

  // iOS visibility change reconnection
  // iOS Safari kills WebSocket connections after ~30 seconds when backgrounded
  // Proactively reconnect when the app returns to foreground
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && nip46ClientRef.current) {
        // Dynamically import to avoid SSR issues
        const { isIOS } = await import('@/lib/utils/device');
        const isiOSDevice = isIOS();

        // Check and reconnect - use iOS threshold on iOS devices
        try {
          const reconnected = await nip46ClientRef.current.checkAndReconnectIfNeeded(isiOSDevice);
          if (reconnected) {
            console.log(`${isiOSDevice ? 'iOS' : 'Mobile'}: Reconnected NIP-46 after app foreground`);
            // Tell the user the signer is back — silences the "why are my boosts hanging?" mystery
            const { toast } = await import('@/components/Toast');
            toast.success('Signer reconnected', { duration: 2500 });
          }
        } catch (err) {
          console.warn('NIP-46 reconnect attempt failed:', err);
          const { toast } = await import('@/components/Toast');
          toast.error('Signer disconnected — tap to retry', {
            duration: 10_000,
            action: {
              label: 'Retry',
              onClick: () => {
                nip46ClientRef.current?.checkAndReconnectIfNeeded(isiOSDevice).catch(() => {});
              },
            },
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    // State
    nip46Client,
    showNip46Connect,
    nip46ConnectionToken,
    nip46SignerUrl,
    amberConnectionInitialized,
    amberConnectionError,
    isInitializingAmber,
    pastedConnectionUri,
    showPasteUri,

    // Setters
    setShowNip46Connect,
    setPastedConnectionUri,
    setShowPasteUri,
    setAmberConnectionError,
    setAmberConnectionInitialized,
    setNip46Client,
    setNip46ConnectionToken,
    setNip46SignerUrl,

    // Actions
    cleanupAmberConnection,
    initializeAmberConnection,

    // Ref
    nip46ClientRef,
  };
}
