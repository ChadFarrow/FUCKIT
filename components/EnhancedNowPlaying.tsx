'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import CDNImage from '@/components/CDNImage';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { useAudio } from '@/contexts/AudioContext';
import { generateAlbumUrl } from '@/lib/url-utils';
import QueueManager from '@/components/QueueManager';

const EnhancedNowPlaying: React.FC = () => {
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
    isVideoMode,
    pause,
    resume,
    playNextTrack,
    playPreviousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    stop
  } = useAudio();

  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showBlurredBackground, setShowBlurredBackground] = useState(true);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            resume();
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            playPreviousTrack();
          } else if (e.shiftKey) {
            e.preventDefault();
            seek(Math.max(0, currentTime - 10)); // Skip back 10 seconds
          }
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            playNextTrack();
          } else if (e.shiftKey) {
            e.preventDefault();
            seek(Math.min(duration, currentTime + 10)); // Skip forward 10 seconds
          }
          break;
        case 'ArrowUp':
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.min(1, volume + 0.1));
          }
          break;
        case 'ArrowDown':
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.max(0, volume - 0.1));
          }
          break;
        case 'KeyM':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleMute();
          }
          break;
        case 'KeyS':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleShuffle();
          }
          break;
        case 'KeyR':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleRepeat();
          }
          break;
        case 'KeyQ':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowQueue(prev => !prev);
          }
          break;
        case 'Escape':
          if (showQueue) {
            e.preventDefault();
            setShowQueue(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, volume, showQueue, pause, resume, playNextTrack, playPreviousTrack, seek, setVolume, toggleMute, toggleShuffle, toggleRepeat]);

  // Set up MediaSession API for system controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentPlayingAlbum && currentPlayingAlbum.tracks[currentTrackIndex]) {
      const track = currentPlayingAlbum.tracks[currentTrackIndex];
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || currentPlayingAlbum.artist,
        album: currentPlayingAlbum.title,
        artwork: track.image || currentPlayingAlbum.coverArt ? [
          { 
            src: getAlbumArtworkUrl(track.image || currentPlayingAlbum.coverArt || '', 'medium'), 
            sizes: '256x256', 
            type: 'image/jpeg' 
          }
        ] : []
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      });

      // Update playback state
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      // Set position state for system progress bar
      if (duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: currentTime
        });
      }
    }
  }, [currentPlayingAlbum, currentTrackIndex, isPlaying, currentTime, duration, pause, resume, playNextTrack, playPreviousTrack, seek]);

  if (!currentPlayingAlbum || !currentPlayingAlbum.tracks[currentTrackIndex]) {
    return null;
  }

  const track = currentPlayingAlbum.tracks[currentTrackIndex];

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const handleProgressHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverPosition(percentage);
  };

  const handleProgressLeave = () => {
    setHoverPosition(null);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
          </svg>
        );
      case 'all':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        );
    }
  };

  const albumArtworkUrl = getAlbumArtworkUrl(track.image || currentPlayingAlbum.coverArt || '', 'medium');

  return (
    <div className={`fixed ${isExpanded ? 'inset-0' : 'bottom-0 left-0 right-0'} border-t border-gray-700 z-50 overflow-hidden transition-all duration-300 ease-in-out`}>
      {/* Blurred Background */}
      {showBlurredBackground && albumArtworkUrl && (
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${albumArtworkUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(25px) brightness(0.4) saturate(1.2)',
            }}
          />
          <div className="absolute inset-0 bg-gray-900 bg-opacity-85" />
        </div>
      )}
      
      <div className={`relative z-10 bg-gradient-to-r from-gray-900/80 to-black/80 backdrop-blur-sm transition-all duration-300 ${isExpanded ? 'h-full' : 'p-4'}`}>
        <div className="container mx-auto h-full">
          
          {isExpanded ? (
            /* Expanded View */
            <div className="flex flex-col h-full p-6">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-white">Now Playing</h1>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-full"
                  title="Minimize player"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>

              {/* Main content area - simplified for now */}
              <div className="flex-1 flex items-center justify-center">
                <div className="max-w-md w-full text-center">
                  <CDNImage 
                    src={getAlbumArtworkUrl(track.image || currentPlayingAlbum.coverArt || '', 'large')}
                    alt={track.title}
                    width={300}
                    height={300}
                    className="rounded-2xl object-cover w-72 h-72 shadow-2xl border border-gray-600/30 mx-auto mb-8"
                    fallbackSrc={getPlaceholderImageUrl('large')}
                  />
                  <h2 className="text-3xl font-bold text-white mb-2">{track.title}</h2>
                  <p className="text-xl text-gray-300 mb-4">{currentPlayingAlbum.title}</p>
                  <p className="text-lg text-gray-400">{track.artist || currentPlayingAlbum.artist}</p>
                </div>
              </div>
            </div>
          ) : (
        
        /* Compact View */
        <div className="flex items-center gap-4">
          {/* Album Info - Left Side */}
          <Link
            href={generateAlbumUrl(currentPlayingAlbum.title)}
            className="flex items-center gap-3 min-w-0 flex-1 hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors cursor-pointer"
          >
            <CDNImage 
              src={getAlbumArtworkUrl(track.image || currentPlayingAlbum.coverArt || '', 'thumbnail')}
              alt={track.title}
              width={48}
              height={48}
              className="rounded-lg object-cover w-12 h-12 flex-shrink-0"
              fallbackSrc={getPlaceholderImageUrl('thumbnail')}
            />
            <div className="min-w-0">
              <p className="font-bold truncate text-white">
                {track.title}
              </p>
              <p className="text-sm text-gray-400 truncate">
                {track.artist || currentPlayingAlbum.artist}
              </p>
              {isVideoMode && (
                <p className="text-xs text-stablekraft-teal">🎬 Video Mode</p>
              )}
            </div>
          </Link>

          {/* Expand button */}
          <button
            onClick={() => setIsExpanded(true)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-full"
            title="Expand player"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          </button>
          
          {/* Playback Controls - Center */}
          <div className="flex items-center justify-center gap-3 flex-1">
            {/* Shuffle Button */}
            <button
              onClick={toggleShuffle}
              className={`rounded-full p-2 transition-colors ${
                isShuffleMode 
                  ? 'bg-stablekraft-orange text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              title={isShuffleMode ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>
            
            <button
              onClick={playPreviousTrack}
              className="text-gray-400 hover:text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button
              onClick={isPlaying ? pause : resume}
              className="bg-gradient-to-r from-stablekraft-orange to-stablekraft-yellow hover:from-stablekraft-yellow hover:to-stablekraft-orange text-white rounded-full p-3 transition-all transform hover:scale-105"
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
              onClick={playNextTrack}
              className="text-gray-400 hover:text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            {/* Repeat Button */}
            <button
              onClick={toggleRepeat}
              className={`rounded-full p-2 transition-colors ${
                repeatMode !== 'off'
                  ? 'bg-stablekraft-teal text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {getRepeatIcon()}
            </button>
          </div>
          
          {/* Progress Bar and Controls - Right Side */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <span className="text-xs text-white w-12 text-right">
              {formatTime(currentTime)}
            </span>
            <div 
              className="flex-1 h-2 bg-gray-600 rounded-full cursor-pointer relative group"
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
            >
              {/* Current progress */}
              <div 
                className="h-full bg-gradient-to-r from-stablekraft-orange to-stablekraft-yellow rounded-full transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
              
              {/* Hover preview */}
              {hoverPosition !== null && (
                <div 
                  className="absolute top-0 left-0 h-full bg-stablekraft-orange/60 rounded-full pointer-events-none transition-all duration-75"
                  style={{ width: `${hoverPosition * 100}%` }}
                />
              )}
              
              {/* Hover time tooltip */}
              {hoverPosition !== null && (
                <div 
                  className="absolute -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
                  style={{ 
                    left: `${hoverPosition * 100}%`, 
                    transform: 'translateX(-50%)',
                    minWidth: 'max-content'
                  }}
                >
                  {formatTime(hoverPosition * duration)}
                </div>
              )}
            </div>
            <span className="text-xs text-white w-12 text-left">
              {formatTime(duration)}
            </span>
          </div>
          
          {/* Volume Control and Close Button */}
          <div className="flex items-center gap-3">
            {/* Volume Control - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {isMuted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : volume === 0 ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ff8c00 0%, #ff8c00 ${(isMuted ? 0 : volume) * 100}%, #4b5563 ${(isMuted ? 0 : volume) * 100}%, #4b5563 100%)`
                }}
              />
            </div>
            
            <button
              onClick={() => setShowQueue(true)}
              className="text-gray-400 hover:text-stablekraft-teal transition-colors"
              title="Show queue"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
              </svg>
            </button>

            {/* Background Toggle Button */}
            <button
              onClick={() => setShowBlurredBackground(!showBlurredBackground)}
              className={`transition-colors ${showBlurredBackground ? 'text-blue-400 hover:text-blue-300' : 'text-gray-400 hover:text-white'}`}
              title={`${showBlurredBackground ? 'Hide' : 'Show'} blurred background`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-4.18C14.4 2.84 13.3 2 12 2c-1.3 0-2.4.84-2.82 2H5c-.14 0-.27.01-.4.04-.39.08-.74.28-1.01.55-.18.18-.33.4-.43.64-.1.23-.16.49-.16.77v14c0 .27.06.54.16.78.1.23.25.45.43.64.27.27.62.47 1.01.55.13.02.26.03.4.03h14c.14 0 .27-.01.4-.04.39-.08.74-.28 1.01-.55.18-.18.33-.4.43-.64.1-.24.16-.5.16-.78V6c0-.28-.06-.54-.16-.78-.1-.23-.25-.45-.43-.64-.27-.27-.62-.47-1.01-.55-.13-.02-.26-.03-.4-.03zM12 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 15H5V6h14v13z"/>
              </svg>
            </button>
            
            <button
              onClick={stop}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="Stop playback"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Track Info */}
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            Track {currentTrackIndex + 1} of {currentPlayingAlbum.tracks.length} • {currentPlayingAlbum.title}
            {isShuffleMode && ' • Shuffle On'}
            {repeatMode !== 'off' && ` • Repeat ${repeatMode === 'one' ? 'One' : 'All'}`}
          </p>
          <p className="text-xs text-gray-600 mt-1" title="Keyboard shortcuts: Space=Play/Pause, ←/→=Prev/Next track, Shift+←/→=Skip 10s, Shift+↑/↓=Volume, Cmd/Ctrl+M=Mute, Cmd/Ctrl+S=Shuffle, Cmd/Ctrl+R=Repeat, Cmd/Ctrl+Q=Queue">
            💡 Use keyboard shortcuts for quick control
          </p>
        </div>
        
        </div>
        )}
        </div>
      </div>

      {/* Queue Manager Modal */}
      <QueueManager 
        isOpen={showQueue}
        onClose={() => setShowQueue(false)}
      />
    </div>
  );
};

export default EnhancedNowPlaying;
