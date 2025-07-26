'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getGlobalAudioState, updateGlobalAudioState, clearGlobalAudioState, GlobalAudioState } from '@/lib/audio-state';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';

interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  albumId: string;
  coverArt: string;
  url: string;
  duration?: string;
}

export default function GlobalAudioPlayer() {
  const [audioState, setAudioState] = useState<GlobalAudioState | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load initial state and track info
  useEffect(() => {
    const loadAudioState = () => {
      const state = getGlobalAudioState();
      if (state.trackUrl && state.currentAlbum) {
        setAudioState(state);
        setIsVisible(true);
        setCurrentTime(state.currentTime || 0);
        setDuration(state.duration || 0);
        setVolume(state.volume || 1);
        
        // Load track info from localStorage
        const trackInfoKey = `fuckit_track_info_${state.currentAlbum}_${state.currentTrackIndex}`;
        const storedTrackInfo = localStorage.getItem(trackInfoKey);
        if (storedTrackInfo) {
          setTrackInfo(JSON.parse(storedTrackInfo));
        }
      }
    };

    loadAudioState();

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fuckit_audio_state') {
        loadAudioState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update audio element when state changes
  useEffect(() => {
    if (audioRef.current && audioState?.trackUrl) {
      if (audioRef.current.src !== audioState.trackUrl) {
        audioRef.current.src = audioState.trackUrl;
        audioRef.current.currentTime = audioState.currentTime || 0;
        audioRef.current.volume = audioState.volume || 1;
        
        if (audioState.isPlaying) {
          audioRef.current.play().catch(console.error);
        }
      } else if (audioState.isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      } else if (!audioState.isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [audioState]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTimeHandler = () => {
      setCurrentTime(audio.currentTime);
      updateGlobalAudioState({ currentTime: audio.currentTime }, audio);
    };

    const loadedMetadataHandler = () => {
      setDuration(audio.duration);
      updateGlobalAudioState({ duration: audio.duration }, audio);
    };

    const playHandler = () => {
      updateGlobalAudioState({ isPlaying: true }, audio);
    };

    const pauseHandler = () => {
      updateGlobalAudioState({ isPlaying: false }, audio);
    };

    const endedHandler = () => {
      updateGlobalAudioState({ isPlaying: false }, audio);
      // Auto-advance to next track if available
      // This could be enhanced to load next track from the album
    };

    audio.addEventListener('timeupdate', updateTimeHandler);
    audio.addEventListener('loadedmetadata', loadedMetadataHandler);
    audio.addEventListener('play', playHandler);
    audio.addEventListener('pause', pauseHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', updateTimeHandler);
      audio.removeEventListener('loadedmetadata', loadedMetadataHandler);
      audio.removeEventListener('play', playHandler);
      audio.removeEventListener('pause', pauseHandler);
      audio.removeEventListener('ended', endedHandler);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (audioState?.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      updateGlobalAudioState({ currentTime: time }, audioRef.current);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    seekTo(newTime);
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    clearGlobalAudioState();
    setIsVisible(false);
    setAudioState(null);
    setTrackInfo(null);
  };

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  console.log('🌐 GlobalAudioPlayer render check:', {
    isVisible,
    hasAudioState: !!audioState,
    hasTrackInfo: !!trackInfo,
    willRender: isVisible && audioState && trackInfo
  });

  if (!isVisible || !audioState || !trackInfo) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <audio ref={audioRef} />
      
      {/* Now Playing Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 shadow-lg z-50">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Album Art & Track Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Link 
                href={generateAlbumUrl(trackInfo.albumId)}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <div className="w-12 h-12 relative rounded overflow-hidden">
                  <Image
                    src={getAlbumArtworkUrl(trackInfo.coverArt)}
                    alt={trackInfo.album}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getPlaceholderImageUrl();
                    }}
                  />
                </div>
              </Link>
              
              <div className="min-w-0 flex-1">
                <div className="text-white font-medium text-sm truncate">
                  {trackInfo.title}
                </div>
                <div className="text-gray-400 text-xs truncate">
                  {trackInfo.artist} • {trackInfo.album}
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="flex items-center justify-center w-10 h-10 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              >
                {audioState.isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} className="ml-0.5" />
                )}
              </button>
            </div>

            {/* Progress Bar & Time */}
            <div className="hidden md:flex items-center gap-3 flex-1 max-w-md">
              <span className="text-xs text-gray-400 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              
              <div 
                className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all group-hover:bg-gray-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              
              <span className="text-xs text-gray-400 w-10">
                {formatTime(duration)}
              </span>
            </div>

            {/* Volume & Close */}
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-gray-400" />
              <button
                onClick={closePlayer}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Mobile Progress Bar */}
          <div className="md:hidden mt-2">
            <div 
              className="w-full h-1 bg-gray-700 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom padding to prevent content from being hidden behind the player */}
      <div className="h-20 md:h-16" />
    </>
  );
}