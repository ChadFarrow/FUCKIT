'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, Music } from 'lucide-react';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';
import CDNImage from './CDNImage';

interface AlbumCardProps {
  album: RSSAlbum;
  isPlaying: boolean;
  onPlay: (album: RSSAlbum, e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
}

export default function AlbumCard({ album, isPlaying, onPlay, className = '' }: AlbumCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Left swipe - play next track (future enhancement)
      console.log('Left swipe detected - next track');
    } else if (isRightSwipe) {
      // Right swipe - play previous track (future enhancement)
      console.log('Right swipe detected - previous track');
    } else {
      // Tap - play/pause
      onPlay(album, e);
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const artworkUrl = album.coverArt 
    ? getAlbumArtworkUrl(album.coverArt, 'medium')
    : getPlaceholderImageUrl('medium');
  
  // Debug logging for mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile) {
    console.log(`Mobile album card for "${album.title}": coverArt=${album.coverArt}, artworkUrl=${artworkUrl}`);
  }

  const albumUrl = generateAlbumUrl(album.title);

  return (
    <Link 
      href={albumUrl}
      className={`group relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98] block ${className}`}
      onClick={(e) => {
        console.log('🔗 Navigating to album:', albumUrl);
      }}
      aria-label={`View album details for ${album.title} by ${album.artist}`}
    >
      {/* Album Artwork */}
      <div 
        className="relative aspect-square overflow-hidden"
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
            console.log('🎵 Album artwork clicked - navigating to album page');
          }
        }}
      >
        <CDNImage
          src={artworkUrl}
          alt={`${album.title} by ${album.artist}`}
          width={300}
          height={300}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          priority={false}
        />
        
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
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

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay(album, e);
            }}
            className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors duration-200 touch-manipulation pointer-events-auto"
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
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-white">
            {album.tracks.length} track{album.tracks.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Album Info */}
      <div className="p-3">
        <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-blue-300 transition-colors duration-200">
          {album.title}
        </h3>
        <p className="text-gray-400 text-xs mt-1 line-clamp-1">
          {album.artist}
        </p>
        
        {/* Release date */}
        {album.releaseDate && (
          <p className="text-gray-500 text-xs mt-1">
            {new Date(album.releaseDate).getFullYear()}
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