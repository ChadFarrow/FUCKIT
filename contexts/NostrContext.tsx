'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
// Note: nostr-tools functions are imported via @/lib/nostr/keys when needed (lazy-loaded)
import { fetchAndStoreUserRelays, clearStoredUserRelays } from '@/lib/nostr/nip65';
import { normalizePubkey } from '@/lib/nostr/normalize';
import { SESSION_EXPIRED_EVENT, notifySessionExpired, isSessionExpiredResponse } from '@/lib/auth/session-expired';
import { toast } from '@/components/Toast';

export interface NostrUser {
  id: string;
  nostrPubkey: string;
  nostrNpub: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  lightningAddress?: string;
  relays: string[];
  nip05Verified?: boolean;
  loginType?: 'extension' | 'nip05' | 'nip46' | 'nip55' | 'nsecbunker'; // Track login method
}

interface NostrContextType {
  user: NostrUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  updateUser: (updates: Partial<NostrUser>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const NostrContext = createContext<NostrContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  logout: () => {},
  updateUser: async () => {},
  refreshUser: async () => {},
});

const NOSTR_USER_KEY = 'nostr_user';

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // iOS/Safari kills WebSockets when the tab is backgrounded. The NIP-46
  // relay socket is what carries sign_event requests to Primal/Amber/bunker.
  // Without this handler, tapping a heart or boosting from any page outside
  // the login modal hits a dead socket and the sign request silently hangs
  // until the wrapper times out. An equivalent handler already runs inside
  // LoginModal (useNip46Connection); this one keeps the connection alive
  // for every other page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loginType = user?.loginType;
    if (loginType !== 'nip46' && loginType !== 'nsecbunker') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      const { getUnifiedSigner } = await import('@/lib/nostr/signer');
      const client = getUnifiedSigner().getNIP46Client();
      if (!client) return;

      const { isIOS } = await import('@/lib/utils/device');
      const isiOSDevice = isIOS();

      try {
        const reconnected = await client.checkAndReconnectIfNeeded(isiOSDevice);
        if (reconnected) {
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
              client.checkAndReconnectIfNeeded(isiOSDevice).catch((retryErr) => {
                console.warn('NIP-46 retry reconnect failed:', retryErr);
              });
            },
          },
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.loginType]);

  // Run any favorites sync that was deferred from a login flow. The previous
  // pattern fired sync before window.location.reload(), which aborted the
  // in-flight fetches. Now completeLogin / NIP-46 login sets a localStorage
  // flag and we pick it up here on the stable post-reload page.
  useEffect(() => {
    if (!user?.id) return;
    const pendingUserId = localStorage.getItem('nostr_pending_favorites_sync');
    if (!pendingUserId || pendingUserId !== user.id) return;

    // Clear the flag first so we don't re-trigger if this effect re-runs.
    localStorage.removeItem('nostr_pending_favorites_sync');

    console.log('🔄 Running deferred favorites sync to Nostr...');
    import('@/lib/nostr/sync-favorites')
      .then(({ syncFavoritesToNostr }) => syncFavoritesToNostr(user.id))
      .then((results) => {
        if (!results) return;
        if (results.interrupted) return; // already warned inside
        console.log('✅ Favorites synced to Nostr:', results);
      })
      .catch((err) => console.error('❌ Error running deferred favorites sync:', err));
  }, [user?.id]);

  // Pull the shared cross-app favorites list (see the PC20-Nostr spec) once per
  // mount, so a favorite made in another app shows up here. Runs on every load
  // rather than only after login: the other app can change the list at any
  // time, and this is what makes it look like one list rather than two.
  //
  // Gated on a real signer. A `nip05` session is read-only and anyone can
  // "log in" as any identifier, so reconciling would let a stranger's list
  // delete this account's DB favorites.
  useEffect(() => {
    if (!user?.id || !user?.nostrPubkey) return;
    if (user.loginType === 'nip05') return;

    let cancelled = false;
    import('@/lib/nostr/favorites-sync-client')
      .then(({ pullSharedFavorites }) =>
        pullSharedFavorites({
          userId: user.id,
          pubkey: user.nostrPubkey,
          relays: user.relays && user.relays.length > 0 ? user.relays : undefined,
        })
      )
      .then((result) => {
        if (cancelled || result.status !== 'ok') return;
        const changed = (result.added?.albums ?? 0) + (result.added?.tracks ?? 0)
          + (result.removed?.albums ?? 0) + (result.removed?.tracks ?? 0);
        if (changed > 0) {
          console.log('✅ Shared favorites reconciled:', result.added, result.removed);
        }
      })
      .catch((err) => console.warn('⚠️ Shared favorites pull failed:', err));

    return () => { cancelled = true; };
    // `relays` joined rather than passed by reference: it's an array on a state
    // object, so a profile refresh that returns an equal list would otherwise
    // re-fire a full relay read + reconcile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.nostrPubkey, user?.loginType, (user?.relays || []).join(',')]);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(NOSTR_USER_KEY);

      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 NostrContext: Loading from localStorage', {
          hasUser: !!storedUser,
        });
      }

      // Load user (extension or NIP-05 login)
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData.nostrPubkey) {
            const hex = normalizePubkey(userData.nostrPubkey);
            if (hex) userData.nostrPubkey = hex;
          }
          // Get login type from localStorage
          const loginType = localStorage.getItem('nostr_login_type') as 'extension' | 'nip05' | 'nip46' | 'nip55' | 'nsecbunker' | null;
          if (loginType) {
            userData.loginType = loginType;
          }
          setUser(userData);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ NostrContext: User loaded from localStorage', {
              userId: userData.id,
              npub: userData.nostrNpub?.slice(0, 16) + '...',
              loginType: userData.loginType || 'extension',
            });
          }

          // Fetch user's NIP-65 relay list in the background
          if (userData.nostrPubkey) {
            fetchAndStoreUserRelays(userData.nostrPubkey).then((relays) => {
              if (relays) {
                console.log(`✅ NostrContext: Fetched ${relays.write.length} write relays for user`);
              }
            }).catch((err) => {
              console.warn('⚠️ NostrContext: Failed to fetch user relays:', err);
            });
          }
        } catch (parseError) {
          console.error('❌ NostrContext: Failed to parse user data:', parseError);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️ NostrContext: No stored user found');
        }
      }
    } catch (error) {
      console.error('❌ NostrContext: Error loading user from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh profile data when user is loaded without a displayName.
  // The login API intentionally returns null profile fields to avoid a slow
  // relay round-trip during login — this effect backfills them afterward.
  const profileRefreshAttempted = useRef(false);

  useEffect(() => {
    if (!isLoading && user && !user.displayName && !profileRefreshAttempted.current) {
      profileRefreshAttempted.current = true;
      console.log('🔄 NostrContext: Auto-refreshing profile data from Nostr relays...');
      refreshUser();
    }
  }, [isLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps -- refreshUser is stable for the initial call

  // Sync user with server - fetches from Nostr relays first (source of truth)
  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/nostr/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-nostr-user-id': user.id, // Send user ID to fetch from Nostr relays
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          if (data.user.nostrPubkey) {
            const { normalizePubkey } = await import('@/lib/nostr/normalize');
            const hex = normalizePubkey(data.user.nostrPubkey);
            if (hex) data.user.nostrPubkey = hex;
          }
          // Preserve loginType from localStorage if not in response
          const storedLoginType = localStorage.getItem('nostr_login_type') as 'extension' | 'nip05' | 'nip46' | 'nip55' | 'nsecbunker' | null;
          if (storedLoginType && !data.user.loginType) {
            data.user.loginType = storedLoginType;
          }
          setUser(data.user);
          localStorage.setItem(NOSTR_USER_KEY, JSON.stringify(data.user));
        }
      }
    } catch (error) {
      console.error('Error refreshing Nostr user:', error);
    }
  }, [user]);


  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(NOSTR_USER_KEY);
    localStorage.removeItem('nostr_login_type'); // Remove login type
    clearStoredUserRelays(); // Clear NIP-65 relay list
    setUser(null);

    // Clean up NIP-46 signer and connection state so the next login starts fresh
    import('@/lib/nostr/signer').then(({ resetUnifiedSigner }) => {
      resetUnifiedSigner().catch(err => {
        console.warn('Failed to reset signer on logout:', err);
      });
    }).catch(err => {
      console.warn('Failed to import signer module on logout:', err);
    });

    // Clear saved NIP-46 connection data from localStorage
    import('@/lib/nostr/nip46-storage').then(({ clearNIP46Connection }) => {
      clearNIP46Connection();
    }).catch(err => {
      console.warn('Failed to clear NIP-46 connection on logout:', err);
    });

    // Call logout API
    fetch('/api/nostr/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(err => {
      console.error('Logout API error:', err);
    });
  }, []);

  // Users who logged in before session cookies existed hold `nostr_user` in
  // localStorage but no cookie. Probe once on mount; if the session is stale,
  // clear it and let the normal logged-out UI prompt a fresh login. One signer
  // approval, once. There is deliberately no compatibility window: accepting
  // the legacy header for a grace period would leave the hole fully open for
  // its duration, since an attacker simply omits the cookie.
  useEffect(() => {
    if (!user) return;
    // A nip05 session deliberately has no cookie: that login resolves a pubkey
    // from a caller-named /.well-known/nostr.json and proves nothing about who
    // is asking, so issuing a credential for it would let anyone read any
    // account. It is a public-data-only convenience, so there is no session to
    // probe — and a 401 here is expected, not stale. Probing anyway would log
    // these users out on every load once SESSION_SECRET is set.
    if (user.loginType === 'nip05') return;
    let cancelled = false;

    (async () => {
      try {
        // Send the legacy header so this probe fails open exactly like every
        // migrated route does when SESSION_SECRET is unset. Without it the
        // probe 401s in that configuration and logs the user out in a loop.
        const res = await fetch('/api/nostr/auth/session', {
          headers: { 'x-nostr-user-id': user.id },
        });
        if (cancelled || res.ok) return;
        const body = await res.json().catch(() => null);
        if (isSessionExpiredResponse(res.status, body)) {
          notifySessionExpired();
          logout();
        }
      } catch {
        // Offline or a transient failure is not an expired session. Leave the
        // user signed in; the next load re-probes.
      }
    })();

    return () => { cancelled = true; };
  }, [user, logout]);

  useEffect(() => {
    const onExpired = () => {
      toast.info('Please sign in again — we upgraded how sessions are secured.', {
        duration: 8000,
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Update user
  const updateUser = useCallback(async (updates: Partial<NostrUser>) => {
    if (!user) return;

    try {
      const response = await fetch('/api/nostr/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Preserve loginType when updating
          const currentLoginType = user?.loginType || localStorage.getItem('nostr_login_type') as 'extension' | 'nip05' | 'nip46' | 'nip55' | 'nsecbunker' | null;
          if (currentLoginType && !data.user.loginType) {
            data.user.loginType = currentLoginType;
          }
          setUser(data.user);
          localStorage.setItem(NOSTR_USER_KEY, JSON.stringify(data.user));
        }
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [user]);

  return (
    <NostrContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr() {
  const context = useContext(NostrContext);

  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }

  return context;
}

