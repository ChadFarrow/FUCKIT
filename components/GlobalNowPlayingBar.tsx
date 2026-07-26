'use client';

import React, { useEffect } from 'react';
import NowPlaying from './NowPlaying';
import { useAudio } from '@/contexts/AudioContext';
import { getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { Share2 } from 'lucide-react';
import { toast } from './Toast';

const GlobalNowPlayingBar: React.FC = () => {
  const {
    currentPlayingAlbum,
    isPlaying,
    isLoading,
    currentTrackIndex,
    currentTime,
    duration,
    isShuffleMode,
    repeatMode,
    setRepeatMode,
    isFullscreenMode,
    setFullscreenMode,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop,
    toggleShuffle,
    chapters,
    currentChapterIndex
  } = useAudio();

  // Helper function to proxy external image URLs
  const getProxiedImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return '';

    // If it's already a local/proxied URL, return as-is
    if (imageUrl.startsWith('/') || imageUrl.includes('/api/proxy-image')) {
      return imageUrl;
    }

    // Proxy external URLs to avoid CORS issues
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  };

  // Get the artwork URL with proper fallbacks
  const getArtworkUrl = React.useCallback((trackIndex: number): string => {
    if (!currentPlayingAlbum) return getPlaceholderImageUrl('thumbnail');

    // Prioritize chapter art when chapters are active
    const chapterImg = chapters.length > 0 && currentChapterIndex >= 0
      ? chapters[currentChapterIndex]?.img
      : undefined;
    if (chapterImg && chapterImg.trim() !== '') {
      return getProxiedImageUrl(chapterImg);
    }

    const track = currentPlayingAlbum.tracks?.[trackIndex];
    const trackImage = track?.image;
    const albumCoverArt = currentPlayingAlbum.coverArt;

    // Prioritize track image, then album cover art
    if (trackImage && trackImage.trim() !== '' && trackImage !== 'null') {
      return getProxiedImageUrl(trackImage);
    }

    // Fallback to album cover art if valid
    if (albumCoverArt && albumCoverArt.trim() !== '' && albumCoverArt !== 'null') {
      return getProxiedImageUrl(albumCoverArt);
    }

    // Use placeholder when no artwork is available
    return getPlaceholderImageUrl('thumbnail');
  }, [currentPlayingAlbum, chapters, currentChapterIndex]);

  // Create track object for NowPlaying component
  // Use useMemo to ensure the object reference changes when dependencies change
  const currentTrack = React.useMemo(() => {
    if (!currentPlayingAlbum) return null;

    const track = currentPlayingAlbum.tracks?.[currentTrackIndex];
    const chapterTitle = chapters.length > 0 && currentChapterIndex >= 0
      ? chapters[currentChapterIndex]?.title
      : undefined;
    return {
      id: track?.id || track?.guid || track?.episodeId || `${currentPlayingAlbum.id || currentPlayingAlbum.title}-${currentTrackIndex}`,
      title: track?.title || `Track ${currentTrackIndex + 1}`,
      artist: track?.artist || currentPlayingAlbum.artist,
      chapterTitle,
      albumTitle: currentPlayingAlbum.title,
      duration: duration || 0,
      // Get artwork URL with proper fallbacks
      albumArt: getArtworkUrl(currentTrackIndex)
    };
  }, [currentPlayingAlbum, currentTrackIndex, duration, getArtworkUrl, chapters, currentChapterIndex]);

  // Flag the bar's presence on <html> so CSS can reserve space for it only when it
  // actually exists. `--sk-player-reserve` (globals.css) is 0 without this attribute,
  // which stops the layout wrapper and any page sizing itself off that variable from
  // holding open an empty strip that shows the app's artwork background through it.
  // Reported on the zapstore build's favorites page with nothing playing.
  useEffect(() => {
    const root = document.documentElement;
    if (currentPlayingAlbum) root.setAttribute('data-player', '');
    else root.removeAttribute('data-player');
    return () => root.removeAttribute('data-player');
  }, [currentPlayingAlbum]);

  // Don't render if nothing is playing or if fullscreen mode is active
  if (!currentPlayingAlbum || isFullscreenMode) {
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

  const handleClose = () => {
    stop();
  };

  const handleOpenFullscreen = () => {
    setFullscreenMode(true);
  };

  const handleToggleRepeat = () => {
    // Cycle through repeat modes: none -> all -> one -> none
    const nextMode = repeatMode === 'none' ? 'all' :
                     repeatMode === 'all' ? 'one' :
                     'none';
    console.log('🔂 Repeat button clicked:', { currentMode: repeatMode, nextMode });
    setRepeatMode(nextMode);
  };

  // Don't render if currentTrack is null
  if (!currentTrack) {
    return null;
  }

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '16px',
      paddingBottom: 'calc(16px + var(--sk-safe-bottom))', // Clear the iOS home indicator / Android nav bar
      backgroundColor: '#1f2937',
      borderTop: '1px solid #f97316',
      zIndex: 50,
      // iOS defers repositioning `position: fixed` elements during a momentum scroll:
      // it keeps compositing them at a stale offset and only corrects when the scroll
      // settles, so the bar transiently appears raised with page content visible below
      // it (reported on the iOS home-screen PWA; it corrects itself on further scroll).
      // Promoting the bar to its own compositing layer lets the compositor keep it
      // pinned instead of waiting on a main-thread repaint.
      //
      // Safe here specifically because the bar has NO `position: fixed` descendants —
      // a transform would otherwise make it their containing block. Its one absolutely
      // positioned child (the desktop share button) is already contained by it. Re-check
      // that if a fixed child is ever added.
      transform: 'translateZ(0)',
      willChange: 'transform',
    }}>
      {/* Share button on far left - hidden on mobile, shown on desktop */}
      <button
        onClick={handleShare}
        className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 bg-stablekraft-teal/90 hover:bg-stablekraft-teal text-white p-2 rounded-full transition-all duration-200 active:scale-95"
        title="Share this page"
        aria-label="Copy page link to clipboard"
        style={{ zIndex: 51 }}
      >
        <Share2 className="w-4 h-4" />
      </button>
      <NowPlaying
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        currentTime={currentTime}
        isShuffleMode={isShuffleMode}
        repeatMode={repeatMode}
        onPlayPause={handlePlayPause}
        onPrevious={playPreviousTrack}
        onNext={playNextTrack}
        onSeek={handleSeek}
        onClose={handleClose}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onOpenFullscreen={handleOpenFullscreen}
        onShare={handleShare}
      />
    </div>
  );
};

export default GlobalNowPlayingBar; 