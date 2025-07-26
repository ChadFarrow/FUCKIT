'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { getGlobalAudioState, updateGlobalAudioState, clearGlobalAudioState } from '@/lib/audio-state';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';

interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  albumId: string;
  coverArt: string | null;
  url: string;
  duration: string;
}

interface GlobalAudioState {
  isPlaying: boolean;
  currentAlbum: string | null;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  trackUrl: string | null;
}

export default function GlobalAudioPlayer() {
  const [audioState, setAudioState] = useState<GlobalAudioState | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Debug: Log component mount
  console.log('🚀 GlobalAudioPlayer component mounted');

  // Load audio state from localStorage
  useEffect(() => {
    console.log('🔧 GlobalAudioPlayer useEffect starting');
    
    const checkAudioState = () => {
      const state = getGlobalAudioState();
      console.log('🔄 GlobalAudioPlayer checking state:', state);
      
      if (state.isPlaying && state.currentAlbum && state.trackUrl) {
        setAudioState(state);
        setIsVisible(true);
        setCurrentTime(state.currentTime || 0);
        setDuration(state.duration || 0);
        
        // Load track info from localStorage
        const trackInfoKey = `fuckit_track_info_${state.currentAlbum}_${state.currentTrackIndex}`;
        const storedTrackInfo = localStorage.getItem(trackInfoKey);
        if (storedTrackInfo) {
          setTrackInfo(JSON.parse(storedTrackInfo));
        }
      } else {
        setIsVisible(false);
        setAudioState(null);
        setTrackInfo(null);
      }
    };

    // Check immediately
    checkAudioState();

    // Check every second to detect state changes
    const interval = setInterval(checkAudioState, 1000);

    // Listen for storage changes (from other tabs)
    const handleStorageChange = () => {
      console.log('🔄 Storage change detected');
      checkAudioState();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update audio element when state changes
  useEffect(() => {
    if (audioRef.current && audioState?.trackUrl) {
      if (audioRef.current.src !== audioState.trackUrl) {
        console.log('🎵 GlobalAudioPlayer loading new track:', audioState.trackUrl);
        audioRef.current.src = audioState.trackUrl;
        audioRef.current.volume = audioState.volume || 1;
        
        // Wait for metadata to load before setting current time and playing
        const handleCanPlay = () => {
          if (audioRef.current) {
            console.log('🎵 GlobalAudioPlayer metadata loaded, setting time:', audioState.currentTime);
            audioRef.current.currentTime = audioState.currentTime || 0;
            
            if (audioState.isPlaying) {
              console.log('🎵 GlobalAudioPlayer starting playback');
              audioRef.current.play().catch(console.error);
            }
          }
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
        };
        
        audioRef.current.addEventListener('canplay', handleCanPlay);
        audioRef.current.load(); // Force load
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

    audio.addEventListener('timeupdate', updateTimeHandler);
    audio.addEventListener('loadedmetadata', loadedMetadataHandler);
    audio.addEventListener('play', playHandler);
    audio.addEventListener('pause', pauseHandler);

    return () => {
      audio.removeEventListener('timeupdate', updateTimeHandler);
      audio.removeEventListener('loadedmetadata', loadedMetadataHandler);
      audio.removeEventListener('play', playHandler);
      audio.removeEventListener('pause', pauseHandler);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioState?.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = volume;
      updateGlobalAudioState({ volume }, audioRef.current);
    }
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
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
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
          {/* Album Art & Track Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link 
              href={generateAlbumUrl(trackInfo.albumId)}
              className="flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <div className="w-12 h-12 relative rounded overflow-hidden">
                <Image
                  src={getAlbumArtworkUrl(trackInfo.coverArt || '')}
                  alt={trackInfo.album}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = getPlaceholderImageUrl('thumbnail');
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
              className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
            >
              {audioState.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercent}%, #4b5563 ${progressPercent}%, #4b5563 100%)`
                }}
              />
            </div>
            <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
          </div>

          {/* Volume & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audioState.volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <button 
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>
  );
}