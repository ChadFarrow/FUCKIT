'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generateAlbumSlug, generatePublisherSlug } from '@/lib/url-utils';
import { useAudio } from '@/contexts/AudioContext';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';
import ControlsBar from '@/components/ControlsBar';
import CDNImage from '@/components/CDNImage';

interface AlbumDetailClientProps {
  albumTitle: string;
  albumId: string; // Add albumId prop
  initialAlbum: RSSAlbum | null;
}

export default function AlbumDetailClient({ albumTitle, albumId, initialAlbum }: AlbumDetailClientProps) {
  const [album, setAlbum] = useState<RSSAlbum | null>(initialAlbum);
  const [isLoading, setIsLoading] = useState(!initialAlbum);
  const [error, setError] = useState<string | null>(null);
  const [podrollAlbums, setPodrollAlbums] = useState<RSSAlbum[]>([]);
  const [loadingStarted, setLoadingStarted] = useState(false);
  const [doerfelsPublisherInfo, setDoerfelsPublisherInfo] = useState<any>(null);
  const [relatedDoerfelsAlbums, setRelatedDoerfelsAlbums] = useState<any[]>([]);
  const [isDoerfelsAlbum, setIsDoerfelsAlbum] = useState(false);
  
  // Global audio context
  const { 
    playAlbum: globalPlayAlbum, 
    currentPlayingAlbum, 
    isPlaying: globalIsPlaying,
    currentTrackIndex: globalTrackIndex,
    currentTime: globalCurrentTime,
    duration: globalDuration,
    pause: globalPause,
    resume: globalResume,
    seek: globalSeek,
    shuffleAllTracks
  } = useAudio();
  const { shouldPreventClick } = useScrollDetectionContext();

  // Background state
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [albumArtLoaded, setAlbumArtLoaded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const preloadAttemptedRef = useRef(false);
  

  // Detect desktop for background loading optimization
  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    if (typeof window !== 'undefined') {
      checkDevice();
      window.addEventListener('resize', checkDevice);
      return () => window.removeEventListener('resize', checkDevice);
    }
  }, []);

  // Early background loading for desktop - start immediately when component mounts
  useEffect(() => {
    if (!isClient || !isDesktop || preloadAttemptedRef.current) return;
    
    preloadAttemptedRef.current = true;
    
    // Try to preload background image from album title
    const preloadBackgroundImage = async () => {
      try {
        // Use the new specific album API endpoint for much faster lookup
        const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}`);
        if (response.ok) {
          const data = await response.json();
          const foundAlbum = data.album;
          
          if (foundAlbum?.coverArt) {
            console.log('🎨 Preloading background image for desktop:', foundAlbum.coverArt);
            
            // Add cache-busting parameter to prevent stale cache issues
            const cacheBuster = Date.now();
            const imageUrlWithCacheBuster = (typeof foundAlbum.coverArt === 'string' && foundAlbum.coverArt.includes('?')) 
              ? `${foundAlbum.coverArt}&cb=${cacheBuster}`
              : `${foundAlbum.coverArt}?cb=${cacheBuster}`;
            
            // Preload the image
            const img = new window.Image();
            img.onload = () => {
              console.log('✅ Background image preloaded successfully:', foundAlbum.coverArt);
              setBackgroundImage(imageUrlWithCacheBuster);
              setBackgroundLoaded(true);
            };
            img.onerror = (error) => {
              console.error('❌ Background image preload failed:', foundAlbum.coverArt, error);
              
              // Try image proxy for external URLs (but never for data URLs)
              if (foundAlbum.coverArt && 
                  typeof foundAlbum.coverArt === 'string' && 
                  !foundAlbum.coverArt.includes('re.podtards.com') &&
                  !foundAlbum.coverArt.startsWith('data:')) {
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(foundAlbum.coverArt)}`;
                console.log('🔄 Trying image proxy for background:', proxyUrl);
                
                const proxyImg = new window.Image();
                proxyImg.onload = () => {
                  console.log('✅ Background image preloaded with proxy:', proxyUrl);
                  setBackgroundImage(proxyUrl);
                  setBackgroundLoaded(true);
                };
                proxyImg.onerror = (proxyError) => {
                  console.error('❌ Background image proxy also failed:', proxyUrl, proxyError);
                  // Final fallback - try original URL without cache buster
                  const fallbackImg = new window.Image();
                  fallbackImg.onload = () => {
                    console.log('✅ Background image preloaded with fallback URL:', foundAlbum.coverArt);
                    setBackgroundImage(foundAlbum.coverArt || null);
                    setBackgroundLoaded(true);
                  };
                  fallbackImg.onerror = (fallbackError) => {
                    console.error('❌ Background image preload fallback also failed:', foundAlbum.coverArt, fallbackError);
                    setBackgroundImage(null);
                    setBackgroundLoaded(true);
                  };
                  fallbackImg.decoding = 'async';
                  fallbackImg.src = foundAlbum.coverArt;
                };
                proxyImg.decoding = 'async';
                proxyImg.src = proxyUrl;
              } else {
                // For internal URLs, try without cache buster as fallback
                const fallbackImg = new window.Image();
                fallbackImg.onload = () => {
                  console.log('✅ Background image preloaded with fallback URL:', foundAlbum.coverArt);
                  setBackgroundImage(foundAlbum.coverArt || null);
                  setBackgroundLoaded(true);
                };
                fallbackImg.onerror = (fallbackError) => {
                  console.error('❌ Background image preload fallback also failed:', foundAlbum.coverArt, fallbackError);
                  setBackgroundImage(null);
                  setBackgroundLoaded(true);
                };
                fallbackImg.decoding = 'async';
                fallbackImg.src = foundAlbum.coverArt;
              }
            };
            
            img.decoding = 'async';
            img.src = imageUrlWithCacheBuster;
          } else {
            console.log('🚫 No album found for preloading, using gradient background');
            setBackgroundImage(null);
            setBackgroundLoaded(true);
          }
        }
      } catch (error) {
        console.error('❌ Error preloading background image:', error);
        setBackgroundImage(null);
        setBackgroundLoaded(true);
      }
    };
    
    preloadBackgroundImage();
  }, [isClient, isDesktop, albumTitle]); // Fixed dependencies to prevent infinite loops

  // Update Media Session API for iOS lock screen controls
  const updateMediaSession = (track: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: album?.artist || 'Unknown Artist',
        album: album?.title || 'Unknown Album',
        artwork: [
          { src: album?.coverArt || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    }
  };

  const formatDuration = (duration: string): string => {
    if (!duration || duration.trim() === '') return '0:00';
    
    const durationStr = duration.trim();
    
    // Handle edge cases first
    if (durationStr === 'NaN' || durationStr === 'undefined' || durationStr === 'null') {
      return '0:00';
    }
    
    // If already formatted with colon, validate and return
    if (durationStr.includes(':')) {
      const parts = durationStr.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        if (!isNaN(mins) && !isNaN(secs) && mins >= 0 && mins < 1440 && secs >= 0 && secs < 60) {
          return durationStr;
        }
      } else if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const mins = parseInt(parts[1]);
        const secs = parseInt(parts[2]);
        if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs) && 
            hours >= 0 && hours < 24 && mins >= 0 && mins < 60 && secs >= 0 && secs < 60) {
          const totalMinutes = hours * 60 + mins;
          return `${totalMinutes}:${secs.toString().padStart(2, '0')}`;
        }
      }
      // Invalid colon format, fall through to seconds parsing
    }
    
    // If it's just seconds, convert to MM:SS format
    const seconds = parseInt(durationStr);
    if (!isNaN(seconds) && seconds >= 0 && seconds < 86400) { // Max 24 hours
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // If all else fails, return default
    return '0:00';
  };

  const formatTime = (time: number): string => {
    if (isNaN(time) || time < 0) return '0:00';
    
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateTotalDuration = (tracks: any[]): string => {
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return '0';
    }

    let totalSeconds = 0;
    
    for (const track of tracks) {
      if (!track.duration) continue;
      
      const duration = track.duration.toString().trim();
      
      // Skip invalid durations
      if (duration === 'NaN' || duration === 'undefined' || duration === 'null' || duration === '') {
        continue;
      }
      
      // Handle MM:SS or HH:MM:SS format
      if (duration.includes(':')) {
        const parts = duration.split(':');
        if (parts.length === 2) {
          const mins = parseInt(parts[0]);
          const secs = parseInt(parts[1]);
          if (!isNaN(mins) && !isNaN(secs)) {
            totalSeconds += (mins * 60) + secs;
          }
        } else if (parts.length === 3) {
          const hours = parseInt(parts[0]);
          const mins = parseInt(parts[1]);
          const secs = parseInt(parts[2]);
          if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs)) {
            totalSeconds += (hours * 3600) + (mins * 60) + secs;
          }
        }
      } else {
        // Handle seconds format
        const seconds = parseInt(duration);
        if (!isNaN(seconds) && seconds > 0) {
          totalSeconds += seconds;
        }
      }
    }
    
    // Convert total seconds to minutes (rounded)
    const totalMinutes = Math.round(totalSeconds / 60);
    return totalMinutes.toString();
  };

  const getAlbumYear = (releaseDate: string): string => {
    if (!releaseDate) {
      return new Date().getFullYear().toString();
    }
    
    const date = new Date(releaseDate);
    const year = date.getFullYear();
    
    // Check if the year is valid (not NaN and within reasonable range)
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      return new Date().getFullYear().toString();
    }
    
    return year.toString();
  };

  // Audio player functions
  const togglePlay = async () => {
    if (globalIsPlaying && currentPlayingAlbum?.title === album?.title) {
      globalPause();
    } else {
      if (album && album.tracks.length > 0) {
        await playTrack(globalTrackIndex);
      }
    }
  };

  const playTrack = async (index: number) => {
    // Prevent accidental clicks while scrolling
    if (shouldPreventClick()) {
      console.log('🚫 Prevented accidental track click while scrolling');
      return;
    }

    if (!album || !album.tracks[index] || !album.tracks[index].url) {
      console.error('❌ Missing album, track, or URL');
      return;
    }
    
    console.log('🎵 Attempting to play track:', album.tracks[index].title, 'URL:', album.tracks[index].url);
    
    // Use global audio context for playback
    const success = await globalPlayAlbum(album, index);
    
    if (success) {
      console.log('✅ Track playback started successfully via global audio context');
      
      // Update Media Session for lock screen controls
      updateMediaSession(album.tracks[index]);
    } else {
      console.error('❌ Failed to play track via global audio context');
      setError('Unable to play audio - please try a different track');
      setTimeout(() => setError(null), 5000);
    }
  };

  const playAlbum = async () => {
    if (album && album.tracks.length > 0) {
      await playTrack(0);
    }
  };

  const nextTrack = async () => {
    if (album && globalTrackIndex < album.tracks.length - 1) {
      await playTrack(globalTrackIndex + 1);
    }
  };

  const prevTrack = async () => {
    if (album && globalTrackIndex > 0) {
      await playTrack(globalTrackIndex - 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    globalSeek(time);
  };

  // Initialize client state
  useEffect(() => {
    setIsClient(true);
  }, []);


  // Update background when album data changes - simplified version
  useEffect(() => {
    // Don't run background effect while loading or if album is null
    if (isLoading || !album?.coverArt) {
      return;
    }
    
    // Reset loading states when album changes
    setBackgroundLoaded(false);
    setAlbumArtLoaded(false);
    
    // Simple background image loading without complex fallbacks
    if (album?.coverArt) {
      console.log('🖼️ Loading background image:', album?.coverArt);
      console.log('🖼️ Album found:', album.title);
      setBackgroundImage(album.coverArt);
      setBackgroundLoaded(true);
    } else {
      console.log('🚫 No cover art available, using gradient background');
      console.log('🚫 Album data:', album ? 'Album exists but no coverArt' : 'No album found');
      if (album) {
        console.log('🚫 Album title:', album.title);
      }
      setBackgroundImage(null);
      setBackgroundLoaded(true);
    }
  }, [album?.coverArt, isLoading]); // Simplified dependencies to prevent infinite loop

  // Optimized background style calculation - memoized to prevent repeated logs
  const backgroundStyle = useMemo(() => {
    // Create a fixed background that overrides the global layout background
    const baseStyle = {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1  // Override global background (which is z-0)
    };
    
    const style = backgroundImage && isClient ? {
      ...baseStyle,
      backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('${backgroundImage}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    } : {
      ...baseStyle,
      background: 'linear-gradient(to bottom right, rgb(17, 24, 39), rgb(31, 41, 55), rgb(17, 24, 39))'
    };

    return style;
  }, [backgroundImage, isClient]);

  // Load album data if not provided initially
  useEffect(() => {
    if (!initialAlbum && !loadingStarted) {
      setLoadingStarted(true);
      const loadAlbum = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Use the new specific album API endpoint for much faster lookup
          console.log(`🔍 Loading album: ${albumTitle} (ID: ${albumId})`);
          const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Album not found');
            }
            throw new Error(`Failed to fetch album: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          const foundAlbum = data.album;
            
            if (foundAlbum) {
              console.log(`✅ Successfully loaded album: ${foundAlbum.title} by ${foundAlbum.artist}`);
              
              // Validate album data structure
              if (!Array.isArray(foundAlbum.tracks)) {
                console.warn('⚠️ Album tracks is not an array:', foundAlbum.tracks);
                // Ensure tracks is always an array
                foundAlbum.tracks = [];
              }
              
              setAlbum(foundAlbum);
              
              // Load Doerfels publisher data for all albums
              loadDoerfelsPublisherData();
              // Load PodRoll albums if they exist
              if (foundAlbum.podroll && foundAlbum.podroll.length > 0) {
                loadPodrollAlbums(foundAlbum.podroll);
              }
              // Load Publisher feed albums if publisher exists
              if (foundAlbum.publisher && foundAlbum.publisher.feedUrl && typeof foundAlbum.publisher.feedUrl === 'string') {
                loadPublisherAlbums(foundAlbum.publisher.feedUrl);
              }
            } else {
              setError('Album not found');
            }
        } catch (err) {
          console.error('Error loading album:', err);
          setError('Error loading album data');
        } finally {
          setIsLoading(false);
        }
      };

      loadAlbum();
    } else if (initialAlbum) {
      // Validate initial album data structure
      if (!Array.isArray(initialAlbum.tracks)) {
        console.warn('⚠️ Initial album tracks is not an array:', initialAlbum.tracks);
        // Create a copy with proper tracks array
        const validatedAlbum = {
          ...initialAlbum,
          tracks: []
        };
        setAlbum(validatedAlbum);
      } else {
        setAlbum(initialAlbum);
      }
      
      // Load Doerfels publisher data for all albums
      loadDoerfelsPublisherData();
      // Load PodRoll albums if they exist
      if (initialAlbum.podroll && initialAlbum.podroll.length > 0) {
        loadPodrollAlbums(initialAlbum.podroll);
      }
      // Load Publisher feed albums if publisher exists
      if (initialAlbum.publisher && initialAlbum.publisher.feedUrl && typeof initialAlbum.publisher.feedUrl === 'string') {
        loadPublisherAlbums(initialAlbum.publisher.feedUrl);
      }
    }
  }, [albumTitle, initialAlbum, loadingStarted]);

  const loadPodrollAlbums = async (podrollItems: { url: string; title?: string; description?: string }[]) => {
    try {
      // Load pre-parsed album data and filter for podroll items
      const response = await fetch('/api/albums');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const allAlbums = data.albums || [];
      
      // Filter albums that match the podroll URLs
      const podrollUrls = podrollItems.map(item => item.url).filter(url => typeof url === 'string');
      const podrollAlbumsData = allAlbums.filter((album: any) => {
        return album.feedUrl && 
               typeof album.feedUrl === 'string' &&
               podrollUrls.some(url => album.feedUrl === url);
      });
      
      setPodrollAlbums(podrollAlbumsData);
    } catch (err) {
      console.error('Error loading PodRoll albums:', err);
    }
  };

  const loadPublisherAlbums = async (publisherFeedUrl: string) => {
    try {
      // Validate input
      if (!publisherFeedUrl || typeof publisherFeedUrl !== 'string') {
        console.warn('⚠️ Invalid publisher feed URL:', publisherFeedUrl);
        return;
      }
      
      console.log(`🏢 Loading albums from publisher feed: ${publisherFeedUrl}`);
      
      // Load pre-parsed album data and filter for publisher albums
      const response = await fetch('/api/albums');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const allAlbums = data.albums || [];
      
      // Filter albums that belong to the publisher
      const publisherAlbumsData = allAlbums.filter((album: any) => {
        return album.publisher && 
               album.publisher.feedUrl && 
               typeof album.publisher.feedUrl === 'string' &&
               album.publisher.feedUrl === publisherFeedUrl;
      });
      
      // Only add publisher albums to recommendations if there are already podroll albums
      // (This prevents "You Might Also Like" from appearing for albums without podrolls)
      setPodrollAlbums(prevAlbums => {
        // Only show publisher albums if there are existing podroll recommendations
        if (prevAlbums.length === 0) {
          console.log(`🎶 No podroll albums found, not showing publisher recommendations for this album`);
          return prevAlbums;
        }
        
        // Combine and deduplicate based on title+artist
        const combined = [...prevAlbums];
        const existingKeys = new Set(prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
        
        publisherAlbumsData.forEach((album: any) => {
          const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
          if (!existingKeys.has(key)) {
            combined.push(album);
            existingKeys.add(key);
          }
        });
        
        console.log(`🎶 Added ${publisherAlbumsData.length} albums from publisher to existing podroll, total recommendations: ${combined.length}`);
        return combined;
      });
    } catch (err) {
      console.error('Error loading Publisher albums:', err);
    }
  };

  // Load Doerfels publisher feed data
  const loadDoerfelsPublisherData = async () => {
    try {
      console.log('🎵 Loading Doerfels publisher feed data...');
      const response = await fetch('/api/feeds/doerfels-pubfeed');
      if (response.ok) {
        const feedText = await response.text();
        
        // Parse the XML to extract publisher info and album list
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(feedText, 'text/xml');
        
        // Extract publisher information
        const channel = xmlDoc.querySelector('channel');
        if (channel) {
          const title = channel.querySelector('title')?.textContent || 'The Doerfels';
          const description = channel.querySelector('description')?.textContent || '';
          const link = channel.querySelector('link')?.textContent || 'https://www.doerfelverse.com/';
          const image = channel.querySelector('itunes\\:image')?.getAttribute('href') || '';
          
          setDoerfelsPublisherInfo({
            title,
            description,
            link,
            image
          });
        }
        
        // Extract remote items (albums)
        const remoteItems = xmlDoc.querySelectorAll('podcast\\:remoteItem');
        const albums = Array.from(remoteItems).map(item => ({
          feedGuid: item.getAttribute('feedGuid') || '',
          feedUrl: item.getAttribute('feedUrl') || '',
          title: item.getAttribute('title') || ''
        }));
        
        setRelatedDoerfelsAlbums(albums);
        
        // Check if current album is a Doerfels album
        if (album) {
          const isDoerfels = albums.some(doerfelsAlbum => 
            doerfelsAlbum.title.toLowerCase() === album.title.toLowerCase() ||
            doerfelsAlbum.feedUrl.includes(album.title.toLowerCase().replace(/\s+/g, '-'))
          );
          setIsDoerfelsAlbum(isDoerfels);
        }
        
        console.log('✅ Loaded Doerfels publisher data:', { albums: albums.length, isDoerfelsAlbum: isDoerfelsAlbum });
      }
    } catch (error) {
      console.warn('Failed to load Doerfels publisher feed:', error);
    }
  };

  if (isLoading) {
    return (
      <>
        {/* Background layer */}
        <div style={backgroundStyle} />
        <div className="min-h-screen text-white relative z-10">
          <div className="container mx-auto px-6 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold">Loading Album...</h1>
              {isDesktop && backgroundImage && (
                <p className="text-gray-400 mt-2">Background loaded, content loading...</p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">
              {error === 'Album not found' ? 'Album Not Available' : (error || 'Album Not Found')}
            </h1>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {error === 'Album not found' 
                ? 'This album may not be available in our current collection or may have been temporarily removed.'
                : 'We couldn\'t load this album. Please check the URL or try again later.'
              }
            </p>
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
              ← Back to Albums
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Background layer - fixed positioned to override global layout background */}
      <div style={backgroundStyle} />
      
      {/* Content layer - relative positioned above background */}
      <div className="min-h-screen text-white relative z-10">
        <div className="container mx-auto px-6 pt-16 md:pt-12 pb-40">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Albums
        </Link>

        {/* Album Header */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Album Art with Play Button Overlay */}
          <div className="relative group mx-auto w-[280px] h-[280px]">
            <CDNImage 
              src={album?.coverArt || ''} 
              alt={album.title}
              width={280}
              height={280}
              className={`rounded-lg object-cover shadow-2xl transition-opacity duration-500 w-full h-full ${
                albumArtLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ objectFit: 'cover' }}
              priority // Always prioritize album art loading
              onLoad={() => setAlbumArtLoaded(true)}
              onError={() => setAlbumArtLoaded(true)}
            />
            
            {/* Loading placeholder - show when album art is not loaded */}
            {!albumArtLoaded && (
              <div className="absolute inset-0 w-full h-full bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
                <div className="text-gray-400 text-sm">Loading...</div>
              </div>
            )}
            
            {/* Play Button Overlay - Always visible and prominent on mobile */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={globalIsPlaying && currentPlayingAlbum?.title === album?.title ? togglePlay : playAlbum}
                className="bg-white/95 hover:bg-white active:bg-white text-black rounded-full p-4 transform hover:scale-110 active:scale-95 transition-all duration-200 shadow-2xl border-2 border-white/30 z-10 touch-manipulation"
                style={{ minWidth: '64px', minHeight: '64px' }}
              >
                {globalIsPlaying && currentPlayingAlbum?.title === album?.title ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Album Info */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{album.title}</h1>
            <p className="text-xl text-gray-300">{album.artist}</p>
            
            {album.subtitle && (
              <p className="text-lg text-gray-300 italic">{album.subtitle}</p>
            )}
            
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <span>{getAlbumYear(album.releaseDate)}</span>
              <span>{Array.isArray(album.tracks) ? album.tracks.length : 0} tracks</span>
              <span>{calculateTotalDuration(album.tracks)} min</span>
              {album.explicit && <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">EXPLICIT</span>}
            </div>
            
            {(album.summary || album.description) && (
              <p className="text-gray-300 text-center max-w-lg mx-auto leading-relaxed">{album.summary || album.description}</p>
            )}

            {/* Publisher Information */}
            {album.publisher && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span>More from this artist:</span>
                <Link
                  href={`/publisher/${generatePublisherSlug({ artist: album.artist, feedGuid: album.publisher.feedGuid })}`}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View Discography
                </Link>
                <span className="text-xs bg-gray-600 px-2 py-1 rounded">PC 2.0</span>
              </div>
            )}

            {/* Funding Information */}
            {album.funding && album.funding.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white text-center">Support This Artist</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {album.funding.map((funding, index) => (
                    <a
                      key={index}
                      href={funding.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      💝 {funding.message || 'Support'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Doerfels Publisher Information */}
        {isDoerfelsAlbum && doerfelsPublisherInfo && (
          <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 backdrop-blur-sm rounded-lg p-6 mb-8 border border-blue-500/30">
            <div className="flex items-center gap-4 mb-4">
              {doerfelsPublisherInfo.image && (
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <CDNImage
                    src={doerfelsPublisherInfo.image}
                    alt="The Doerfels"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-blue-300">The Doerfels</h3>
                <p className="text-gray-300 text-sm">
                  Family band from Buffalo, NY creating original music across multiple genres
                </p>
                <a 
                  href={doerfelsPublisherInfo.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  Visit DoerfelVerse →
                </a>
              </div>
            </div>
            
            {/* Related Doerfels Albums */}
            {relatedDoerfelsAlbums.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-3 text-white">More from The Doerfels</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {relatedDoerfelsAlbums.slice(0, 6).map((doerfelsAlbum, index) => (
                    <div key={index} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all duration-200">
                      <div className="aspect-square bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-md mb-2 flex items-center justify-center">
                        <span className="text-blue-300 text-xs text-center font-medium">
                          {doerfelsAlbum.title}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs truncate">
                        {doerfelsAlbum.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Track List */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-center sm:text-left">Tracks</h2>
            
            {/* Shuffle Controls */}
            <ControlsBar
              activeFilter="all"
              onFilterChange={() => {}}
              showFilters={false}
              sortType="name"
              onSortChange={() => {}}
              showSort={false}
              viewType="list"
              onViewChange={() => {}}
              showViewToggle={false}
              onShuffle={shuffleAllTracks}
              showShuffle={true}
              resultCount={album.tracks.length}
              resultLabel="tracks"
              className="flex-shrink-0"
            />
          </div>
          <div className="space-y-2">
            {album.tracks.map((track, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-4 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
                  globalTrackIndex === index && currentPlayingAlbum?.title === album?.title ? 'bg-white/20' : ''
                }`}
                onClick={() => playTrack(index)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded">
                    {/* Use track-specific artwork if available, fallback to album artwork */}
                    <CDNImage 
                      src={track.image || album?.coverArt || ''} 
                      alt={track.title}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      priority={index < 5} // Priority for first 5 tracks
                    />
                    {/* Play Button Overlay - On album artwork */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                      <button 
                        className="bg-white text-black rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(index);
                        }}
                      >
                        {globalTrackIndex === index && globalIsPlaying && currentPlayingAlbum?.title === album?.title ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm md:text-base">{track.title}</p>
                    {track.subtitle && (
                      <p className="text-xs md:text-sm text-gray-400 italic truncate">{track.subtitle}</p>
                    )}
                    <p className="text-xs md:text-sm text-gray-400 truncate">{album?.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                  {track.explicit && (
                    <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                      E
                    </span>
                  )}
                  <span className="text-xs md:text-sm text-gray-400">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PodRoll and Publisher Recommendations */}
        {podrollAlbums.length > 0 && (
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">You Might Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {podrollAlbums.map((podrollAlbum, index) => (
                <Link
                  key={index}
                  href={generateAlbumUrl(podrollAlbum.title)}
                  className="group block"
                >
                  <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all duration-200 hover:scale-105">
                    <div className="aspect-square relative mb-3">
                      <Image 
                        src={getAlbumArtworkUrl(podrollAlbum.coverArt || '', 'thumbnail')} 
                        alt={podrollAlbum.title}
                        width={150}
                        height={150}
                        className="w-full h-full object-cover rounded-md"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          const target = e.target as HTMLImageElement;
                          target.src = getPlaceholderImageUrl('thumbnail');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-md transition-all duration-200 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {podrollAlbum.title}
                    </h3>
                    <p className="text-gray-400 text-xs">
                      {podrollAlbum.artist}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
} 