/**
 * Nostr signer reconnection utilities
 * Handles restoring NIP-46/NIP-55 connections when signer becomes unavailable
 */

import { getUnifiedSigner } from './signer';

export type LoginType = 'extension' | 'nip05' | 'nip46' | 'nip55' | 'nsecbunker' | 'amber' | null;

export interface ReconnectResult {
  success: boolean;
  error?: string;
  signerType?: string;
}

/**
 * Get current user's pubkey from localStorage
 */
export function getCurrentUserPubkey(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const storedUser = localStorage.getItem('nostr_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      return userData.nostrPubkey;
    }
  } catch (err) {
    console.warn('⚠️ Failed to get current user pubkey:', err);
  }
  return undefined;
}

/**
 * Get login type from localStorage
 */
export function getLoginType(): LoginType {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nostr_login_type') as LoginType;
}

/**
 * Attempt to restore NIP-46/nsecBunker connection
 */
async function restoreNIP46Connection(
  signer: ReturnType<typeof getUnifiedSigner>,
  currentUserPubkey?: string
): Promise<ReconnectResult> {
  console.log('🔄 NIP-46/nsecBunker signer not available, attempting to restore connection...');

  try {
    const { loadNIP46Connection, saveNIP46Connection } = await import('./nip46-storage');
    const { NIP46Client } = await import('./nip46-client');

    // Debug: Check what's in localStorage
    if (typeof window !== 'undefined') {
      const defaultConn = localStorage.getItem('nostr_nip46_connection');
      const byPubkeyConn = localStorage.getItem('nostr_nip46_connections_by_pubkey');
      console.log('🔍 Checking localStorage for connections:', {
        hasDefaultConnection: !!defaultConn,
        hasByPubkeyConnections: !!byPubkeyConn,
        currentUserPubkey: currentUserPubkey?.slice(0, 16) + '...' || 'N/A',
      });
    }

    // Load saved connection - try with user pubkey first
    let savedConnection = currentUserPubkey ? loadNIP46Connection(currentUserPubkey) : null;
    if (!savedConnection) {
      console.log('⚠️ No connection found with user pubkey, trying without validation...');
      savedConnection = loadNIP46Connection();
    }

    if (!savedConnection) {
      console.warn('⚠️ No saved NIP-46/nsecBunker connection found');
      return {
        success: false,
        error: 'Nostr connection lost. Please log out and reconnect your signer.'
      };
    }

    // Validate connection matches current user
    if (currentUserPubkey && savedConnection.pubkey && savedConnection.pubkey !== currentUserPubkey) {
      console.warn('⚠️ Stored connection is for different user. Cannot restore.');
      return {
        success: false,
        error: 'Connection mismatch: Please log out and reconnect your signer.'
      };
    }

    // Set pubkey if missing
    if (!savedConnection.pubkey && currentUserPubkey) {
      savedConnection.pubkey = currentUserPubkey;
      console.log('✅ Set pubkey on connection from current user');
    }

    console.log('✅ Found saved NIP-46/nsecBunker connection, restoring...', {
      signerUrl: savedConnection.signerUrl,
      hasToken: !!savedConnection.token,
      hasPubkey: !!savedConnection.pubkey,
    });

    // Create client and restore connection
    const client = new NIP46Client();
    await client.connect(savedConnection.signerUrl, savedConnection.token, false, savedConnection.pubkey, savedConnection.signerAppPubkey);

    // Authenticate
    console.log('🔐 Authenticating NIP-46/nsecBunker connection...');
    try {
      await client.authenticate();
    } catch (authError) {
      console.warn('⚠️ Authentication failed with saved pubkey, trying fresh connection...', authError);
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      await client.connect(savedConnection.signerUrl, savedConnection.token, false);
      await client.authenticate();
    }

    // Verify client is connected
    const isClientConnected = client.isConnected();
    console.log('🔍 NIP-46 client connection status:', {
      isConnected: isClientConnected,
      hasConnection: !!client.getConnection(),
      pubkey: client.getPubkey()?.slice(0, 16) + '...' || 'N/A',
    });

    if (!isClientConnected) {
      console.warn('⚠️ NIP-46 client not connected after restore attempt');
      try {
        await client.authenticate();
        console.log('✅ NIP-46 client authenticated after retry');
      } catch (authError) {
        const errorMsg = authError instanceof Error ? authError.message : String(authError);
        return {
          success: false,
          error: `Authentication failed: ${errorMsg}. Please try reconnecting your signer.`
        };
      }
    }

    // Save the connection
    const connection = client.getConnection();
    if (connection) {
      connection.pubkey = currentUserPubkey || connection.pubkey;
      saveNIP46Connection(connection);
      console.log('💾 Saved restored connection to localStorage');
    }

    // Register with unified signer
    await signer.setNIP46Signer(client);
    console.log('✅ NIP-46/nsecBunker signer restored successfully!');

    // Give it a moment to fully establish
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify signer is now available
    if (!signer.isAvailable()) {
      console.log('🔄 Attempting final reinitialize...');
      await signer.reinitialize();
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!signer.isAvailable()) {
        return {
          success: false,
          error: 'Signer not available after reconnection. Please try logging out and reconnecting your signer.'
        };
      }
    }

    // authenticate() short-circuits on a saved pubkey (see nip46-client.ts:3595)
    // so a successful restore only proves our relay socket is up — not that
    // the signer app is listening on its end. Ping end-to-end so we don't
    // hand back a green light that still hangs on the next signEvent.
    try {
      await client.pingSigner(5000);
    } catch (pingErr) {
      const pingMsg = pingErr instanceof Error ? pingErr.message : String(pingErr);
      console.warn('⚠️ NIP-46: Signer ping failed after restore:', pingMsg);
      return {
        success: false,
        error: 'Signer not responding. Open your signer app (Primal/Amber) to wake it up, then try again.'
      };
    }

    console.log('✅ Signer verified available');
    return { success: true, signerType: 'nip46' };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Reconnection error:', errorMessage);
    return {
      success: false,
      error: `Reconnection failed: ${errorMessage}. Please try reconnecting your signer.`
    };
  }
}

/**
 * Attempt to restore NIP-55 connection (Android only)
 */
async function restoreNIP55Connection(
  signer: ReturnType<typeof getUnifiedSigner>
): Promise<ReconnectResult> {
  console.log('🔄 NIP-55 signer not available, attempting to reconnect...');

  try {
    const { NIP55Client } = await import('./nip55-client');
    const { isIOS } = await import('@/lib/utils/device');

    // Check if user is on iOS - NIP-55 doesn't work on iOS
    if (isIOS()) {
      console.warn('⚠️ NIP-55 is not supported on iOS Safari.');
      return {
        success: false,
        error: 'NIP-55 is not supported on iOS. Please log out and reconnect using NIP-46 (Nostr Connect).'
      };
    }

    const nip55Client = new NIP55Client();
    await nip55Client.connect();
    await signer.setNIP55Signer(nip55Client);
    console.log('✅ NIP-55 reconnected successfully!');

    return { success: true, signerType: 'nip55' };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Failed to reconnect NIP-55:', errorMessage);

    if (errorMessage.includes('iOS') || errorMessage.includes('not supported')) {
      return {
        success: false,
        error: 'NIP-55 is not supported on iOS. Please log out and reconnect using NIP-46 (Nostr Connect).'
      };
    }

    return {
      success: false,
      error: `NIP-55 reconnection failed: ${errorMessage}`
    };
  }
}

/**
 * Verify NIP-46 connection is active, attempting reconnection if stale
 */
export async function verifyNIP46Connection(
  signer: ReturnType<typeof getUnifiedSigner>
): Promise<ReconnectResult> {
  const nip46Client = signer.getNIP46Client();

  if (!nip46Client) {
    return {
      success: false,
      error: 'Nostr client not available. Please try reconnecting your signer.'
    };
  }

  let isConnected = nip46Client.isConnected();
  const connection = nip46Client.getConnection();
  const pubkey = nip46Client.getPubkey();
  let lastReauthError: string | null = null;

  console.log('🔍 NIP-46/nsecBunker connection verification:', {
    isConnected,
    hasConnection: !!connection,
    hasPubkey: !!pubkey,
  });

  // If connection object exists but relay is stale (e.g. iOS killed WebSocket),
  // attempt to re-authenticate.  authenticate() now detects dead relay WebSockets
  // and forces reconnection via startRelayConnection().
  if (!isConnected && connection) {
    console.log('🔄 NIP-46: Connection stale, attempting re-authentication (with relay reconnect)...');
    try {
      await nip46Client.authenticate();
      isConnected = nip46Client.isConnected();
      console.log('🔄 NIP-46: Re-authentication result:', { isConnected });
    } catch (err) {
      lastReauthError = err instanceof Error ? err.message : String(err);
      console.warn('⚠️ NIP-46: Re-authentication failed:', err);
    }

    // If still not connected, give the relay a moment — the fresh WebSocket may
    // still be completing the handshake after startRelayConnection returned.
    if (!isConnected) {
      console.log('🔄 NIP-46: Still not connected, waiting briefly for relay handshake...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (nip46Client.isConnected()) {
          isConnected = true;
          console.log('✅ NIP-46: Relay connected after brief wait');
          break;
        }
      }
    }
  }

  if (!isConnected || !connection) {
    // Surface the actual underlying failure (e.g. WebSocket handshake timeout,
    // relay refused) instead of the generic "log out and reconnect" message,
    // so users and logs can tell whether it's a relay outage or a real auth
    // problem.
    const detail = lastReauthError ? ` (${lastReauthError})` : '';
    return {
      success: false,
      error: `Signer connection could not be re-established${detail}. The Nostr relay may be unreachable — please try again, or log out and reconnect your signer.`
    };
  }

  if (!pubkey) {
    console.warn('⚠️ NIP-46/nsecBunker pubkey not available, attempting to get it...');
    try {
      await nip46Client.getPublicKey();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get public key. Please try reconnecting your signer.'
      };
    }
  }

  // Relay socket alive ≠ signer subscription alive. If the signer app (e.g.
  // Primal on iOS) was killed while backgrounded, its own relay subscription
  // is dead even though our WebSocket is happily open. Ping end-to-end so
  // "Reconnect" only reports success when the signer actually answers —
  // otherwise the user sees a green toast and then hits a 120s hang on the
  // next boost/favorite. Any response (including "unknown method") proves
  // reachability; only a timeout fails.
  try {
    await nip46Client.pingSigner(5000);
  } catch (pingErr) {
    const pingMsg = pingErr instanceof Error ? pingErr.message : String(pingErr);
    console.warn('⚠️ NIP-46: Signer ping failed during verify:', pingMsg);
    return {
      success: false,
      error: 'Signer not responding. Open your signer app (Primal/Amber) to wake it up, then try again.'
    };
  }

  return { success: true, signerType: 'nip46' };
}

/**
 * User-initiated reconnect. Bypasses the "is available" short-circuit in
 * ensureSignerAvailable so the user can force a fresh handshake even when
 * the signer looks fine locally but requests silently time out (classic
 * iOS PWA + Primal failure where our relay socket reports alive but the
 * signer's own subscription died). Rebuilds the NIP-46 client from
 * localStorage when in-memory revival fails.
 *
 * Leaves the user record untouched — this is NOT a logout.
 */
export async function reconnectSignerManually(): Promise<ReconnectResult> {
  const signer = getUnifiedSigner();
  const loginType = getLoginType();

  await signer.ensureInitialized();

  if (loginType === 'nip46' || loginType === 'nsecbunker' || loginType === 'amber') {
    // Try in-memory revival first — it preserves session state (signerAppPubkey,
    // bunker relays, rate-limit counters) that localStorage can't reproduce.
    if (signer.getNIP46Client()) {
      const verifyResult = await verifyNIP46Connection(signer);
      if (verifyResult.success) {
        return verifyResult;
      }
      console.log('⚠️ Manual reconnect: in-memory revive failed, falling back to localStorage restore:', verifyResult.error);
    }
    const currentUserPubkey = getCurrentUserPubkey();
    return restoreNIP46Connection(signer, currentUserPubkey);
  }

  if (loginType === 'nip55') {
    return restoreNIP55Connection(signer);
  }

  // For extension/NIP-05, reinit picks up the browser extension again.
  if (loginType === 'extension' || loginType === 'nip05') {
    try {
      await signer.reinitialize();
      if (signer.isAvailable()) {
        return { success: true, signerType: signer.getSignerType() || undefined };
      }
    } catch (error) {
      console.warn('⚠️ Manual reconnect: reinit failed:', error);
    }
    return {
      success: false,
      error: 'No NIP-07 extension available. Please install or enable your Nostr extension.',
    };
  }

  return {
    success: false,
    error: 'No Nostr signer configured. Please log in.',
  };
}

/**
 * Ensure signer is available, attempting reconnection if needed
 * Returns true if signer is available, false otherwise
 */
export async function ensureSignerAvailable(): Promise<ReconnectResult> {
  const signer = getUnifiedSigner();
  const loginType = getLoginType();

  // CRITICAL: Wait for the constructor's async initialization to complete first.
  // Without this, isAvailable() returns false while init is still in flight,
  // triggering a redundant reinitialize() that races with the original init —
  // creating two NIP-46 clients competing for the same relay connection.
  await signer.ensureInitialized();

  // Try to reinitialize if still not available after init completed
  if (!signer.isAvailable()) {
    try {
      await signer.reinitialize();
    } catch (error) {
      console.warn('⚠️ Failed to reinitialize signer:', error);
    }
  }

  // If available, verify the signer type matches the login type
  if (signer.isAvailable()) {
    const signerType = signer.getSignerType();

    // Check for signer/login type mismatch
    // If user logged in with NIP-05 or extension, they should use NIP-07, not NIP-46
    if ((loginType === 'nip05' || loginType === 'extension') &&
        (signerType === 'nip46' || signerType === 'nsecbunker')) {
      console.warn(`⚠️ Signer type mismatch: logged in with ${loginType} but signer is ${signerType}. Reinitializing...`);
      // Force reinitialize to pick the correct signer
      try {
        await signer.reinitialize();
        const newSignerType = signer.getSignerType();
        if (newSignerType === 'nip07') {
          return { success: true, signerType: 'nip07' };
        }
        // If still NIP-46, the NIP-07 extension isn't available
        if (newSignerType === 'nip46' || newSignerType === 'nsecbunker') {
          console.warn(`⚠️ Still using ${newSignerType} after reinit - NIP-07 extension not available`);
          // Return error for NIP-05 users without NIP-07 extension
          return {
            success: false,
            error: 'No NIP-07 extension found. Install a Nostr browser extension (Primal, Alby, nos2x) to post to Nostr, or log in with NIP-46 (Amber).'
          };
        }
      } catch (error) {
        console.warn('⚠️ Failed to reinitialize signer:', error);
      }
    }

    // For NIP-46, verify the connection is active
    if (signerType === 'nip46' || signerType === 'nsecbunker') {
      const verifyResult = await verifyNIP46Connection(signer);
      if (!verifyResult.success) {
        return verifyResult;
      }
    }

    return { success: true, signerType: signerType || undefined };
  }

  // Not available - attempt reconnection based on login type
  const currentUserPubkey = getCurrentUserPubkey();

  if (loginType === 'nip46' || loginType === 'nsecbunker' || loginType === 'amber') {
    // FAST PATH: if the UnifiedSigner already holds an NIP-46 client (just with
    // a dead WebSocket — common on iOS Safari after backgrounding), try reviving
    // it via verifyNIP46Connection() before falling back to the localStorage-
    // based restore. The in-memory client has all connection info (signerUrl,
    // token, signerAppPubkey) so reconnecting through it is more reliable than
    // re-reading from storage, and it avoids the misleading "Nostr connection
    // lost. Please log out and reconnect your signer." error when the saved
    // connection is technically present but loadNIP46Connection() returns null
    // (e.g. pubkey-mismatch fallthrough, ITP, etc.).
    if (signer.getNIP46Client()) {
      console.log('🔄 Signer reports unavailable but NIP-46 client is in memory — trying to revive it before localStorage restore');
      const verifyResult = await verifyNIP46Connection(signer);
      if (verifyResult.success) {
        return verifyResult;
      }
      console.log('⚠️ In-memory NIP-46 client could not be revived, falling back to localStorage restore:', verifyResult.error);
    }
    return restoreNIP46Connection(signer, currentUserPubkey);
  }

  if (loginType === 'nip55') {
    return restoreNIP55Connection(signer);
  }

  // For extension or NIP-05 login, try reinitializing again as NIP-07 might be available now
  if (loginType === 'extension' || loginType === 'nip05') {
    console.log(`ℹ️ ${loginType} login detected, checking for NIP-07 extension...`);
    try {
      await signer.reinitialize();
      if (signer.isAvailable()) {
        return { success: true, signerType: signer.getSignerType() || undefined };
      }
    } catch (error) {
      console.warn('⚠️ Failed to find NIP-07 extension:', error);
    }

    return {
      success: false,
      error: loginType === 'nip05'
        ? 'No NIP-07 extension found. Install a Nostr extension (Primal, Alby, nos2x) to post to Nostr.'
        : 'No NIP-07 extension available. Please install or enable your Nostr extension.'
    };
  }

  // No reconnection possible
  console.log('ℹ️ No signer available (NIP-07 extension, NIP-46, or NIP-55 required)');
  return {
    success: false,
    error: 'No Nostr signer available. Please connect a Nostr wallet.'
  };
}
