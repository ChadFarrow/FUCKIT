'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useNostr } from '@/contexts/NostrContext';
import { getSessionId } from '@/lib/session-utils';
import { toast } from '@/components/Toast';
import { queueFavoritePublish, queueFavoriteDeletion } from '@/lib/nostr/publish-queue';
import { useBatchedFavorites } from '@/contexts/BatchedFavoritesContext';

// Helper hook that safely uses batched favorites, with fallback
function useBatchedFavoritesSafe() {
  try {
    return useBatchedFavorites();
  } catch (error) {
    // Context not available, return fallback functions
    return {
      checkFavorites: async (trackIds: string[], feedIds: string[]) => {
        // Fallback to individual check (shouldn't happen if provider is set up correctly)
        const currentSessionId = getSessionId();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (currentSessionId) {
          headers['x-session-id'] = currentSessionId;
        }
        const response = await fetch('/api/favorites/check', {
          method: 'POST',
          headers,
          body: JSON.stringify({ trackIds, feedIds })
        });
        if (response.ok) {
          const data = await response.json();
          return data.success ? data.data : { tracks: {}, albums: {} };
        }
        return { tracks: {}, albums: {} };
      },
      getFavoriteStatus: () => undefined
    };
  }
}

interface FavoriteButtonProps {
  trackId?: string;
  feedId?: string;
  className?: string;
  /** Classes for the heart itself when NOT favorited. The icon carries its own
      text colour, so a `text-*` on `className` can never reach it — pass it here. */
  iconClassName?: string;
  size?: number;
  onToggle?: (isFavorite: boolean) => void;
  isFavorite?: boolean; // Optional prop to set initial favorite state (useful on favorites page)
  // When feedId is provided and album has only 1 track, pass the track data here
  // The component will save as a track favorite instead of album favorite
  singleTrackData?: {
    id: string;        // Track ID (guid, url, or composite)
    title?: string;    // For Nostr publishing
    artist?: string;   // For Nostr publishing
  };
  // Determines which favorites tab the item appears in
  // Only 'publisher' if favoriting from the publishers filter page
  favoriteType?: 'album' | 'publisher' | 'playlist';
  // Feed GUID for auto-importing album when track not in database
  // Used for tracks from playlists like Top 100 that are resolved at runtime
  feedGuidForImport?: string;
}

export default function FavoriteButton({
  trackId,
  feedId,
  className = '',
  iconClassName = 'text-gray-400 hover:text-red-400',
  size = 24,
  onToggle,
  isFavorite: initialIsFavorite,
  singleTrackData,
  favoriteType = 'album',
  feedGuidForImport
}: FavoriteButtonProps) {
  const { sessionId, isLoading } = useSession();
  const { user, isAuthenticated: isNostrAuthenticated } = useNostr();
  const { checkFavorites, getFavoriteStatus } = useBatchedFavoritesSafe();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [isLoadingState, setIsLoadingState] = useState(initialIsFavorite === undefined);
  const [isToggling, setIsToggling] = useState(false);
  const [touchHandled, setTouchHandled] = useState(false);

  // Determine the API endpoint and ID
  // If singleTrackData is provided, treat this as a track favorite (for single-track albums)
  const effectiveTrackId = singleTrackData?.id || trackId;
  const itemId = effectiveTrackId || feedId;
  const isTrack = !!effectiveTrackId;
  const apiBase = isTrack ? '/api/favorites/tracks' : '/api/favorites/albums';

  // Check if item is favorited on mount (skip if isFavorite prop is provided)
  useEffect(() => {
    // If isFavorite prop is provided, skip the API check
    if (initialIsFavorite !== undefined) {
      setIsLoadingState(false);
      return;
    }

    const currentSessionId = sessionId || getSessionId();
    const currentUserId = isNostrAuthenticated && user ? user.id : null;
    
    if (isLoading || !itemId || (!currentSessionId && !currentUserId)) {
      setIsLoadingState(false);
      return;
    }

    // Check if we already have the status cached
    const cachedStatus = getFavoriteStatus(effectiveTrackId, feedId);
    if (cachedStatus !== undefined) {
      setIsFavorite(cachedStatus);
      setIsLoadingState(false);
      return;
    }

    // Use batched favorites check
    const checkFavorite = async () => {
      try {
        const result = await checkFavorites(
          isTrack ? [effectiveTrackId!] : [],
          !isTrack ? [feedId!] : []
        );
        
        const favoriteStatus = isTrack
          ? result.tracks[effectiveTrackId!] || false
          : result.albums[feedId!] || false;
        setIsFavorite(favoriteStatus);
      } catch (error) {
        console.error('Error checking favorite status:', error);
        // If tables don't exist yet, just show as not favorited
        setIsFavorite(false);
      } finally {
        setIsLoadingState(false);
      }
    };

    checkFavorite();
  }, [sessionId, itemId, effectiveTrackId, feedId, isTrack, isLoading, isNostrAuthenticated, user, checkFavorites, getFavoriteStatus]);

  const toggleFavorite = async () => {
    if (isToggling || isLoadingState || !itemId) {
      return;
    }

    // Get session ID or user ID
    const currentSessionId = sessionId || getSessionId();
    const currentUserId = isNostrAuthenticated && user ? user.id : null;
    
    if (!currentSessionId && !currentUserId) {
      toast.error('Unable to save favorite. Please refresh the page.');
      return;
    }

    // Check if user is logged in via NIP-05 (read-only mode)
    const isNip05Login = user?.loginType === 'nip05';
    const isAddingFavorite = !isFavorite;

    // NIP-05 users are read-only - they can view favorites but not add/remove them
    if (isNip05Login) {
      toast.error('NIP-05 login is read-only. To add or remove favorites, please use the extension login method.');
      return;
    }

    setIsToggling(true);
    const newFavoriteState = !isFavorite;

    // Optimistic update
    setIsFavorite(newFavoriteState);
    if (onToggle) {
      onToggle(newFavoriteState);
    }

    let responseStatus: number | undefined;
    
    try {
      if (newFavoriteState) {
        // Add to favorites
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (currentUserId) {
          headers['x-nostr-user-id'] = currentUserId;
        } else if (currentSessionId) {
          headers['x-session-id'] = currentSessionId;
        }

        // Save to DB immediately (without nostrEventId), then queue Nostr publish
        const response = await fetch(apiBase, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            [isTrack ? 'trackId' : 'feedId']: itemId,
            // Include type for album favorites to determine which tab it appears in
            ...(!isTrack ? { type: favoriteType } : {}),
            // Include feedGuid for auto-importing album when track not in database
            ...(isTrack && feedGuidForImport ? { feedGuidForImport } : {})
          })
        });

        responseStatus = response.status;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || 'Failed to add to favorites';
          const errorDetails = errorData.details || errorData.debug || '';
          const fullErrorMsg = errorDetails ? `${errorMsg}: ${errorDetails}` : errorMsg;
          console.error('Favorite API error:', {
            status: response.status,
            error: errorMsg,
            details: errorDetails,
            debug: errorData.debug
          });
          const error = new Error(fullErrorMsg);
          (error as any).status = response.status;
          throw error;
        }

        // Queue Nostr publish in background — PATCH eventId when it resolves
        if (isNostrAuthenticated && user && !isNip05Login) {
          const userRelays = user.relays && user.relays.length > 0 ? user.relays : undefined;
          const publishType = isTrack ? 'track' as const : 'album' as const;
          const publishId = isTrack ? effectiveTrackId! : feedId!;
          const publishTitle = isTrack ? singleTrackData?.title : undefined;
          const publishArtist = isTrack ? singleTrackData?.artist : undefined;

          queueFavoritePublish(publishType, publishId, publishTitle, publishArtist, userRelays)
            .then(async (nostrEventId) => {
              if (!nostrEventId) return;
              try {
                const patchRes = await fetch(apiBase, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(currentUserId ? { 'x-nostr-user-id': currentUserId } : {}),
                    ...(currentSessionId ? { 'x-session-id': currentSessionId } : {}),
                  },
                  body: JSON.stringify({
                    [isTrack ? 'trackId' : 'feedId']: itemId,
                    nostrEventId
                  })
                });
                if (patchRes.ok) {
                  window.dispatchEvent(new Event('favorites-synced'));
                }
              } catch (updateError) {
                console.warn('Failed to update favorite with Nostr event ID:', updateError);
              }
            })
            .catch((err) => console.warn('Failed to publish favorite to Nostr:', err));
        }
      } else {
        // Remove from favorites
        const headers: Record<string, string> = {};
        
        if (currentUserId) {
          headers['x-nostr-user-id'] = currentUserId;
        } else if (currentSessionId) {
          headers['x-session-id'] = currentSessionId;
        }

        // For DELETE, send trackId/feedId in the body instead of URL path
        // This handles cases where the ID is a full URL (https://...)
        const response = await fetch(apiBase, {
          method: 'DELETE',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            [isTrack ? 'trackId' : 'feedId']: itemId
          })
        });

        responseStatus = response.status;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || 'Failed to remove from favorites';
          const error = new Error(errorMsg);
          // Store status in error for better handling
          (error as any).status = response.status;
          throw error;
        }

        // Queue Nostr deletion fire-and-forget
        if (isNostrAuthenticated && user && !isNip05Login) {
          const responseData = await response.json().catch(() => ({}));
          const nostrEventId = responseData.nostrEventId;

          if (nostrEventId) {
            const userRelays = user.relays && user.relays.length > 0 ? user.relays : undefined;
            queueFavoriteDeletion(nostrEventId, userRelays)
              .catch((err) => console.warn('Failed to publish favorite deletion to Nostr:', err));
          }
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsFavorite(!newFavoriteState);
      if (onToggle) {
        onToggle(!newFavoriteState);
      }

      console.error('Error toggling favorite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update favorite';
      const status = (error instanceof Error && (error as any).status) || responseStatus;
      
      // Check if it's a database table error (503 = Service Unavailable = tables not initialized)
      const isTableError = status === 503 ||
                          errorMessage.includes('does not exist') || 
                          errorMessage.includes('Unknown model') ||
                          errorMessage.includes('not initialized') ||
                          errorMessage.includes('migration') ||
                          (error instanceof Error && error.message.includes('P2001'));
      
      // Don't show error toast if tables don't exist yet
      if (!isTableError) {
        toast.error(errorMessage);
      } else {
        // Silently fail - user can't do anything about missing tables
        console.warn('Favorites tables not initialized. Migration needed.');
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Skip if this click was triggered by a touch event (already handled)
    if (touchHandled) {
      setTouchHandled(false);
      return;
    }
    await toggleFavorite();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    // Mark that we're interacting with button
    (e.currentTarget as HTMLElement).dataset.touched = 'true';
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const button = e.currentTarget as HTMLElement;
    if (button.dataset.touched === 'true') {
      delete button.dataset.touched;
      // Mark that touch handled this - prevents duplicate onClick
      setTouchHandled(true);
      await toggleFavorite();
    }
  };

  if (isLoadingState || !itemId) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`favorite-button ${className} transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation ${
        isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'
      }`}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      disabled={isToggling}
    >
      <Heart
        size={size}
        className={`transition-colors duration-200 flex-shrink-0 ${
          isFavorite
            ? 'fill-red-500 text-red-500'
            : `fill-transparent ${iconClassName}`
        }`}
      />
    </button>
  );
}

