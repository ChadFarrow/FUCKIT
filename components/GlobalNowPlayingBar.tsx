'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAudio } from '@/contexts/AudioContext';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';

const GlobalNowPlayingBar: React.FC = () => {
  const {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop
  } = useAudio();

  // Don't render if nothing is playing
  if (!currentPlayingAlbum) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    seek(newTime);
  };

  const generateAlbumUrl = (albumTitle: string): string => {
    return `/album/${encodeURIComponent(albumTitle)}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/20 p-4 z-50 shadow-2xl">
      <div className="container mx-auto flex items-center gap-4 bg-gray-900 rounded-xl p-4 border border-white/20">
        {/* Current Album Info - Clickable */}
        <Link
          href={generateAlbumUrl(currentPlayingAlbum.title)}
          className="flex items-center gap-3 min-w-0 flex-1 hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors cursor-pointer"
        >
          <Image 
            src={getAlbumArtworkUrl(currentPlayingAlbum.coverArt || '', 'thumbnail')} 
            alt={currentPlayingAlbum.title}
            width={48}
            height={48}
            className="rounded object-cover w-12 h-12 flex-shrink-0"
            style={{ objectFit: 'cover' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = getPlaceholderImageUrl('thumbnail');
            }}
          />
          <div className="min-w-0">
            <p className="font-medium truncate">
              {currentPlayingAlbum.tracks?.[currentTrackIndex]?.title || `Track ${currentTrackIndex + 1}`}
            </p>
            <p className="text-sm text-gray-400 truncate">
              {currentPlayingAlbum.title}
            </p>
          </div>
        </Link>
        
        {/* Progress Bar - Between Album Info and Controls */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <span className="text-xs text-gray-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div 
            className="flex-1 h-2 bg-gray-700 rounded-full cursor-pointer relative group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-gray-600 rounded-full" />
            </div>
          </div>
          <span className="text-xs text-gray-400 w-12 text-left">
            {formatTime(duration)}
          </span>
        </div>
        
        {/* Playback Controls */}
        <div className="flex items-center gap-3">
            <button
              onClick={playPreviousTrack}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button
              onClick={isPlaying ? pause : resume}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button
              onClick={playNextTrack}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
            
            {/* Close Button */}
            <button
              onClick={stop}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
      </div>
    </div>
  );
};

export default GlobalNowPlayingBar; 