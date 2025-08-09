'use client';

import React, { useState } from 'react';
import NowPlaying from './NowPlaying';
import { useAudio } from '@/contexts/AudioContext';

const GlobalNowPlayingBar: React.FC = () => {
  const {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    isShuffleMode,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop,
    toggleShuffle
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

  // Debug logging for artwork troubleshooting
  if (process.env.NODE_ENV === 'development' && currentPlayingAlbum.tracks?.[currentTrackIndex]) {
    const track = currentPlayingAlbum.tracks[currentTrackIndex];
    console.log('🎨 Now Playing Artwork Debug:', {
      trackTitle: track.title,
      trackImage: track.image,
      albumCoverArt: currentPlayingAlbum.coverArt,
      finalAlbumArt: currentTrack.albumArt,
      hasTrackImage: !!track.image,
      hasAlbumCoverArt: !!currentPlayingAlbum.coverArt
    });
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      padding: '16px',
      paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', // Add iOS safe area padding
      backgroundColor: '#1f2937',
      borderTop: '1px solid #f97316',
      zIndex: 50
    }}>
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
        onClose={handleClose}
        onToggleShuffle={toggleShuffle}
      />
    </div>
  );
};

export default GlobalNowPlayingBar; 