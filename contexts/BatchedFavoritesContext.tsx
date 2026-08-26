'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useNostr } from '@/contexts/NostrContext';
import { getSessionId } from '@/lib/session-utils';
import {
  dropClobberedKeys,
  EMPTY_FAVORITE_STATUSES,
  FAVORITE_STATUSES_INVALIDATED_EVENT,
  favoritesIdentityKey,
  localWriteKey,
  mergeFavoriteStatuses,
  selectUnknownIds,
  withFavoriteStatus,
  type FavoriteKind,
  type FavoriteStatusMap,
} from '@/lib/favorite-status-cache';

interface BatchedFavoritesContextType {
  checkFavorites: (trackIds: string[], feedIds: string[]) => Promise<{ tracks: Record<string, boolean>; albums: Record<string, boolean> }>;
  getFavoriteStatus: (trackId?: string, feedId?: string) => boolean | undefined;
  /**
   * Record an answer we already know, without asking the server.
   *
   * Anything that changes whether an item is favorited MUST call this. A
   * cached `false` is a KNOWN answer — `checkFavorites` short-circuits on it —
   * so a writer that updates only its own component state leaves the cache
   * lying for the lifetime of the page. That was issue #190: favorite from the
   * home grid, navigate to /favorites, heart unfilled, and no request made.
   */
  setFavoriteStatus: (kind: FavoriteKind, id: string | null | undefined, value: boolean) => void;
}

const BatchedFavoritesContext = createContext<BatchedFavoritesContextType | null>(null);

export function BatchedFavoritesProvider({ children }: { children: React.ReactNode }) {
  const { sessionId, isLoading: sessionLoading } = useSession();
  const { user, isAuthenticated: isNostrAuthenticated } = useNostr();
  const [favoriteStatuses, setFavoriteStatuses] = useState<FavoriteStatusMap>(EMPTY_FAVORITE_STATUSES);

  /**
   * Which identity the cached answers belong to. Derived the same way the API
   * scopes its queries, so it changes exactly when the answers stop being
   * valid — see `favoritesIdentityKey`.
   */
  const identityKey = favoritesIdentityKey({
    userId: isNostrAuthenticated && user ? user.id : null,
    sessionId,
  });
  const identityKeyRef = useRef(identityKey);

  const pendingChecks = useRef<{
    trackIds: Set<string>;
    feedIds: Set<string>;
    resolvers: Array<{
      resolve: (value: { tracks: Record<string, boolean>; albums: Record<string, boolean> }) => void;
      reject: (error: Error) => void;
    }>;
  }>({ trackIds: new Set(), feedIds: new Set(), resolvers: [] });
  
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  /**
   * Local-write bookkeeping, so an answer that was already in flight when the
   * user toggled can't overwrite it. See `dropClobberedKeys`. Monotonic across
   * cache clears — resetting it would let a stale `seqAtStart` compare wrong.
   */
  const seqRef = useRef(0);
  const localWritesRef = useRef<Record<string, number>>({});

  /**
   * Drop every cached answer when the identity changes.
   *
   * The common case is `NostrContext` hydrating after the first checks have
   * already gone out: those were scoped to the session, and `sync-shared`
   * writes rows with a `userId` and no `sessionId`, so they came back `false`
   * for favorites that genuinely exist. Nothing else expires them, so without
   * this they would outlive the sign-in for the lifetime of the page.
   *
   * The first run is a no-op — a fresh mount must not discard a batch that
   * has already landed.
   */
  useEffect(() => {
    const previous = identityKeyRef.current;
    identityKeyRef.current = identityKey;
    if (previous === identityKey) return;

    // Local writes belonged to the old identity too. `seqRef` stays monotonic
    // so an in-flight request's captured value can't compare wrong.
    localWritesRef.current = {};
    setFavoriteStatuses(EMPTY_FAVORITE_STATUSES);
  }, [identityKey]);

  /**
   * Bulk writers (the favorites reconcile, delete-all) can change what
   * is favorited without naming the ids, so they empty the cache instead of
   * writing through. See FAVORITE_STATUSES_INVALIDATED_EVENT.
   */
  useEffect(() => {
    const onInvalidated = () => {
      localWritesRef.current = {};
      setFavoriteStatuses(EMPTY_FAVORITE_STATUSES);
    };
    window.addEventListener(FAVORITE_STATUSES_INVALIDATED_EVENT, onInvalidated);
    return () => window.removeEventListener(FAVORITE_STATUSES_INVALIDATED_EVENT, onInvalidated);
  }, []);

  const executeBatchCheck = useCallback<() => Promise<void>>(async () => {
    const hasPending =
      pendingChecks.current.trackIds.size > 0 || pendingChecks.current.feedIds.size > 0;
    if (!hasPending) {
      return;
    }

    // A batch is already in flight. Re-arm rather than returning: this used to
    // drop out and leave the queued ids AND their resolvers stranded with no
    // timer scheduled, so those buttons stayed in their loading state —
    // rendering nothing at all — until an unrelated check happened to flush
    // the queue for them.
    if (isCheckingRef.current) {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(() => {
        executeBatchCheck();
      }, 50);
      return;
    }

    isCheckingRef.current = true;
    const { trackIds, feedIds, resolvers } = pendingChecks.current;
    
    // Clear pending checks
    pendingChecks.current = { trackIds: new Set(), feedIds: new Set(), resolvers: [] };
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    const currentSessionId = sessionId || getSessionId();
    const currentUserId = isNostrAuthenticated && user ? user.id : null;

    if (!currentSessionId && !currentUserId) {
      // No session, resolve all with false
      const emptyResult = {
        tracks: Object.fromEntries(Array.from(trackIds).map(id => [id, false])),
        albums: Object.fromEntries(Array.from(feedIds).map(id => [id, false]))
      };
      resolvers.forEach(({ resolve }) => resolve(emptyResult));
      isCheckingRef.current = false;
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (currentUserId) {
        headers['x-nostr-user-id'] = currentUserId;
      } else if (currentSessionId) {
        headers['x-session-id'] = currentSessionId;
      }

      // The scope this question is being asked under. If it changes while the
      // request is in flight the answer is about somebody else and must not be
      // cached — the resolvers still settle so no button hangs, and the
      // identity change re-runs every check effect, which re-asks correctly.
      const requestIdentity = identityKeyRef.current;
      // Anything the user writes locally after this point outranks the answer.
      const seqAtRequestStart = seqRef.current;

      const response = await fetch('/api/favorites/check', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trackIds: Array.from(trackIds),
          feedIds: Array.from(feedIds)
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (identityKeyRef.current === requestIdentity) {
            setFavoriteStatuses(prev => mergeFavoriteStatuses(
              prev,
              dropClobberedKeys(data.data, localWritesRef.current, seqAtRequestStart)
            ));
          }

          // Resolve all pending promises
          resolvers.forEach(({ resolve }) => resolve(data.data));
        } else {
          throw new Error('Failed to check favorites');
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error checking favorites:', error);
      // Resolve all with false on error
      const errorResult = {
        tracks: Object.fromEntries(Array.from(trackIds).map(id => [id, false])),
        albums: Object.fromEntries(Array.from(feedIds).map(id => [id, false]))
      };
      resolvers.forEach(({ resolve }) => resolve(errorResult));
    } finally {
      isCheckingRef.current = false;
    }
  }, [sessionId, isNostrAuthenticated, user]);

  const checkFavorites = useCallback((trackIds: string[], feedIds: string[]): Promise<{ tracks: Record<string, boolean>; albums: Record<string, boolean> }> => {
    return new Promise((resolve, reject) => {
      // Filter out IDs we already have in state. A cached `false` counts as
      // known — which is why every writer has to go through setFavoriteStatus.
      const newTrackIds = selectUnknownIds(trackIds, favoriteStatuses.tracks);
      const newFeedIds = selectUnknownIds(feedIds, favoriteStatuses.albums);

      // If we already have all the statuses, return immediately
      if (newTrackIds.length === 0 && newFeedIds.length === 0) {
        const result = {
          tracks: Object.fromEntries(trackIds.map(id => [id, favoriteStatuses.tracks[id] || false])),
          albums: Object.fromEntries(feedIds.map(id => [id, favoriteStatuses.albums[id] || false]))
        };
        resolve(result);
        return;
      }

      // Add to pending checks
      newTrackIds.forEach(id => pendingChecks.current.trackIds.add(id));
      newFeedIds.forEach(id => pendingChecks.current.feedIds.add(id));
      pendingChecks.current.resolvers.push({ resolve, reject });

      // Clear existing timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      // Set new timeout to batch requests (50ms debounce)
      batchTimeoutRef.current = setTimeout(() => {
        executeBatchCheck();
      }, 50);
    });
  }, [favoriteStatuses, executeBatchCheck]);

  // Stable by construction (the state setter is), so adding this to a
  // consumer's effect deps can't churn it.
  const setFavoriteStatus = useCallback((kind: FavoriteKind, id: string | null | undefined, value: boolean) => {
    if (!id) return;

    seqRef.current += 1;
    localWritesRef.current[localWriteKey(kind, id)] = seqRef.current;
    setFavoriteStatuses(prev => withFavoriteStatus(prev, kind, id, value));
  }, []);

  const getFavoriteStatus = useCallback((trackId?: string, feedId?: string): boolean | undefined => {
    if (trackId && trackId in favoriteStatuses.tracks) {
      return favoriteStatuses.tracks[trackId];
    }
    if (feedId && feedId in favoriteStatuses.albums) {
      return favoriteStatuses.albums[feedId];
    }
    return undefined;
  }, [favoriteStatuses]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  // Memoized: an inline literal is a NEW object on every provider render, so
  // every consumer re-rendered whenever anything above this provider did —
  // and there is one FavoriteButton per album card. `getFavoriteStatus`
  // legitimately changes with `favoriteStatuses`; the other two are stable.
  const value = useMemo(
    () => ({ checkFavorites, getFavoriteStatus, setFavoriteStatus }),
    [checkFavorites, getFavoriteStatus, setFavoriteStatus]
  );

  return (
    <BatchedFavoritesContext.Provider value={value}>
      {children}
    </BatchedFavoritesContext.Provider>
  );
}

export function useBatchedFavorites() {
  const context = useContext(BatchedFavoritesContext);
  if (!context) {
    throw new Error('useBatchedFavorites must be used within BatchedFavoritesProvider');
  }
  return context;
}

