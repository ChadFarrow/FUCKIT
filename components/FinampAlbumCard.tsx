'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import CDNImage from '@/components/CDNImage';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';
import { useAudio } from '@/contexts/AudioContext';

interface Track {
  title: string;
  artist?: string;
  duration?: number | string;
  startTime?: number | string;
  endTime?: number | string;
  image?: string;
}

interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  coverArt?: string;
  tracks: Track[];
  description?: string;
  genre?: string;
}

interface FinampAlbumCardProps {
  album: Album;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const FinampAlbumCard: React.FC<FinampAlbumCardProps> = ({ 
  album, 
  showText = true,
  size = 'medium'
}) => {
  const { playAlbum } = useAudio();
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    small: 'w-32 h-32',
    medium: 'w-40 h-40 md:w-48 md:h-48',
    large: 'w-48 h-48 md:w-64 md:h-64'
  };

  const handlePlayAlbum = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playAlbum(album, 0);
  };

  return (
    <div className="finamp-album-card-container">
      <Link href={generateAlbumUrl(album.title)} className="block">
        <div 
          className={`finamp-album-card ${sizeClasses[size]} group relative`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Album artwork */}
          <div className="relative w-full h-full overflow-hidden" style={{borderRadius: 'var(--finamp-radius-xs)'}}>
            <CDNImage
              src={getAlbumArtworkUrl(album.coverArt || '', 'medium')}
              alt={album.title}
              width={size === 'large' ? 256 : size === 'medium' ? 192 : 128}
              height={size === 'large' ? 256 : size === 'medium' ? 192 : 128}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isHovered ? 'scale-105' : 'scale-100'
              } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              fallbackSrc={getPlaceholderImageUrl('medium')}
              onLoad={() => setImageLoaded(true)}
            />
            
            {/* Loading skeleton */}
            {!imageLoaded && (
              <div 
                className="absolute inset-0 animate-pulse"
                style={{backgroundColor: 'var(--finamp-surface-variant)'}}
              />
            )}

            {/* Hover overlay with play button */}
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))'
              }}
            >
              <button
                onClick={handlePlayAlbum}
                className="finamp-button finamp-button--filled transform transition-all duration-200 hover:scale-110"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--finamp-primary)',
                  color: 'var(--finamp-on-primary)',
                  boxShadow: 'var(--finamp-shadow-3)'
                }}
                aria-label={`Play ${album.title}`}
              >
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>

            {/* Material Design elevation shadow */}
            <div 
              className={`absolute inset-0 pointer-events-none transition-all duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                boxShadow: 'var(--finamp-shadow-4)',
                borderRadius: 'var(--finamp-radius-xs)'
              }}
            />
          </div>
        </div>
      </Link>

      {/* Text overlay (Finamp style) */}
      {showText && (
        <div className="mt-3 space-y-1">
          <Link href={generateAlbumUrl(album.title)} className="block">
            <h3 
              className="finamp-title-medium text-left leading-tight hover:underline"
              style={{
                color: 'var(--finamp-on-surface)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: size === 'small' ? '13px' : '14px',
                lineHeight: size === 'small' ? '1.3' : '1.4'
              }}
            >
              {album.title}
            </h3>
          </Link>
          
          <p 
            className="finamp-body-small text-left"
            style={{
              color: 'var(--finamp-on-surface-variant)',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: size === 'small' ? '12px' : '13px'
            }}
          >
            {album.artist}
            {album.year && ` • ${album.year}`}
          </p>

          {/* Track count and duration info */}
          <p 
            className="finamp-label-small text-left"
            style={{
              color: 'var(--finamp-on-surface-variant)',
              opacity: 0.7,
              fontSize: '11px'
            }}
          >
            {album.tracks.length} track{album.tracks.length !== 1 ? 's' : ''}
            {album.genre && ` • ${album.genre}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default FinampAlbumCard;
