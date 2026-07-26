'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { NIP46Client } from '@/lib/nostr/nip46-client';
import { getUnifiedSigner } from '@/lib/nostr/signer';
import { saveNIP46Connection } from '@/lib/nostr/nip46-storage';
import Nip46Connect from './Nip46Connect';
import { useNip46Connection } from './hooks';
import {
  preserveWalletConnection,
  prepareLoginEvent,
  processSignedLogin,
  saveUserData,
} from '@/lib/nostr/auth-utils';

interface LoginModalProps {
  onClose: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  // Core UI state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'nostr-login' | 'primal' | 'amber'>('nostr-login');
  const [hasExtension, setHasExtension] = useState(false);
  // Card-menu view state: 'menu' shows the grid of sign-in options. Selecting
  // a card either runs the handler directly (Extension) or opens a sub-view
  // (Bunker URI, Primal QR, Amber QR, Advanced/nostr-login).
  const [view, setView] = useState<'menu' | 'bunker' | 'primal' | 'amber' | 'nip05'>('menu');
  const [bunkerUri, setBunkerUri] = useState('');
  const [nip05Identifier, setNip05Identifier] = useState('');

  // NIP-46 connection hook (used by Primal tab)
  const {
    nip46Client,
    showNip46Connect,
    nip46ConnectionToken,
    nip46SignerUrl,
    amberConnectionError,
    isInitializingAmber,
    setShowNip46Connect,
    setAmberConnectionError,
    setAmberConnectionInitialized,
    cleanupAmberConnection,
    nip46ClientRef,
  } = useNip46Connection({ loginMethod, isSubmitting });

  // Ensure we're mounted before rendering portal
  useEffect(() => {
    setMounted(true);
    // Close any open dropdowns when modal opens
    const closeDropdowns = () => {
      document.body.click();
    };
    closeDropdowns();
    // Detect NIP-07 browser extension (Nostash, Alby, nos2x, etc.)
    if (typeof window !== 'undefined' && (window as any).nostr) {
      setHasExtension(true);
    }
    return () => setMounted(false);
  }, []);



  // Connect using a pasted bunker:// or nostrconnect:// URI. Used by the
  // Bunker URI card — lets users paste a URI from nsec.app, Alby.to, Keycast,
  // Amber, etc. Bypasses nostr-login; talks directly to NIP46Client.
  const handlePastedUriConnect = async () => {
    const uri = bunkerUri.trim();
    if (!uri) {
      setError('Please paste a bunker:// or nostrconnect:// URI');
      return;
    }
    if (!uri.startsWith('bunker://') && !uri.startsWith('nostrconnect://')) {
      setError('Invalid URI. Must start with bunker:// or nostrconnect://');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const { NIP46Client } = await import('@/lib/nostr/nip46-client');
      const isBunker = uri.startsWith('bunker://');

      // Extract token from the URI's `secret` query param.
      let token = '';
      try {
        const url = new URL(uri.replace(/^(bunker|nostrconnect):\/\//, 'http://'));
        const secret = url.searchParams.get('secret');
        if (secret) token = decodeURIComponent(secret);
      } catch {
        // Ignore — some URIs don't have a parseable secret param.
      }

      // Warn about secretless bunker URIs (Aegis-style) — these require
      // manual approval in the signer app and have a shorter timeout.
      if (isBunker && !token) {
        console.warn('⚠️ LoginModal: Bunker URI has no secret= parameter. The signer will need to manually approve.');
      }

      const client = new NIP46Client();
      await client.connect(uri, token, true);
      nip46ClientRef.current = client;

      const { getUnifiedSigner } = await import('@/lib/nostr/signer');
      const signer = getUnifiedSigner();
      await signer.setNIP46Signer(client);

      // For bunker:// URIs, give the remote signer a moment to be ready
      // before we request a signature.
      if (isBunker) await new Promise((r) => setTimeout(r, 1500));

      await handleNip46ConnectedWithClient(client);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setIsSubmitting(false);
    }
  };

  // NIP-05 read-only login. Resolves a name@domain identifier to a pubkey via
  // the domain's /.well-known/nostr.json (done server-side), loads the profile,
  // and signs the user in WITHOUT a signer. They can browse as themselves and
  // see their favorites, but signed actions (boost, publish) stay unavailable
  // until they connect a real signer.
  const handleNip05Login = async () => {
    const identifier = nip05Identifier.trim().toLowerCase();
    const [name, domain] = identifier.split('@');
    if (identifier.split('@').length !== 2 || !name || !domain) {
      setError('Enter a valid NIP-05 address like alice@example.com');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/nostr/auth/nip05-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.user) {
        throw new Error(data?.error || `NIP-05 login failed: ${res.status}`);
      }

      // Persist as a read-only nip05 session. saveUserData stores nostr_user +
      // nostr_login_type='nip05' and correctly skips savePreferredSigner.
      // Intentionally NOT calling markFavoritesSyncPending — that publishes
      // favorites to Nostr and needs a signer. The server route already
      // migrated session favorites into the DB; NostrContext reads them from
      // the DB on reload.
      saveUserData(data.user, 'nip05');

      onClose();
      await preserveWalletConnection();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete NIP-05 login');
      setIsSubmitting(false);
    }
  };

  const handleNip46Connected = async () => {
    // Use the ref to get the client
    const client = nip46ClientRef.current || nip46Client;
    if (!client) {
      setError('NIP-46 client not initialized. Please try connecting again.');
      setIsSubmitting(false);
      return;
    }
    await handleNip46ConnectedWithClient(client);
  };

  const handleNip46ConnectedWithClient = async (client: NIP46Client) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Wait a bit to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get public key from signer
      // For relay-based connections, Amber might not send a connection event.
      // Instead, we need to try requesting the public key and see if we get a response.
      console.log('🔍 LoginModal: Getting public key from NIP-46 client...');
      
      // Check connection status explicitly (matching test page pattern)
      const connection = client.getConnection();
      const isConnected = client.isConnected();
      const pubkey = client.getPubkey();
      
      console.log('🔍 LoginModal: Pre-sign connection check:', {
        hasClient: !!client,
        isConnected,
        hasConnection: !!connection,
        hasPubkey: !!pubkey,
        pubkey: pubkey ? pubkey.slice(0, 16) + '...' : 'N/A',
        connectionPubkey: connection?.pubkey ? connection.pubkey.slice(0, 16) + '...' : 'N/A',
        signerUrl: connection?.signerUrl || 'N/A',
      });
      
      let publicKey: string;
      
      // If we already have the pubkey, use it
      if (pubkey) {
        console.log('✅ LoginModal: Using pubkey from client:', pubkey.slice(0, 16) + '...');
        publicKey = pubkey;
      } else if (connection?.pubkey) {
        console.log('✅ LoginModal: Using pubkey from connection:', connection.pubkey.slice(0, 16) + '...');
        publicKey = connection.pubkey;
      } else {
        // Verify connection is established before requesting pubkey
        if (!isConnected || !connection) {
          throw new Error(`Not connected to signer. Connection status: connected=${isConnected}, hasConnection=${!!connection}. Please wait for the connection to be established.`);
        }
        
        console.log('⚠️ LoginModal: No pubkey available yet. Requesting from signer...');
        console.log('📱 IMPORTANT: Watch your device - your signer should show a notification or prompt');

        // Try requesting the public key - this will work if the signer is listening
        try {
          console.log('⏳ LoginModal: Waiting 2 seconds for signer to be ready...');
          // Wait a bit for signer to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('📤 LoginModal: Requesting public key from Amber via relay...');
          console.log('📋 LoginModal: Connection details:', {
            relayUrl: connection?.signerUrl,
            hasRelayClient: !!client,
            isConnected,
          });
          
          // Set a timeout warning
          const timeoutWarning = setTimeout(() => {
            console.warn('⚠️ LoginModal: Still waiting for public key response (30s elapsed). This might indicate:');
            console.warn('  1. Amber hasn\'t approved the connection yet');
            console.warn('  2. Amber is not connected to the same relay');
            console.warn('  3. Network/relay connectivity issues');
          }, 30000);
          
          const { withSignerNudge } = await import('@/lib/nostr/signer-nudge');
          const signerLabel = (client.getConnection()?.signerUrl || '').includes('primal') ? 'Primal'
            : (client.getConnection()?.signerUrl || '').includes('nsec.app') ? 'nsec.app'
            : 'your signer';
          publicKey = await withSignerNudge(() => client.getPublicKey(), {
            signerLabel,
            op: 'getPublicKey',
          });
          clearTimeout(timeoutWarning);
          console.log('✅ LoginModal: Got public key from signer:', publicKey.slice(0, 16) + '...');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorDetails = err instanceof Error ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
          } : err;
          
          console.error('❌ LoginModal: Failed to get public key:', {
            error: errorMessage,
            errorDetails,
            connectionState: {
              hasConnection: !!connection,
              hasPubkey: !!connection?.pubkey,
              connected: connection?.connected,
              relayUrl: connection?.signerUrl,
              isConnected,
            },
          });
          
          // Provide more helpful error message
          let helpfulMessage = `Unable to communicate with signer: ${errorMessage}`;
          if (errorMessage.includes('timeout')) {
            helpfulMessage += '\n\nPossible causes:\n';
            helpfulMessage += '1. Amber hasn\'t approved the connection yet - check your phone\n';
            helpfulMessage += '2. Amber is not connected to the same relay\n';
            helpfulMessage += '3. Network connectivity issues\n';
            helpfulMessage += '\nTry:\n';
            helpfulMessage += '- Make sure you scanned the QR code and approved in Amber\n';
            helpfulMessage += '- Check that Amber is using the relay: ' + (connection?.signerUrl || 'unknown') + '\n';
            helpfulMessage += '- Try clicking "Continue" button to retry';
          }
          
          throw new Error(helpfulMessage);
        }
      }
      
      if (!publicKey || publicKey.length === 0) {
        throw new Error('Failed to get public key from signer. Please try connecting again.');
      }
      
      // Verify connection is ready before signing
      console.log('✅ LoginModal: Connection verified, proceeding with challenge signing');

      // Request signature for challenge
      const challengeResponse = await fetch('/api/nostr/auth/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!challengeResponse.ok) {
        throw new Error(`Failed to get challenge: ${challengeResponse.status}`);
      }

      const challengeData = await challengeResponse.json();
      if (!challengeData.challenge) {
        throw new Error('Invalid challenge response');
      }

      const challenge = challengeData.challenge;

      // Validate challenge
      if (!challenge || typeof challenge !== 'string' || challenge.length === 0) {
        throw new Error('Invalid challenge received from server');
      }

      // Verify connection is still valid before signing
      const finalConnectionCheck = client.getConnection();
      const finalIsConnected = client.isConnected();
      if (!finalIsConnected || !finalConnectionCheck) {
        throw new Error('Connection lost before signing. Please reconnect and try again.');
      }
      
      // Create standardized login event template
      const { createLoginEventTemplate } = await import('@/lib/nostr/events');
      const event = createLoginEventTemplate(challenge);

      console.log('✍️ LoginModal: Requesting signature from NIP-46 signer...', {
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        created_at: event.created_at,
        challenge: challenge.slice(0, 16) + '...',
      });
      console.log('📱 IMPORTANT: Watch your phone - Amber should show a notification or prompt to approve the signature');

      let signedEvent: any;
      try {
        const { withSignerNudge } = await import('@/lib/nostr/signer-nudge');
        const signerLabel = (client.getConnection()?.signerUrl || '').includes('primal') ? 'Primal'
          : (client.getConnection()?.signerUrl || '').includes('nsec.app') ? 'nsec.app'
          : 'your signer';
        signedEvent = await withSignerNudge(() => client.signEvent(event as any), {
          signerLabel,
          op: 'sign',
        });
      } catch (signError) {
        const errorMessage = signError instanceof Error ? signError.message : String(signError);
        const errorDetails = signError instanceof Error ? {
          name: signError.name,
          message: signError.message,
          stack: signError.stack,
        } : signError;
        
        console.error('❌ LoginModal: Error signing event:', {
          error: errorMessage,
          errorDetails,
          eventDetails: {
            kind: event.kind,
            challenge: challenge.slice(0, 16) + '...',
            created_at: event.created_at,
          },
        });
        
        throw new Error(`Failed to sign event: ${errorMessage}`);
      }
      console.log('✅ LoginModal: Got signed event', {
        id: signedEvent.id?.slice(0, 16) + '...',
        pubkey: signedEvent.pubkey?.slice(0, 16) + '...',
        sig: signedEvent.sig?.slice(0, 16) + '...',
        created_at: signedEvent.created_at,
        kind: signedEvent.kind,
        content: signedEvent.content,
        hasAllFields: !!(signedEvent.id && signedEvent.pubkey && signedEvent.sig && signedEvent.created_at),
      });

      console.log('🔍 FULL SIGNED EVENT:', JSON.stringify(signedEvent, null, 2));

      // Validate signed event has all required fields
      if (!signedEvent) {
        console.error('❌ LoginModal: Signed event is null or undefined');
        throw new Error('Failed to sign event. Please try again.');
      }

      // Validate each required field individually with detailed error messages
      const missingFields: string[] = [];
      if (!signedEvent.pubkey || typeof signedEvent.pubkey !== 'string' || signedEvent.pubkey.length === 0) {
        missingFields.push('pubkey');
      }
      if (!signedEvent.sig || typeof signedEvent.sig !== 'string' || signedEvent.sig.length === 0) {
        missingFields.push('sig');
      }
      if (!signedEvent.id || typeof signedEvent.id !== 'string' || signedEvent.id.length === 0) {
        missingFields.push('id');
      }
      if (!signedEvent.created_at || typeof signedEvent.created_at !== 'number') {
        missingFields.push('created_at');
      }

      if (missingFields.length > 0) {
        console.error('❌ LoginModal: Signed event missing required fields:', {
          missingFields,
          hasEvent: !!signedEvent,
          pubkey: signedEvent.pubkey ? `${signedEvent.pubkey.slice(0, 16)}...` : 'MISSING',
          sig: signedEvent.sig ? `${signedEvent.sig.slice(0, 16)}...` : 'MISSING',
          id: signedEvent.id ? `${signedEvent.id.slice(0, 16)}...` : 'MISSING',
          created_at: signedEvent.created_at,
          fullEvent: JSON.stringify(signedEvent, null, 2),
        });
        throw new Error(`Signed event is missing required fields: ${missingFields.join(', ')}. Please try again.`);
      }

      // Validate challenge is present
      if (!challenge || typeof challenge !== 'string' || challenge.length === 0) {
        console.error('❌ LoginModal: Challenge is missing or invalid:', challenge);
        throw new Error('Challenge is missing. Please try again.');
      }

      // Calculate npub from public key
      const { publicKeyToNpub } = await import('@/lib/nostr/keys');
      let npub: string;
      try {
        npub = publicKeyToNpub(signedEvent.pubkey);
      } catch (error) {
        console.error('❌ LoginModal: Failed to calculate npub:', error);
        throw new Error('Failed to calculate npub from public key. Please try again.');
      }

      // Prepare login payload with explicit validation
      // Use defensive checks to avoid .trim() errors on undefined/null values
      const loginPayload = {
        publicKey: (signedEvent.pubkey || '').trim(),
        npub: (npub || '').trim(),
        challenge: (challenge || '').trim(),
        signature: (signedEvent.sig || '').trim(),
        eventId: (signedEvent.id || '').trim(),
        createdAt: signedEvent.created_at,
        kind: signedEvent.kind, // Include kind so API can reconstruct event
        content: signedEvent.content || '', // Include content so API can reconstruct event
      };

      // Final validation of payload before sending
      const payloadMissingFields: string[] = [];
      if (!loginPayload.publicKey || loginPayload.publicKey.length === 0) payloadMissingFields.push('publicKey');
      if (!loginPayload.challenge || loginPayload.challenge.length === 0) payloadMissingFields.push('challenge');
      if (!loginPayload.signature || loginPayload.signature.length === 0) payloadMissingFields.push('signature');
      if (!loginPayload.eventId || loginPayload.eventId.length === 0) payloadMissingFields.push('eventId');
      if (!loginPayload.createdAt || typeof loginPayload.createdAt !== 'number') payloadMissingFields.push('createdAt');

      if (payloadMissingFields.length > 0) {
        console.error('❌ LoginModal: Login payload missing required fields:', {
          missingFields: payloadMissingFields,
          payload: loginPayload,
        });
        throw new Error(`Login payload is missing required fields: ${payloadMissingFields.join(', ')}. Please try again.`);
      }

      console.log('📤 LoginModal: Sending login request with payload:', {
        publicKey: loginPayload.publicKey.slice(0, 16) + '...',
        npub: loginPayload.npub.slice(0, 16) + '...',
        challenge: loginPayload.challenge.slice(0, 16) + '...',
        signature: loginPayload.signature.slice(0, 16) + '...',
        eventId: loginPayload.eventId.slice(0, 16) + '...',
        createdAt: loginPayload.createdAt,
        kind: loginPayload.kind,
        content: loginPayload.content,
      });

      console.log('🌐 LOGIN REQUEST - FULL PAYLOAD:', JSON.stringify(loginPayload, null, 2));

      // Login with signed event
      console.log('📡 About to fetch /api/nostr/auth/login...');
      let loginResponse;
      try {
        loginResponse = await fetch('/api/nostr/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginPayload),
        });
        console.log('📡 Login response received:', loginResponse.status, loginResponse.statusText);
      } catch (fetchError) {
        console.error('❌ LoginModal: Fetch request failed:', fetchError);
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        throw new Error(`Network request failed: ${errorMsg}`);
      }

      if (!loginResponse.ok) {
        let errorData;
        try {
          errorData = await loginResponse.json();
        } catch (jsonError) {
          console.error('❌ LoginModal: Failed to parse error response JSON:', jsonError);
          throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }
        console.error('❌ LoginModal: Login request returned error:', errorData);
        throw new Error(errorData.error || `Login failed: ${loginResponse.status}`);
      }

      const loginData = await loginResponse.json();
      if (loginData.success && loginData.user) {
        // Detect if this is nsecBunker (bunker:// URI)
        const connection = client.getConnection();
        const isNsecBunker = connection?.signerUrl?.includes('bunker://') ?? false;
        const loginType = isNsecBunker ? 'nsecbunker' : 'nip46';
        
        // Clear stale connections for other users before saving
        const { clearNIP46ConnectionForUser } = await import('@/lib/nostr/nip46-storage');
        // Get all stored connections and clear ones that don't match this user
        try {
          const byPubkey = JSON.parse(localStorage.getItem('nostr_nip46_connections_by_pubkey') || '{}');
          Object.keys(byPubkey).forEach((pubkey) => {
            if (pubkey !== loginData.user.nostrPubkey) {
              clearNIP46ConnectionForUser(pubkey);
            }
          });
        } catch (err) {
          console.warn('⚠️ Failed to clear stale connections:', err);
        }
        
        // Normalize connection pubkey to the logged-in user's pubkey.
        // Amber's connect-response comes from its per-session signer key,
        // not the user's Nostr pubkey. Without this normalization, the
        // mismatch caused an early-return that skipped saving nostr_user
        // to localStorage, so the user appeared logged out on reload.
        if (connection && connection.pubkey && connection.pubkey !== loginData.user.nostrPubkey) {
          console.log(`ℹ️ LoginModal: Normalizing connection pubkey from ${connection.pubkey.slice(0, 16)}... to logged-in user ${loginData.user.nostrPubkey.slice(0, 16)}...`);
          connection.pubkey = loginData.user.nostrPubkey;
        }
        {
          // Save user data
          localStorage.setItem('nostr_user', JSON.stringify(loginData.user));
          localStorage.setItem('nostr_login_type', loginType);
          
          // Save preferred signer for better UX on return visits
          const { savePreferredSigner } = await import('@/lib/nostr/nip46-storage');
          savePreferredSigner(loginData.user.nostrPubkey, loginType);
          
          // Save NIP-46/nsecBunker connection
          if (connection) {
            // Ensure connection has the correct pubkey
            connection.pubkey = loginData.user.nostrPubkey;
            
            // Detect if this is a bunker:// connection
            // Bunker connections have signerPubkey set and signerUrl is the bunker:// URI
            const isBunkerConnection = isNsecBunker || (connection as any).signerPubkey || connection.signerUrl?.startsWith('bunker://');
            
            // Log connection details before saving
            console.log('💾 LoginModal: Saving NIP-46 connection:', {
              signerUrl: connection.signerUrl,
              hasToken: !!connection.token,
              tokenLength: connection.token?.length || 0,
              pubkey: connection.pubkey?.slice(0, 16) + '...' || 'N/A',
              connected: connection.connected,
              connectedAt: connection.connectedAt,
              isBunkerConnection,
            });
            
            // Validate connection has required fields
            // For bunker:// connections, token is optional (may be empty)
            if (!connection.signerUrl) {
              console.error('❌ LoginModal: Connection missing required fields:', {
                hasSignerUrl: !!connection.signerUrl,
                hasToken: !!connection.token,
                isBunkerConnection,
              });
              throw new Error('Connection missing required fields. Cannot save.');
            }
            
            // Token is required for non-bunker connections
            if (!isBunkerConnection && !connection.token) {
              console.error('❌ LoginModal: Non-bunker connection missing token:', {
                hasSignerUrl: !!connection.signerUrl,
                hasToken: !!connection.token,
              });
              throw new Error('Connection missing required fields. Cannot save.');
            }
            
            saveNIP46Connection(connection);
            console.log('✅ LoginModal: Connection saved successfully');
          } else {
            console.error('❌ LoginModal: No connection object to save!');
          }
        }
        
        // Register with unified signer
        const signer = getUnifiedSigner();
        await signer.setNIP46Signer(client);

        // Defer favorites sync until after the post-login reload.
        // NostrContext picks this up on the next page load and runs sync
        // when the page is stable.
        const { markFavoritesSyncPending, markNwcBackupOfferPending } = await import('@/lib/nostr/auth-utils');
        markFavoritesSyncPending(loginData.user.id);
        // Same deferral for the NWC-backup offer (this is the NIP-46 path, which
        // can encrypt — so it's exactly the case the offer is for).
        markNwcBackupOfferPending(loginData.user.nostrPubkey);

        // Hide NIP-46 connect UI if still showing
        setShowNip46Connect(false);

        // Close modal and reload. Sync is deferred to post-reload via
        // markFavoritesSyncPending, so no delay needed.
        onClose();
        // Preserve wallet connection before reload (Android fix)
        await preserveWalletConnection();
        window.location.reload();
      } else {
        throw new Error(loginData.error || 'Login failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorDetails = err instanceof Error ? {
        name: err.name,
        message: err.message,
        stack: err.stack,
      } : err;

      console.error('❌ LoginModal: NIP-46 login failed:', {
        error: errorMessage,
        errorDetails,
        connectionState: {
          hasClient: !!client,
          hasConnection: !!client?.getConnection(),
          connectionPubkey: client?.getConnection()?.pubkey?.slice(0, 16) + '...',
        },
      });

      setError(errorMessage || 'Failed to complete NIP-46 login. Please check the error log for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct extension login — skips nostr-login dialog entirely for fastest login
  const handleExtensionLogin = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const nostr = (window as any).nostr;
      if (!nostr) {
        throw new Error('No Nostr extension detected. Please install one or use Sign In below.');
      }

      console.log('🔐 LoginModal: Direct extension login (fast path)...');

      // Get challenge and sign directly with the extension
      const { challenge, eventTemplate } = await prepareLoginEvent();
      const signedEvent = await nostr.signEvent(eventTemplate);
      console.log('✅ LoginModal: Extension signed event directly');

      const result = await processSignedLogin(
        signedEvent, challenge, 'extension', onClose
      );
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 2147483647 }}
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-gray-950 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700 relative max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 2147483647 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Sign in with Nostr</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* CARD MENU — pick a sign-in method */}
        {view === 'menu' && (
          <div className="grid grid-cols-1 gap-2 mb-4">
            {hasExtension && (
              <button
                onClick={handleExtensionLogin}
                disabled={isSubmitting}
                className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center gap-3"
              >
                <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 text-xl group-hover:bg-blue-500/30 transition-colors" aria-hidden>🔌</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white leading-tight">
                    {isSubmitting ? 'Signing in…' : 'Browser Extension'}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Sign in with Alby, NoStash, nos2x (fastest).
                  </p>
                </div>
              </button>
            )}
            <button
              onClick={() => { setError(null); setBunkerUri(''); setView('bunker'); }}
              disabled={isSubmitting}
              className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 group flex items-center gap-3"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20 text-xl group-hover:bg-emerald-500/30 transition-colors" aria-hidden>🔑</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white leading-tight">Bunker URI</div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Paste a <code className="text-stablekraft-teal">bunker://</code> URI from nsec.app, Alby.to, Keycast, Amber, etc.
                </p>
              </div>
            </button>
            <button
              onClick={() => { setError(null); setNip05Identifier(''); setView('nip05'); }}
              disabled={isSubmitting}
              className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 group flex items-center gap-3"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20 text-xl group-hover:bg-purple-500/30 transition-colors" aria-hidden>📇</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white leading-tight">NIP-05 Address</div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Browse as yourself, read-only. Enter <code className="text-stablekraft-teal">name@domain.com</code> — no signer needed.
                </p>
              </div>
            </button>
            <button
              onClick={() => { setError(null); setLoginMethod('amber'); setView('amber'); }}
              disabled={isSubmitting}
              className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 group flex items-center gap-3"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors" aria-hidden>
                <Image src="/amber-logo.png" alt="" width={32} height={32} className="w-8 h-8 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white leading-tight">Amber (Android)</div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Sign in with the Amber app — most popular Android signer.
                </p>
              </div>
            </button>
            <button
              onClick={() => { setError(null); setLoginMethod('primal'); setView('primal'); }}
              disabled={isSubmitting}
              className="w-full text-left p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-stablekraft-teal hover:bg-gray-700/70 transition-all disabled:opacity-50 group flex items-center gap-3"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden" aria-hidden>
                <Image src="/primal-logo.png" alt="" width={40} height={40} className="w-10 h-10 object-cover rounded-lg" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white leading-tight">Primal (QR code)</div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Scan with the Primal app on your phone.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* BUNKER URI view */}
        {view === 'bunker' && (
          <div className="mb-4">
            <button
              onClick={() => { setView('menu'); setError(null); }}
              className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Paste bunker:// or nostrconnect:// URI
            </label>
            <input
              type="text"
              value={bunkerUri}
              onChange={(e) => setBunkerUri(e.target.value)}
              placeholder="bunker://... or nostrconnect://..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-stablekraft-teal focus:border-transparent disabled:opacity-50 font-mono text-xs mb-2"
              autoFocus
            />
            <button
              onClick={handlePastedUriConnect}
              disabled={isSubmitting || !bunkerUri.trim()}
              className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isSubmitting ? 'Connecting…' : 'Connect'}
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Get a URI from your signer app: open nsec.app, Alby.to, Keycast, or Amber → export/share connection.
            </p>
          </div>
        )}

        {/* NIP-05 view */}
        {view === 'nip05' && (
          <div className="mb-4">
            <button
              onClick={() => { setView('menu'); setError(null); }}
              className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter your NIP-05 address
            </label>
            <input
              type="text"
              value={nip05Identifier}
              onChange={(e) => setNip05Identifier(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nip05Identifier.includes('@') && !isSubmitting) handleNip05Login(); }}
              placeholder="alice@example.com"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-stablekraft-teal focus:border-transparent disabled:opacity-50 mb-2"
              autoFocus
            />
            <button
              onClick={handleNip05Login}
              disabled={isSubmitting || !nip05Identifier.includes('@')}
              className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isSubmitting ? 'Connecting…' : 'Connect'}
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Read-only — you can see your profile and favorites. To boost or publish to Nostr, sign in with a signer (extension, Amber, Primal, or bunker).
            </p>
          </div>
        )}

        {/* PRIMAL QR view */}
        {view === 'primal' && (
          <div className="mb-4">
            <button
              onClick={() => { setView('menu'); setLoginMethod('nostr-login'); cleanupAmberConnection(); setError(null); }}
              className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>

            {isInitializingAmber && !showNip46Connect && (
              <div className="mb-4 flex flex-col items-center gap-3 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stablekraft-teal"></div>
                <p className="text-sm text-gray-200">Preparing Primal connection…</p>
              </div>
            )}

            {amberConnectionError && !showNip46Connect && !isInitializingAmber && (
              <div className="mb-4">
                <div className="p-3 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm mb-3">
                  {amberConnectionError}
                </div>
                <button
                  onClick={() => {
                    setAmberConnectionError(null);
                    setAmberConnectionInitialized(false);
                  }}
                  className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 font-medium transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {showNip46Connect && (
              <Nip46Connect
                connectionToken={nip46ConnectionToken}
                signerUrl={nip46SignerUrl}
                signerApp="primal"
                onConnected={() => {
                  setShowNip46Connect(false);
                  handleNip46Connected();
                }}
                onError={(error) => {
                  setError(error);
                  setIsSubmitting(false);
                  setShowNip46Connect(false);
                  setAmberConnectionInitialized(false);
                }}
                onCancel={() => {
                  cleanupAmberConnection();
                  setView('menu');
                  setLoginMethod('nostr-login');
                }}
              />
            )}

            {!isInitializingAmber && !amberConnectionError && !showNip46Connect && (
              <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <p className="text-sm text-gray-200">
                  <strong className="text-stablekraft-teal">Best for iOS:</strong> Primal auto-signs with Full trust and responds near-instantly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AMBER view */}
        {view === 'amber' && (
          <div className="mb-4">
            <button
              onClick={() => { setView('menu'); setLoginMethod('nostr-login'); cleanupAmberConnection(); setError(null); }}
              className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>

            {isInitializingAmber && !showNip46Connect && (
              <div className="mb-4 flex flex-col items-center gap-3 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stablekraft-teal"></div>
                <p className="text-sm text-gray-200">Preparing Amber connection…</p>
              </div>
            )}

            {amberConnectionError && !showNip46Connect && !isInitializingAmber && (
              <div className="mb-4">
                <div className="p-3 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm mb-3">
                  {amberConnectionError}
                </div>
                <button
                  onClick={() => {
                    setAmberConnectionError(null);
                    setAmberConnectionInitialized(false);
                  }}
                  className="w-full px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-teal/90 font-medium transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {showNip46Connect && (
              <Nip46Connect
                connectionToken={nip46ConnectionToken}
                signerUrl={nip46SignerUrl}
                signerApp="amber"
                onConnected={() => {
                  setShowNip46Connect(false);
                  handleNip46Connected();
                }}
                onError={(error) => {
                  setError(error);
                  setIsSubmitting(false);
                  setShowNip46Connect(false);
                  setAmberConnectionInitialized(false);
                }}
                onCancel={() => {
                  cleanupAmberConnection();
                  setView('menu');
                  setLoginMethod('nostr-login');
                }}
              />
            )}

            {!isInitializingAmber && !amberConnectionError && !showNip46Connect && (
              <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <p className="text-sm text-gray-200">
                  <strong className="text-stablekraft-teal">Best for Android:</strong> Amber is the most popular Android Nostr signer. Tap the button to open Amber, or scan the QR on another device.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // Render in portal to ensure it's above everything
  if (!mounted || typeof window === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}

