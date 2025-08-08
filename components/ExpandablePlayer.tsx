'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ChevronUp, QrCode, Share } from 'lucide-react';
import CDNImage from './CDNImage';
import QueueManager from './QueueManager';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';

interface ExpandablePlayerProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}

const ExpandablePlayer: React.FC<ExpandablePlayerProps> = ({ 
  isExpanded, 
  onToggleExpanded, 
  onClose 
}) => {
  const {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffleMode,
    repeatMode,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    playNextTrack,
    playPreviousTrack,
    toggleShuffle,
    toggleRepeat,
    stop
  } = useAudio();

  const [showQueue, setShowQueue] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSeekingMobile, setIsSeekingMobile] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentTrack = currentPlayingAlbum?.tracks?.[currentTrackIndex];
  
  // Format time helper
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar interaction
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const seekTime = percentage * duration;
    seek(seekTime);
  };

  // Handle mobile touch for progress
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsSeekingMobile(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSeekingMobile || !progressRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const seekTime = percentage * duration;
    seek(seekTime);
  };

  const handleTouchEnd = () => {
    setIsSeekingMobile(false);
  };

  // Get artwork URL
  const artworkUrl = currentTrack?.image 
    ? getAlbumArtworkUrl(currentTrack.image, 'large')
    : currentPlayingAlbum?.coverArt 
      ? getAlbumArtworkUrl(currentPlayingAlbum.coverArt, 'large')
      : getPlaceholderImageUrl('large');

  if (!currentPlayingAlbum || !currentTrack) {
    return null;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${
      isExpanded ? 'translate-y-0' : 'translate-y-full'
    }`}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        {/* Blurred background image */}
        <div 
          className="absolute inset-0 opacity-20 blur-3xl scale-110"
          style={{
            backgroundImage: `url(${artworkUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pt-safe-plus pt-12">
          <button
            onClick={onToggleExpanded}
            className="p-3 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 transition-colors"
          >
            <ChevronDown className="w-6 h-6 text-cyan-400" />
          </button>
          
          <div className="text-center">
            <p className="text-sm text-gray-300">Now Playing</p>
            <p className="text-lg font-semibold text-cyan-400">{currentPlayingAlbum.title}</p>
          </div>

          <button
            onClick={onClose}
            className="p-3 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 transition-colors"
          >
            <X className="w-6 h-6 text-cyan-400" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
          {/* Album Art */}
          <div className="relative mb-8 w-80 h-80 max-w-[70vw] max-h-[70vw] aspect-square">
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-cyan-400/20 bg-black/20 backdrop-blur-md border border-cyan-400/20">
              <CDNImage
                src={artworkUrl}
                alt={`${currentTrack.title} by ${currentPlayingAlbum.artist}`}
                width={320}
                height={320}
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                priority={true}
              />
              
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {/* Glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 rounded-3xl blur-xl -z-10" />
          </div>

          {/* Track Info */}
          <div className="text-center mb-8 max-w-full">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 line-clamp-2">
              {currentTrack.title}
            </h1>
            <h2 className="text-lg sm:text-xl text-cyan-400 mb-1 line-clamp-1">
              {currentPlayingAlbum.artist}
            </h2>
            <p className="text-sm text-gray-400 line-clamp-1">
              {currentPlayingAlbum.title}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full mb-6">
            <div 
              ref={progressRef}
              className="relative h-2 bg-gray-700/50 rounded-full cursor-pointer mb-2 backdrop-blur-sm"
              onClick={handleProgressClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
              </div>
            </div>
            
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 mb-8">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`p-3 rounded-full transition-colors ${
                isShuffleMode 
                  ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30' 
                  : 'bg-black/20 text-gray-400 hover:text-white border border-gray-600/30'
              } backdrop-blur-md`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Previous */}
            <button
              onClick={playPreviousTrack}
              className="p-4 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-md border border-gray-600/30"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? pause : resume}
              className="p-6 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 transition-all duration-200 shadow-lg shadow-cyan-400/30"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={playNextTrack}
              className="p-4 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-md border border-gray-600/30"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            {/* Repeat */}
            <button
              onClick={toggleRepeat}
              className={`p-3 rounded-full transition-colors backdrop-blur-md ${
                repeatMode !== 'off'
                  ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                  : 'bg-black/20 text-gray-400 hover:text-white border border-gray-600/30'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center gap-6 text-gray-400">
            {/* Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-black/30 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              
              <div className="hidden sm:flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Queue Toggle */}
            <button
              onClick={() => setShowQueue(!showQueue)}
              className={`p-2 rounded-full transition-colors ${
                showQueue ? 'text-cyan-400' : 'hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Queue */}
        {showQueue && (
          <div className="absolute inset-x-0 bottom-0 top-20 bg-black/80 backdrop-blur-lg">
            <QueueManager onClose={() => setShowQueue(false)} />
          </div>
        )}
      </div>

      {/* Styles for custom slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
        }
      `}</style>
    </div>
  );
};

export default ExpandablePlayer;