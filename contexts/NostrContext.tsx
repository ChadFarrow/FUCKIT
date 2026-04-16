'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
// Note: nostr-tools functions are imported via @/lib/nostr/keys when needed (lazy-loaded)
import { fetchAndStoreUserRelays, clearStoredUserRelays } from '@/lib/nostr/nip65';
import { normalizePubkey } from '@/lib/nostr/normalize';

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

