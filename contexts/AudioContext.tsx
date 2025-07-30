'use client';

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { RSSAlbum } from '@/lib/rss-parser';
import { toast } from '@/components/Toast';
import Hls from 'hls.js';

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
  const hlsRef = useRef<Hls | null>(null);
  const albumsLoadedRef = useRef(false);
  const isRetryingRef = useRef(false);

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
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('📱 Mobile device detected - audio will play on first track click');
    }

    // No need for generic interaction handlers - playAlbum will handle it
    return () => {};
  }, []); // Run only once on mount

  // Save state to localStorage when it changes - with debouncing
  useEffect(() => {
    if (typeof window !== 'undefined' && currentPlayingAlbum) {
      const timeoutId = setTimeout(() => {
        const state = {
          currentPlayingAlbumTitle: currentPlayingAlbum.title,
          currentTrackIndex,
          currentTime,
          duration,
          timestamp: Date.now()
        };
        localStorage.setItem('audioPlayerState', JSON.stringify(state));
      }, 100); // Debounce to prevent excessive writes
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentPlayingAlbum?.title, currentTrackIndex, currentTime, duration]); // Use specific properties instead of entire objects

  // Load albums data for playback - only once
  useEffect(() => {
    const loadAlbums = async () => {
      // Prevent multiple loads
      if (albumsLoadedRef.current) {
        return;
      }
      
      albumsLoadedRef.current = true;
      
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
  }, []); // Run only once on mount

  // Helper function to detect if URL is a video
  const isVideoUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.m3u8', '.m4v', '.mov', '.avi', '.mkv'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext));
  };

  // Helper function to detect if URL is an HLS stream
  const isHlsUrl = (url: string): boolean => {
    return Boolean(url && typeof url === 'string' && url.toLowerCase().includes('.m3u8'));
  };

  // Helper function to get URLs to try for audio/video playback
  const getAudioUrlsToTry = (originalUrl: string): string[] => {
    const urlsToTry = [];
    
    if (!originalUrl || typeof originalUrl !== 'string') {
      console.warn('⚠️ Invalid audio URL provided:', originalUrl);
      return [];
    }
    
    try {
      const url = new URL(originalUrl);
      const isExternal = url.hostname !== window.location.hostname;
      const isHls = isHlsUrl(originalUrl);
      
      // Special handling for HLS streams
      if (isHls) {
        // For HLS streams, try video proxy first, then audio proxy, then direct
        urlsToTry.push(`/api/proxy-video?url=${encodeURIComponent(originalUrl)}`);
        urlsToTry.push(`/api/proxy-audio?url=${encodeURIComponent(originalUrl)}`);
        urlsToTry.push(originalUrl);
        return urlsToTry;
      }
      
      // Special handling for op3.dev analytics URLs - extract direct URL
      if (originalUrl.includes('op3.dev/e,') && originalUrl.includes('/https://')) {
        const directUrl = originalUrl.split('/https://')[1];
        if (directUrl) {
          const fullDirectUrl = `https://${directUrl}`;
          console.log('🔗 Extracted direct URL from op3.dev:', fullDirectUrl);
          // Try direct URL first for better reliability
          urlsToTry.push(fullDirectUrl);
          // Then try proxy with direct URL
          urlsToTry.push(`/api/proxy-audio?url=${encodeURIComponent(fullDirectUrl)}`);
          // Fallback to original op3 URL with proxy
          urlsToTry.push(`/api/proxy-audio?url=${encodeURIComponent(originalUrl)}`);
          // Last resort: original op3 URL direct
          urlsToTry.push(originalUrl);
        } else {
          // If extraction fails, use normal logic
          urlsToTry.push(`/api/proxy-audio?url=${encodeURIComponent(originalUrl)}`);
          urlsToTry.push(originalUrl);
        }
      } else if (isExternal) {
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

  // Helper function to attempt HLS playback
  const attemptHlsPlayback = async (hlsUrl: string, context = 'HLS playback'): Promise<boolean> => {
    const videoElement = videoRef.current;
    
    if (!videoElement) {
      console.error('❌ Video element reference is null for HLS playback');
      return false;
    }

    // Get URLs to try including proxied versions
    const urlsToTry = getAudioUrlsToTry(hlsUrl);
    console.log(`🔄 ${context}: Trying ${urlsToTry.length} HLS URLs`);

    for (let i = 0; i < urlsToTry.length; i++) {
      const currentUrl = urlsToTry[i];
      console.log(`🔄 ${context} attempt ${i + 1}/${urlsToTry.length}: ${typeof currentUrl === 'string' && currentUrl.includes('proxy-audio') ? 'Proxied HLS URL' : 'Direct HLS URL'}`);

      try {
        // Clean up any existing HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (Hls.isSupported()) {
          // Use hls.js for browsers that support it
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            xhrSetup: function(xhr, url) {
              // Add any necessary headers for CORS
              xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
            }
          });
          
          hlsRef.current = hls;
          
          // Clear any existing src to avoid conflicts
          videoElement.src = '';
          videoElement.load();
          
          // Set up event listeners
          const manifestParsed = new Promise<boolean>((resolve) => {
            let hasResolved = false;
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log('✅ HLS manifest parsed successfully');
              // Don't try to play immediately, wait for video to be ready
            });
            
            hls.on(Hls.Events.LEVEL_LOADED, () => {
              console.log('✅ HLS level loaded, attempting playback');
              if (!hasResolved) {
                videoElement.play().then(() => {
                  console.log(`✅ ${context} started successfully`);
                  hasResolved = true;
                  resolve(true);
                }).catch(error => {
                  console.error('❌ HLS playback failed:', error);
                  if (!hasResolved) {
                    hasResolved = true;
                    resolve(false);
                  }
                });
              }
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('❌ HLS error:', data);
              if (data.fatal) {
                console.error('❌ Fatal HLS error, trying next URL');
                hls.destroy();
                hlsRef.current = null;
                if (!hasResolved) {
                  hasResolved = true;
                  resolve(false);
                }
              }
            });
            
            // Timeout after 20 seconds
            setTimeout(() => {
              console.warn(`⏰ ${context} timed out for URL ${i + 1}`);
              if (!hasResolved) {
                hasResolved = true;
                resolve(false);
              }
            }, 20000);
          });
          
          // Load the HLS stream
          hls.loadSource(currentUrl);
          hls.attachMedia(videoElement);
          
          // Wait for manifest to be parsed and playback to start
          const success = await manifestParsed;
          if (success) {
            return true;
          }
          
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          console.log('🍎 Using Safari native HLS support');
          videoElement.src = currentUrl;
          videoElement.load();
          
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log(`✅ ${context} started successfully with Safari native HLS`);
            return true;
          }
        } else {
          console.error('❌ HLS not supported in this browser');
          toast.error('Video streaming not supported in this browser', 5000);
          return false;
        }
        
      } catch (error) {
        console.error(`❌ ${context} attempt ${i + 1} failed:`, error);
        
        // Clean up on error
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        
        // Add a small delay before trying the next URL
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.error(`❌ All ${urlsToTry.length} HLS URLs failed for ${context}`);
    return false;
  };

  // Helper function to attempt media playback with fallback URLs
  const attemptAudioPlayback = async (originalUrl: string, context = 'playback'): Promise<boolean> => {
    const isVideo = isVideoUrl(originalUrl);
    const isHls = isHlsUrl(originalUrl);
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
    
    if (isHls) {
      console.log('📺 HLS stream detected, using hls.js:', originalUrl);
      return attemptHlsPlayback(originalUrl, context);
    }
    
    const urlsToTry = getAudioUrlsToTry(originalUrl);
    
    // Set retry flag to prevent error handler interference
    isRetryingRef.current = true;
    
    for (let i = 0; i < urlsToTry.length; i++) {
      const audioUrl = urlsToTry[i];
      console.log(`🔄 ${context} attempt ${i + 1}/${urlsToTry.length}: ${typeof audioUrl === 'string' && audioUrl.includes('proxy-audio') ? 'Proxied URL' : 'Direct URL'}`);
      
      try {
        // Clean up any existing HLS instance when switching to regular media
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Check if media element is still valid
      const currentMediaElement = isVideo ? videoRef.current : audioRef.current;
      if (!currentMediaElement) {
        console.error(`❌ ${isVideo ? 'Video' : 'Audio'} element became null during playback attempt`);
        return false;
      }
      
      // Clear any previous error state before setting new source
      currentMediaElement.pause();
      currentMediaElement.removeAttribute('src');
      currentMediaElement.load();
      
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
          console.log(`✅ ${context} started successfully with ${typeof audioUrl === 'string' && audioUrl.includes('proxy-audio') ? 'proxied' : 'direct'} URL (${isVideo ? 'VIDEO' : 'AUDIO'} mode)`);
          // Clear retry flag on success
          isRetryingRef.current = false;
          return true;
        }
      } catch (attemptError) {
        console.warn(`⚠️ ${context} attempt ${i + 1} failed:`, attemptError);
        
        // Handle specific error types
        if (attemptError instanceof DOMException) {
          if (attemptError.name === 'NotAllowedError') {
            console.log('🚫 Autoplay blocked - this should not happen on user click');
            // If we get NotAllowedError on a user click, something is wrong
            // Don't show a generic message, return false to let playAlbum handle it
            return false;
          } else if (attemptError.name === 'NotSupportedError') {
            console.log('🚫 Audio format not supported');
            continue; // Try next URL
          } else if (attemptError.name === 'AbortError') {
            console.log('🚫 Audio request aborted - trying next URL');
            continue; // Try next URL
          } else if (typeof attemptError.message === 'string' && (attemptError.message.includes('CORS') || attemptError.message.includes('cross-origin'))) {
            console.log('🚫 CORS error - trying next URL');
            continue; // Try next URL
          }
        }
        
        // Add a small delay before trying the next URL
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Clear retry flag
    isRetryingRef.current = false;
    
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
      
      // Don't interfere if we're in the middle of retrying
      if (isRetryingRef.current) {
        console.log('🔄 Error during retry process - letting retry logic handle it');
        return;
      }
      
      setIsPlaying(false);
      
      // Don't clear the source immediately - let the retry logic in attemptAudioPlayback handle it
      // Only log the error for debugging
      if (mediaError?.code === 4) {
        console.log('🔄 Media not suitable error - retry logic will handle this');
      } else if (mediaError?.code === 3) {
        console.log('🔄 Decode error - retry logic will handle this');
      } else if (mediaError?.code === 2) {
        console.log('🔄 Network error - retry logic will handle this');
      } else if (mediaError?.code === 1) {
        console.log('🔄 Aborted error - retry logic will handle this');
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
      
      // Clean up HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isVideoMode]); // Only depend on isVideoMode to prevent recursion

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

    // Since playAlbum is called from user clicks, we can safely set hasUserInteracted
    if (!hasUserInteracted) {
      console.log('🎵 First user interaction detected - enabling audio');
      setHasUserInteracted(true);
    }

    // Try to play the track immediately
    const success = await attemptAudioPlayback(track.url, 'Album playback');
    if (success) {
      setCurrentPlayingAlbum(album);
      setCurrentTrackIndex(trackIndex);
      
      // If this is a manual play (not from shuffle), exit shuffle mode
      if (!isShuffleMode) {
        setIsShuffleMode(false);
        setShuffledPlaylist([]);
        setCurrentShuffleIndex(0);
      }
      
      console.log('✅ Playback started successfully');
      return true;
    } else {
      // Only show retry message if it's a browser autoplay restriction
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('📱 Mobile playback failed - may need another tap');
        toast.info('Tap the play button once more to enable audio', 3000);
      }
      return false;
    }
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

    // Play the first track directly using the local shuffledTracks array to avoid race condition
    const track = firstTrack.track;
    const album = firstTrack.album;

    if (!track || !track.url) {
      console.error('❌ No valid track found in shuffled playlist');
      return false;
    }

    const success = await attemptAudioPlayback(track.url, 'Shuffled track playback');
    if (success) {
      setCurrentPlayingAlbum(album);
      setCurrentTrackIndex(firstTrack.trackIndex);
      setCurrentShuffleIndex(0);
      setHasUserInteracted(true);
    }
    return success;
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
    
    // Clean up HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
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
        preload="none"
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
        preload="none"
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