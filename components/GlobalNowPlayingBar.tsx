'use client';

import React, { useState } from 'react';
import NowPlaying from './NowPlaying';
import ExpandablePlayer from './ExpandablePlayer';
import { useAudio } from '@/contexts/AudioContext';

const GlobalNowPlayingBar: React.FC = () => {
  const {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    isShuffleMode,
    isPlayerExpanded,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop,
    toggleShuffle,
    togglePlayerExpanded,
    setPlayerExpanded
  } = useAudio();

  const [volume, setVolume] = useState(0.6);

  // Don't render if nothing is playing
  if (!currentPlayingAlbum) {
    return null;
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleSeek = (time: number) => {
    seek(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // TODO: Implement volume control in AudioContext
  };

  const handleClose = () => {
    stop();
    setPlayerExpanded(false);
  };

  const handleExpand = () => {
    togglePlayerExpanded();
  };

  // Create track object for NowPlaying component
  const currentTrack = {
    title: currentPlayingAlbum.tracks?.[currentTrackIndex]?.title || `Track ${currentTrackIndex + 1}`,
    artist: currentPlayingAlbum.artist,
    albumTitle: currentPlayingAlbum.title,
    duration: duration || 0,
    // Prioritize individual track image, fallback to album coverArt
    albumArt: currentPlayingAlbum.tracks?.[currentTrackIndex]?.image || currentPlayingAlbum.coverArt || ''
  };

  // Debug logging in development - removed to prevent excessive logging
  // if (process.env.NODE_ENV === 'development') {
  //   console.log('🎵 Now Playing Track Data:', {
  //     title: currentTrack.title,
  //     artist: currentTrack.artist,
  //     albumTitle: currentTrack.albumTitle,
  //     albumArt: currentTrack.albumArt,
  //     hasAlbumArt: !!currentTrack.albumArt
  //   });
  // }

  return (
    <>
      {/* Expandable Full-Screen Player */}
      <ExpandablePlayer 
        isExpanded={isPlayerExpanded}
        onToggleExpanded={togglePlayerExpanded}
        onClose={handleClose}
      />
      
      {/* Compact Now Playing Bar */}
      <div style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', // Add iOS safe area padding
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(34, 211, 238, 0.2)',
        zIndex: 40,
        transform: isPlayerExpanded ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease-in-out'
      }}>
        <div onClick={handleExpand} className="cursor-pointer">
          <NowPlaying
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            volume={volume}
            isShuffleMode={isShuffleMode}
            onPlayPause={handlePlayPause}
            onPrevious={playPreviousTrack}
            onNext={playNextTrack}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onClose={(e) => {
              e?.stopPropagation?.();
              handleClose();
            }}
            onToggleShuffle={(e) => {
              e?.stopPropagation?.();
              toggleShuffle();
            }}
            onExpand={handleExpand}
          />
        </div>
      </div>
    </>
  );
};

export default GlobalNowPlayingBar; 