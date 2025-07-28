'use client';

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { RSSAlbum } from '@/lib/rss-parser';
import { toast } from '@/components/Toast';

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
  shuffleAllTracks: () => Promise<boolean>;
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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
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

  // Add user interaction handler to enable audio playback
  useEffect(() => {
    const enableAudio = () => {
      if (audioRef.current) {
        // Try to play a silent audio to unlock audio context
        audioRef.current.volume = 0;
        audioRef.current.play().catch(() => {
          // Ignore errors - this is just to unlock the audio context
        });
      }
    };

    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Listen for user interactions to enable audio
    const events = ['click', 'touchstart', 'touchend', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true });
    });

    // For mobile, also try to enable audio on page load if possible
    if (isMobile) {
      console.log('📱 Mobile device detected - enabling mobile-specific audio handling');
    }

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
    };
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
        
        // Ensure audio is not muted for playback
        audioRef.current.muted = false;
        audioRef.current.volume = 0.8;
        
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
            console.log('🚫 Autoplay blocked - user interaction required. Please click or tap to enable audio.');
            // Show user-friendly toast message
            toast.info('Click anywhere on the page to enable audio playback', 8000);
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

    const handleEnded = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎵 Track ended, attempting to play next track');
      }
      
      try {
        await playNextTrack();
      } catch (error) {
        console.error('❌ Error in auto-play:', error);
      }
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
  }, [currentPlayingAlbum, currentTrackIndex]);

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

    // Check if we need user interaction first (mobile auto-play handling)
    if (!hasUserInteracted && typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('📱 Mobile device detected - enabling audio and attempting playback');
        
        // Instead of blocking, try to enable audio and play in the same action
        try {
          // Set user interaction flag immediately since this is a user-initiated action
          setHasUserInteracted(true);
          
          // Attempt playback directly - the user just clicked/tapped
          const success = await attemptAudioPlayback(track.url || '', 'Mobile album playback');
          if (success) {
            setCurrentPlayingAlbum(album);
            setCurrentTrackIndex(trackIndex);
            console.log('✅ Mobile audio enabled and playback started');
            return true;
          } else {
            // If it still fails, show the user a message
            toast.info('Audio blocked by browser - please tap the play button again', 3000);
            return false;
          }
        } catch (error) {
          console.error('❌ Mobile audio enablement failed:', error);
          toast.info('Please tap the play button again to enable audio', 3000);
          return false;
        }
      }
    }

    const success = await attemptAudioPlayback(track.url, 'Album playback');
    if (success) {
      setCurrentPlayingAlbum(album);
      setCurrentTrackIndex(trackIndex);
      setHasUserInteracted(true);
    }
    return success;
  };

  // Play shuffled track function
  const playShuffledTrack = async (index: number): Promise<boolean> => {
    // This would need to be implemented based on your shuffle logic
    console.log('🔄 Shuffle playback not implemented in global context yet');
    return false;
  };

  // Shuffle all tracks function
  const shuffleAllTracks = async (): Promise<boolean> => {
    if (albums.length === 0) {
      console.warn('No albums available for shuffle');
      return false;
    }

    // Create a flat array of all tracks with their album info
    const allTracks: Array<{
      album: RSSAlbum;
      trackIndex: number;
      track: any;
    }> = [];

    albums.forEach(album => {
      if (album.tracks && album.tracks.length > 0) {
        album.tracks.forEach((track, trackIndex) => {
          allTracks.push({
            album,
            trackIndex,
            track
          });
        });
      }
    });

    if (allTracks.length === 0) {
      console.warn('No tracks available for shuffle');
      return false;
    }

    // Shuffle the tracks array
    const shuffledTracks = [...allTracks];
    for (let i = shuffledTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTracks[i], shuffledTracks[j]] = [shuffledTracks[j], shuffledTracks[i]];
    }

    // Pick a random track to start with
    const randomTrack = shuffledTracks[0];
    console.log('🎲 Starting shuffle with:', randomTrack.track.title, 'from', randomTrack.album.title);

    // Play the randomly selected track
    return await playAlbum(randomTrack.album, randomTrack.trackIndex);
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
  const playNextTrack = async () => {
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Cannot play next track: missing album or tracks');
      }
      return;
    }

    const nextIndex = currentTrackIndex + 1;

    if (nextIndex < currentPlayingAlbum.tracks.length) {
      // Play next track in the album
      if (process.env.NODE_ENV === 'development') {
        console.log('🎵 Auto-playing next track:', currentPlayingAlbum.tracks[nextIndex].title);
      }
      await playAlbum(currentPlayingAlbum, nextIndex);
    } else {
      // End of album - loop back to the first track
      if (process.env.NODE_ENV === 'development') {
        console.log('🔁 End of album reached, looping back to first track');
      }
      await playAlbum(currentPlayingAlbum, 0);
    }
  };

  // Play previous track
  const playPreviousTrack = async () => {
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) return;

    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      console.log('🎵 Playing previous track:', currentPlayingAlbum.tracks[prevIndex].title);
      await playAlbum(currentPlayingAlbum, prevIndex);
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
    shuffleAllTracks,
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
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
        webkit-playsinline="true"
        autoPlay={false}
        controls={false}
        muted={false}
        style={{ display: 'none' }}
      />
    </AudioContext.Provider>
  );
}; 