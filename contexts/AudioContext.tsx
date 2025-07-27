'use client';

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { RSSAlbum } from '@/lib/rss-parser';

interface AudioContextType {
  // Audio state
  currentPlayingAlbum: RSSAlbum | null;
  isPlaying: boolean;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  
  // Audio controls
  playAlbum: (album: RSSAlbum, trackIndex?: number) => Promise<boolean>;
  playShuffledTrack: (index: number) => Promise<boolean>;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  stop: () => void;
  
  // Audio element ref for direct access
  audioRef: React.RefObject<HTMLAudioElement>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [currentPlayingAlbum, setCurrentPlayingAlbum] = useState<RSSAlbum | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('audioPlayerState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          // Note: We can't restore the full album object from localStorage
          // So we'll just restore the track index and timing info
          setCurrentTrackIndex(state.currentTrackIndex || 0);
          setCurrentTime(state.currentTime || 0);
          setDuration(state.duration || 0);
          // Note: isPlaying is not restored to prevent autoplay issues
        } catch (error) {
          console.warn('Failed to restore audio state:', error);
        }
      }
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentPlayingAlbum) {
      const state = {
        currentPlayingAlbumTitle: currentPlayingAlbum.title,
        currentTrackIndex,
        currentTime,
        duration,
        timestamp: Date.now()
      };
      localStorage.setItem('audioPlayerState', JSON.stringify(state));
    }
  }, [currentPlayingAlbum, currentTrackIndex, currentTime, duration]);

  // Load albums data for playback
  useEffect(() => {
    const loadAlbums = async () => {
      try {
        const response = await fetch('/api/albums');
        if (response.ok) {
          const data = await response.json();
          setAlbums(data.albums || []);
        }
      } catch (error) {
        console.warn('Failed to load albums for audio context:', error);
      }
    };
    
    loadAlbums();
  }, []);

  // Helper function to get URLs to try for audio playback
  const getAudioUrlsToTry = (originalUrl: string): string[] => {
    const urlsToTry = [];
    
    try {
      const url = new URL(originalUrl);
      const isExternal = url.hostname !== window.location.hostname;
      
      if (isExternal) {
        // Try proxy first for external URLs
        urlsToTry.push(`/api/proxy-audio?url=${encodeURIComponent(originalUrl)}`);
        // Fallback to direct URL
        urlsToTry.push(originalUrl);
      } else {
        // For local URLs, try direct first
        urlsToTry.push(originalUrl);
      }
    } catch (urlError) {
      console.warn('⚠️ Could not parse audio URL, using as-is:', originalUrl);
      urlsToTry.push(originalUrl);
    }
    
    return urlsToTry;
  };

  // Helper function to attempt audio playback with fallback URLs
  const attemptAudioPlayback = async (originalUrl: string, context = 'playback'): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('❌ Audio element reference is null');
      return false;
    }
    
    const urlsToTry = getAudioUrlsToTry(originalUrl);
    
    for (let i = 0; i < urlsToTry.length; i++) {
      const audioUrl = urlsToTry[i];
      console.log(`🔄 ${context} attempt ${i + 1}/${urlsToTry.length}: ${audioUrl.includes('proxy-audio') ? 'Proxied URL' : 'Direct URL'}`);
      
      try {
        // Check if audio element is still valid
        if (!audioRef.current) {
          console.error('❌ Audio element became null during playback attempt');
          return false;
        }
        
        // Set new source and load
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        audioRef.current.volume = 0.8;
        
        // Wait a bit for the audio to load before attempting to play
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log(`✅ ${context} started successfully with ${audioUrl.includes('proxy-audio') ? 'proxied' : 'direct'} URL`);
          return true;
        }
      } catch (attemptError) {
        console.warn(`⚠️ ${context} attempt ${i + 1} failed:`, attemptError);
        
        // Handle specific error types
        if (attemptError instanceof DOMException) {
          if (attemptError.name === 'NotAllowedError') {
            console.log('🚫 Autoplay blocked - user interaction required');
            break; // Don't try other URLs for autoplay issues
          } else if (attemptError.name === 'NotSupportedError') {
            console.log('🚫 Audio format not supported');
            continue; // Try next URL
          } else if (attemptError.name === 'AbortError') {
            console.log('🚫 Audio request aborted - trying next URL');
            continue; // Try next URL
          } else if (attemptError.message.includes('CORS') || attemptError.message.includes('cross-origin')) {
            console.log('🚫 CORS error - trying next URL');
            continue; // Try next URL
          }
        }
        
        // Add a small delay before trying the next URL
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return false; // All attempts failed
  };

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      playNextTrack();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleError = (event: Event) => {
      const audioError = (event.target as HTMLAudioElement)?.error;
      console.error('🚫 Audio error:', audioError);
      setIsPlaying(false);
    };

    // Add event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    // Cleanup
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Play album function
  const playAlbum = async (album: RSSAlbum, trackIndex: number = 0): Promise<boolean> => {
    if (!album.tracks || album.tracks.length === 0) {
      console.error('❌ No tracks found in album');
      return false;
    }

    const track = album.tracks[trackIndex];
    if (!track || !track.url) {
      console.error('❌ No valid track found at index', trackIndex);
      return false;
    }

    const success = await attemptAudioPlayback(track.url, 'Album playback');
    if (success) {
      setCurrentPlayingAlbum(album);
      setCurrentTrackIndex(trackIndex);
    }
    return success;
  };

  // Play shuffled track function
  const playShuffledTrack = async (index: number): Promise<boolean> => {
    // This would need to be implemented based on your shuffle logic
    console.log('🔄 Shuffle playback not implemented in global context yet');
    return false;
  };

  // Pause function
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // Resume function
  const resume = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  // Seek function
  const seek = (time: number) => {
    if (audioRef.current && duration) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Play next track
  const playNextTrack = () => {
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) return;

    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < currentPlayingAlbum.tracks.length) {
      playAlbum(currentPlayingAlbum, nextIndex);
    } else {
      // End of album - could loop or stop
      stop();
    }
  };

  // Play previous track
  const playPreviousTrack = () => {
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) return;

    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      playAlbum(currentPlayingAlbum, prevIndex);
    }
  };

  // Stop function
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentPlayingAlbum(null);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setDuration(0);
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('audioPlayerState');
    }
  };

  const value: AudioContextType = {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    playAlbum,
    playShuffledTrack,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop,
    audioRef
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="none"
        crossOrigin="anonymous"
        playsInline
        webkit-playsinline="true"
        autoPlay={false}
        controls={false}
        style={{ display: 'none' }}
      />
    </AudioContext.Provider>
  );
}; 