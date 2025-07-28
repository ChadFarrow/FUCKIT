'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';

interface Track {
  title: string;
  artist: string;
  duration: number;
  albumArt?: string;
}

interface NowPlayingProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}

const NowPlaying: React.FC<NowPlayingProps> = ({
  track,
  isPlaying,
  currentTime,
  volume,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onClose
}) => {
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * track.duration;
    onSeek(newTime);
  };

  const generateAlbumUrl = (albumTitle: string): string => {
    return `/album/${encodeURIComponent(albumTitle)}`;
  };

  return (
    <div className="container mx-auto flex items-center gap-4">
      {/* Album Info - Left Side */}
      <Link
        href={generateAlbumUrl(track.title)}
        className="flex items-center gap-3 min-w-0 flex-1 hover:bg-gray-700 rounded-lg p-2 -m-2 transition-colors cursor-pointer"
      >
        <Image 
          src={track.albumArt ? getAlbumArtworkUrl(track.albumArt, 'thumbnail') : getPlaceholderImageUrl('thumbnail')} 
          alt={track.title}
          width={48}
          height={48}
          className="rounded-lg object-cover w-12 h-12 flex-shrink-0"
          style={{ objectFit: 'cover' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = getPlaceholderImageUrl('thumbnail');
          }}
        />
        <div className="min-w-0">
          <p className="font-bold truncate text-white">
            {track.title}
          </p>
          <p className="text-sm text-gray-400 truncate">
            {track.artist}
          </p>
        </div>
      </Link>
      
      {/* Playback Controls - Perfectly Centered */}
      <div className="flex items-center justify-center gap-3 flex-1">
        <button
          onClick={onPrevious}
          className="bg-gray-600 hover:bg-gray-500 text-white rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <button
          onClick={onPlayPause}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full p-3 transition-all"
          style={{ width: '48px', height: '48px' }}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <button
          onClick={onNext}
          className="bg-gray-600 hover:bg-gray-500 text-white rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
      
      {/* Progress Bar - Right Side */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <span className="text-xs text-white w-12 text-right">
          {formatTime(currentTime)}
        </span>
        <div 
          className="flex-1 h-2 bg-gray-600 rounded-full cursor-pointer relative group"
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-orange-500 rounded-full transition-all duration-100"
            style={{ width: `${track.duration ? (currentTime / track.duration) * 100 : 0}%` }}
          />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-full bg-orange-400 rounded-full" />
          </div>
        </div>
        <span className="text-xs text-white w-12 text-left">
          {formatTime(track.duration)}
        </span>
      </div>
      
      {/* Volume Control and Close Button - Hide volume on mobile */}
      <div className="flex items-center gap-3">
        {/* Volume Control - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, white 0%, white ${volume * 100}%, #4b5563 ${volume * 100}%, #4b5563 100%)`
            }}
          />
        </div>
        
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NowPlaying; 