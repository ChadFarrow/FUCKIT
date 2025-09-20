'use client';

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, Music } from 'lucide-react';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';
import CDNImage from './CDNImage';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';

interface AlbumCardProps {
  album: RSSAlbum;
  isPlaying?: boolean;
  onPlay: (album: RSSAlbum, e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
}

function AlbumCard({ album, isPlaying = false, onPlay, className = '' }: AlbumCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const { shouldPreventClick } = useScrollDetectionContext();
  const cardRef = useRef<HTMLAnchorElement>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Left swipe - play next track (future enhancement)
    } else if (isRightSwipe) {
      // Right swipe - play previous track (future enhancement)
    } else {
      // Tap - play/pause, but check scroll detection first
      if (!shouldPreventClick()) {
        onPlay(album, e);
      }
    }
  }, [touchStart, touchEnd, shouldPreventClick, onPlay, album]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  // Progressive loading with staggered delays
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Get the card's position in the DOM to determine load order
            const cards = Array.from(document.querySelectorAll('[data-album-card]'));
            const cardIndex = cards.findIndex(card => card === entry.target);
            
            // Stagger image loading: load in batches of 3 with 100ms delays
            const batchIndex = Math.floor(cardIndex / 3);
            const delay = batchIndex * 100;
            
            setTimeout(() => {
              setShouldLoadImage(true);
            }, delay);
            
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '300px', // Start loading 300px before viewport
        threshold: 0.1
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const artworkUrl = useMemo(() => 
    getAlbumArtworkUrl(album.coverArt || '', 'thumbnail'), // Use smaller images for faster loading
    [album.coverArt]
  );
  
  // Check if this is a playlist card and use playlistUrl if available
  const { isPlaylistCard, albumUrl } = useMemo(() => {
    const isPlaylistCard = (album as any).isPlaylistCard;
    const albumUrl = isPlaylistCard ? (album as any).playlistUrl : generateAlbumUrl(album.title);
    return { isPlaylistCard, albumUrl };
  }, [album.title, (album as any).isPlaylistCard, (album as any).playlistUrl]);
  

  return (
    <Link 
      ref={cardRef}
      href={albumUrl}
      data-album-card
      className={`group relative bg-black/40 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden transition-all duration-300 hover:bg-black/50 hover:border-cyan-400/30 hover:scale-[1.02] active:scale-[0.98] block shadow-lg hover:shadow-xl hover:shadow-cyan-400/10 ${className}`}
      onClick={(e) => {
        // Navigation handled by Link component
      }}
      aria-label={`View album details for ${album.title} by ${album.artist}`}
    >
      {/* Album Artwork */}
      <div 
        className="relative w-full aspect-square overflow-hidden"
        onTouchStart={(e) => {
          // Only handle touch events on the artwork area, not on the play button
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchStart(e);
          }
        }}
        onTouchMove={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchMove(e);
          }
        }}
        onTouchEnd={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchEnd(e);
          }
        }}
        onClick={(e) => {
          // Prevent navigation when clicking on the artwork area (play button handles its own clicks)
          if (!(e.target as HTMLElement).closest('button')) {
            // Let the Link handle the navigation
          }
        }}
      >
        {shouldLoadImage ? (
          <CDNImage
            src={artworkUrl}
            alt={`${album.title} by ${album.artist}`}
            width={200}
            height={200}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ aspectRatio: '1/1' }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            priority={false}
            fallbackSrc={album.coverArt || undefined} // Add original URL as fallback
            sizes="(max-width: 768px) 160px, (max-width: 1200px) 180px, 200px"
          />
        ) : null}
        
        {/* Loading placeholder */}
        {(!shouldLoadImage || (!imageLoaded && !imageError)) && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Music className="w-8 h-8 text-gray-400 animate-pulse" />
          </div>
        )}
        
        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Music className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Play/Pause Overlay - Always visible on mobile, hover-based on desktop */}
        <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Use scroll detection context to prevent accidental clicks
              if (!shouldPreventClick()) {
                onPlay(album, e);
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              // Mark that we're interacting with button
              (e.currentTarget as HTMLElement).dataset.touched = 'true';
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const button = e.currentTarget as HTMLElement;
              if (button.dataset.touched === 'true') {
                delete button.dataset.touched;
                // Small delay to ensure it's a deliberate tap, not accidental during scroll
                setTimeout(() => {
                  if (!shouldPreventClick()) {
                    onPlay(album, e);
                  }
                }, 100);
              }
            }}
            className="w-16 h-16 md:w-12 md:h-12 bg-cyan-400/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-cyan-400/30 active:bg-cyan-400/40 transition-colors duration-200 touch-manipulation pointer-events-auto border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/20"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" />
            )}
          </button>
        </div>

        {/* Track count badge */}
        {album.tracks.length > 0 && (
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-black/80 backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-white border border-gray-600">
            {album.tracks.length} {album.tracks.length !== 1 ? 'tracks' : 'track'}
          </div>
        )}

        {/* HGH Music badge */}
        {(album as any).isHGHMusic && (
          <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-green-600/90 backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-white font-semibold border border-green-500/50">
            HGH
          </div>
        )}
      </div>

      {/* Album Info */}
      <div className="p-2 sm:p-3 bg-black/60 backdrop-blur-sm">
        <h3 className="font-bold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors duration-200">
          {album.title}
        </h3>
        <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-1 font-medium">
          {album.artist}
        </p>
        
        {/* Release date or episode date */}
        {(album.releaseDate || (album as any).isMusicTrackAlbum) && (
          <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium">
            {(album as any).isMusicTrackAlbum 
              ? new Date(album.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : new Date(album.releaseDate).getFullYear()
            }
          </p>
        )}
      </div>

      {/* Mobile touch feedback */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
      </div>
    </Link>
  );
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render if album id, title, isPlaying status, or className changes
export default memo(AlbumCard, (prevProps, nextProps) => {
  return (
    prevProps.album.id === nextProps.album.id &&
    prevProps.album.title === nextProps.album.title &&
    prevProps.album.artist === nextProps.album.artist &&
    prevProps.album.coverArt === nextProps.album.coverArt &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.className === nextProps.className &&
    prevProps.album.tracks.length === nextProps.album.tracks.length
  );
});