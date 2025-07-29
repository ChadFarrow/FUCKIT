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
  
  // Media type state
  isVideoMode: boolean;
  
  // Shuffle state
  isShuffleMode: boolean;
  
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
  
  // Media element refs for direct access
  audioRef: React.RefObject<HTMLAudioElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
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
  
  // Video mode state
  const [isVideoMode, setIsVideoMode] = useState(false);
  
  // Shuffle state
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledPlaylist, setShuffledPlaylist] = useState<Array<{
    album: RSSAlbum;
    trackIndex: number;
    track: any;
  }>>([]);
  const [currentShuffleIndex, setCurrentShuffleIndex] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      if (audioRef.current && !hasUserInteracted) {
        // Only enable audio context unlock, don't actually play anything
        // This prevents accidental auto-play on mobile
        setHasUserInteracted(true);
        console.log('🔓 Audio context unlocked via user interaction');
      }
    };

    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Listen for user interactions to enable audio - but don't auto-play
    const events = ['click', 'touchstart', 'touchend', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true });
    });

    // For mobile, log detection but don't do anything that could trigger playback
    if (isMobile) {
      console.log('📱 Mobile device detected - audio will require explicit user interaction');
    }

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
    };
  }, []); // Remove hasUserInteracted from dependencies to prevent infinite loop

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

  // Helper function to detect if URL is a video
  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.m3u8', '.m4v', '.mov', '.avi', '.mkv'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext));
  };

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

  // Helper function to attempt media playback with fallback URLs
  const attemptAudioPlayback = async (originalUrl: string, context = 'playback'): Promise<boolean> => {
    const isVideo = isVideoUrl(originalUrl);
    const mediaElement = isVideo ? videoRef.current : audioRef.current;
    
    if (!mediaElement) {
      console.error(`❌ ${isVideo ? 'Video' : 'Audio'} element reference is null`);
      return false;
    }
    
    // Update video mode state
    setIsVideoMode(isVideo);
    
    if (isVideo) {
      console.log('🎬 Video URL detected, switching to video mode:', originalUrl);
    }
    
    const urlsToTry = getAudioUrlsToTry(originalUrl);
    
    for (let i = 0; i < urlsToTry.length; i++) {
      const audioUrl = urlsToTry[i];
      console.log(`🔄 ${context} attempt ${i + 1}/${urlsToTry.length}: ${audioUrl.includes('proxy-audio') ? 'Proxied URL' : 'Direct URL'}`);
      
      try {
        // Check if media element is still valid
        const currentMediaElement = isVideo ? videoRef.current : audioRef.current;
        if (!currentMediaElement) {
          console.error(`❌ ${isVideo ? 'Video' : 'Audio'} element became null during playback attempt`);
          return false;
        }
        
        // Set new source and load
        currentMediaElement.src = audioUrl;
        currentMediaElement.load();
        
        // Set volume for audio, videos typically control their own volume
        if (!isVideo) {
          (currentMediaElement as HTMLAudioElement).volume = 0.8;
        }
        
        // Wait a bit for the media to load before attempting to play
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure media is not muted for playback
        currentMediaElement.muted = false;
        if (!isVideo) {
          (currentMediaElement as HTMLAudioElement).volume = 0.8;
        }
        
        const playPromise = currentMediaElement.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log(`✅ ${context} started successfully with ${audioUrl.includes('proxy-audio') ? 'proxied' : 'direct'} URL (${isVideo ? 'VIDEO' : 'AUDIO'} mode)`);
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

  // Media event listeners
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;

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
      const currentElement = isVideoMode ? video : audio;
      setCurrentTime(currentElement.currentTime);
    };

    const handleLoadedMetadata = () => {
      const currentElement = isVideoMode ? video : audio;
      setDuration(currentElement.duration);
    };

    const handleError = (event: Event) => {
      const mediaError = (event.target as HTMLMediaElement)?.error;
      console.error(`🚫 ${isVideoMode ? 'Video' : 'Audio'} error:`, mediaError);
      setIsPlaying(false);
      
      // Prevent infinite error loops by clearing the source
      const currentElement = isVideoMode ? videoRef.current : audioRef.current;
      if (currentElement) {
        currentElement.src = '';
        currentElement.load();
      }
    };

    // Add event listeners to both audio and video elements
    const elements = [audio, video];
    elements.forEach(element => {
      element.addEventListener('play', handlePlay);
      element.addEventListener('pause', handlePause);
      element.addEventListener('ended', handleEnded);
      element.addEventListener('timeupdate', handleTimeUpdate);
      element.addEventListener('loadedmetadata', handleLoadedMetadata);
      element.addEventListener('error', handleError);
    });

    // Cleanup
    return () => {
      elements.forEach(element => {
        element.removeEventListener('play', handlePlay);
        element.removeEventListener('pause', handlePause);
        element.removeEventListener('ended', handleEnded);
        element.removeEventListener('timeupdate', handleTimeUpdate);
        element.removeEventListener('loadedmetadata', handleLoadedMetadata);
        element.removeEventListener('error', handleError);
      });
    };
  }, [currentPlayingAlbum, currentTrackIndex, isVideoMode]);

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
      
      // If this is a manual play (not from shuffle), exit shuffle mode
      if (!isShuffleMode) {
        setIsShuffleMode(false);
        setShuffledPlaylist([]);
        setCurrentShuffleIndex(0);
      }
    }
    return success;
  };

  // Play shuffled track function
  const playShuffledTrack = async (index: number): Promise<boolean> => {
    if (!shuffledPlaylist[index]) {
      console.error('❌ Invalid shuffle track index:', index, 'playlist length:', shuffledPlaylist.length);
      return false;
    }

    const trackData = shuffledPlaylist[index];
    const track = trackData.track;
    const album = trackData.album;

    if (!track || !track.url) {
      console.error('❌ No valid track found in shuffled playlist');
      return false;
    }

    const success = await attemptAudioPlayback(track.url, 'Shuffled track playback');
    if (success) {
      setCurrentPlayingAlbum(album);
      setCurrentTrackIndex(trackData.trackIndex);
      setCurrentShuffleIndex(index);
      setHasUserInteracted(true);
    }
    return success;
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

    // Set up shuffle state
    setShuffledPlaylist(shuffledTracks);
    setCurrentShuffleIndex(0);
    setIsShuffleMode(true);

    // Play the first track in the shuffled playlist
    const firstTrack = shuffledTracks[0];
    console.log('🎲 Starting shuffle with:', firstTrack.track.title, 'from', firstTrack.album.title);

    // Play the first track using the dedicated shuffle function
    return await playShuffledTrack(0);
  };

  // Pause function
  const pause = () => {
    const currentElement = isVideoMode ? videoRef.current : audioRef.current;
    if (currentElement) {
      currentElement.pause();
    }
  };

  // Resume function
  const resume = () => {
    const currentElement = isVideoMode ? videoRef.current : audioRef.current;
    if (currentElement) {
      currentElement.play();
    }
  };

  // Seek function
  const seek = (time: number) => {
    const currentElement = isVideoMode ? videoRef.current : audioRef.current;
    if (currentElement && duration) {
      currentElement.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(currentElement.currentTime);
    }
  };

  // Play next track
  const playNextTrack = async () => {
    if (isShuffleMode && shuffledPlaylist.length > 0) {
      // In shuffle mode, play next track from shuffled playlist
      const nextShuffleIndex = currentShuffleIndex + 1;
      
      if (nextShuffleIndex < shuffledPlaylist.length) {
        // Play next track in shuffled playlist
        const nextTrack = shuffledPlaylist[nextShuffleIndex];
        console.log('🎲 Playing next shuffled track:', nextTrack.track.title, 'from', nextTrack.album.title);
        await playShuffledTrack(nextShuffleIndex);
      } else {
        // End of shuffled playlist - loop back to the first track
        console.log('🔁 End of shuffled playlist reached, looping back to first track');
        await playShuffledTrack(0);
      }
      return;
    }

    // Normal mode - play next track in current album
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
    if (isShuffleMode && shuffledPlaylist.length > 0) {
      // In shuffle mode, play previous track from shuffled playlist
      const prevShuffleIndex = currentShuffleIndex - 1;
      
      if (prevShuffleIndex >= 0) {
        // Play previous track in shuffled playlist
        const prevTrack = shuffledPlaylist[prevShuffleIndex];
        console.log('🎲 Playing previous shuffled track:', prevTrack.track.title, 'from', prevTrack.album.title);
        await playShuffledTrack(prevShuffleIndex);
      } else {
        // Go to the last track in shuffled playlist
        const lastIndex = shuffledPlaylist.length - 1;
        const lastTrack = shuffledPlaylist[lastIndex];
        console.log('🎲 Playing last shuffled track:', lastTrack.track.title, 'from', lastTrack.album.title);
        await playShuffledTrack(lastIndex);
      }
      return;
    }

    // Normal mode - play previous track in current album
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) return;

    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      console.log('🎵 Playing previous track:', currentPlayingAlbum.tracks[prevIndex].title);
      await playAlbum(currentPlayingAlbum, prevIndex);
    }
  };

  // Stop function
  const stop = () => {
    // Stop both audio and video elements
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
    setCurrentPlayingAlbum(null);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setIsVideoMode(false);
    
    // Clear shuffle state
    setIsShuffleMode(false);
    setShuffledPlaylist([]);
    setCurrentShuffleIndex(0);
    
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
    isVideoMode,
    isShuffleMode,
    playAlbum,
    playShuffledTrack,
    shuffleAllTracks,
    pause,
    resume,
    seek,
    playNextTrack,
    playPreviousTrack,
    stop,
    audioRef,
    videoRef
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
      {/* Hidden video element */}
      <video
        ref={videoRef}
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