'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddRSSFeed from '@/components/AddRSSFeed';
import AlbumCard from '@/components/AlbumCard';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generatePublisherSlug } from '@/lib/url-utils';
import { getGlobalAudioState, updateGlobalAudioState, clearGlobalAudioState } from '@/lib/audio-state';
import { getVersionString } from '@/lib/version';
import ControlsBar, { FilterType, ViewType, SortType } from '@/components/ControlsBar';
import { AppError, ErrorCodes, ErrorCode, getErrorMessage, createErrorLogger } from '@/lib/error-utils';
import { toast } from '@/components/Toast';

// Environment-based RSS feed configuration
// CDN zone: re-podtards-cdn-new (WORKING - new Pull Zone that points to Storage Zone)
const isProduction = process.env.NODE_ENV === 'production';

const logger = createErrorLogger('MainPage');

// Separate album feeds from publisher feeds: [originalUrl, cdnUrl, type]
const feedUrlMappings = [
  // Core Doerfels feeds - verified working (Albums)
  ['https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/music-from-the-doerfelverse.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/bloodshot-lies-album.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/intothedoerfelverse.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/intothedoerfelverse.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/wrath-of-banjo.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wrath-of-banjo.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/ben-doerfel.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ben-doerfel.xml', 'album'],
  
  // Additional Doerfels albums and projects - all verified working (Albums)
  ['https://www.doerfelverse.com/feeds/18sundays.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/18sundays.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/alandace.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/alandace.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/autumn.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/autumn.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/christ-exalted.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/christ-exalted.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/come-back-to-me.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/come-back-to-me.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dead-time-live-2016.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dead-time-live-2016.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dfbv1.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dfbv1.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dfbv2.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dfbv2.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/disco-swag.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/disco-swag.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/first-married-christmas.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/first-married-christmas.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/generation-gap.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/generation-gap.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/heartbreak.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/heartbreak.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/merry-christmix.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/merry-christmix.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/middle-season-let-go.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/middle-season-let-go.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/phatty-the-grasshopper.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/possible.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/possible.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/pour-over.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/pour-over.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/psalm-54.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/psalm-54.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/sensitive-guy.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/sensitive-guy.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/they-dont-know.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/they-dont-know.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/think-ep.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/think-ep.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/underwater-single.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/underwater-single.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/unsound-existence.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/unsound-existence.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/you-are-my-world.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/you-are-my-world.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/you-feel-like-home.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/you-feel-like-home.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/your-chance.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/your-chance.xml', 'album'],
  ['https://www.doerfelverse.com/artists/opus/opus/opus.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/opus.xml', 'album'],
  
  // Ed Doerfel (Shredward) projects - verified working (Albums)
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/nostalgic.xml', 'album'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/citybeach.xml', 'album'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/kurtisdrums-v1.xml', 'album'],
  
  // TJ Doerfel projects - verified working (Albums)
  ['https://www.thisisjdog.com/media/ring-that-bell.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ring-that-bell.xml', 'album'],
  
  // External artists - verified working (Albums)
  ['https://ableandthewolf.com/static/media/feed.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ableandthewolf-feed.xml', 'album'],
  ['https://static.staticsave.com/mspfiles/deathdreams.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/deathdreams.xml', 'album'],
  ['https://static.staticsave.com/mspfiles/waytogo.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/waytogo.xml', 'album'],
  // Temporarily disabled due to NetworkError issues
  // ['https://feed.falsefinish.club/Vance%20Latta/Vance%20Latta%20-%20Love%20In%20Its%20Purest%20Form/love%20in%20its%20purest%20form.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/vance-latta-love-in-its-purest-form.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now%20i%20feel%20it.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/c-kostra-now-i-feel-it.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/mellow-cassette-pilot.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/mellow-cassette-radio-brigade.xml', 'album'],
  
  // Wavlake music feeds - verified working (Albums)
  ['https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-d677db67-0310-4813-970e-e65927c689f1.xml', 'album'],
  ['https://wavlake.com/feed/music/e678589b-5a9f-4918-9622-34119d2eed2c', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-e678589b-5a9f-4918-9622-34119d2eed2c.xml', 'album'],
  ['https://wavlake.com/feed/music/3a152941-c914-43da-aeca-5d7c58892a7f', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-3a152941-c914-43da-aeca-5d7c58892a7f.xml', 'album'],
  ['https://wavlake.com/feed/music/a97e0586-ecda-4b79-9c38-be9a9effe05a', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-a97e0586-ecda-4b79-9c38-be9a9effe05a.xml', 'album'],
  ['https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-0ed13237-aca9-446f-9a03-de1a2d9331a3.xml', 'album'],
  ['https://wavlake.com/feed/music/ce8c4910-51bf-4d5e-a0b3-338e58e5ee79', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-ce8c4910-51bf-4d5e-a0b3-338e58e5ee79.xml', 'album'],
  ['https://wavlake.com/feed/music/acb43f23-cfec-4cc1-a418-4087a5378129', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-acb43f23-cfec-4cc1-a418-4087a5378129.xml', 'album'],
  ['https://wavlake.com/feed/music/d1a871a7-7e4c-4a91-b799-87dcbb6bc41d', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-d1a871a7-7e4c-4a91-b799-87dcbb6bc41d.xml', 'album'],
  ['https://wavlake.com/feed/music/3294d8b5-f9f6-4241-a298-f04df818390c', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-3294d8b5-f9f6-4241-a298-f04df818390c.xml', 'album'],
  ['https://wavlake.com/feed/music/d3145292-bf71-415f-a841-7f5c9a9466e1', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-d3145292-bf71-415f-a841-7f5c9a9466e1.xml', 'album'],
  ['https://wavlake.com/feed/music/91367816-33e6-4b6e-8eb7-44b2832708fd', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-91367816-33e6-4b6e-8eb7-44b2832708fd.xml', 'album'],
  ['https://wavlake.com/feed/music/8c8f8133-7ef1-4b72-a641-4e1a6a44d626', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-8c8f8133-7ef1-4b72-a641-4e1a6a44d626.xml', 'album'],
  ['https://wavlake.com/feed/music/9720d58b-22a5-4047-81de-f1940fec41c7', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-9720d58b-22a5-4047-81de-f1940fec41c7.xml', 'album'],
  ['https://wavlake.com/feed/music/21536269-5192-49e7-a819-fab00f4a159e', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-21536269-5192-49e7-a819-fab00f4a159e.xml', 'album'],
  ['https://wavlake.com/feed/music/624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e.xml', 'album'],
  ['https://wavlake.com/feed/music/997060e3-9dc1-4cd8-b3c1-3ae06d54bb03', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-997060e3-9dc1-4cd8-b3c1-3ae06d54bb03.xml', 'album'],
  ['https://wavlake.com/feed/music/b54b9a19-b6ed-46c1-806c-7e82f7550edc', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-b54b9a19-b6ed-46c1-806c-7e82f7550edc.xml', 'album'],
  
  // Joe Martin (Wavlake) - Album and Publisher feeds
  ['https://wavlake.com/feed/music/95ea253a-4058-402c-8503-204f6d3f1494', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-95ea253a-4058-402c-8503-204f6d3f1494.xml', 'album'],
  ['https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-18bcbf10-6701-4ffb-b255-bc057390d738.xml', 'publisher'],
  
  // IROH (Wavlake) - Album and Publisher feeds
  ['https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-8a9c2e54-785a-4128-9412-737610f5d00a.xml', 'publisher'],
  ['https://wavlake.com/feed/music/1c7917cc-357c-4eaf-ab54-1a7cda504976', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-1c7917cc-357c-4eaf-ab54-1a7cda504976.xml', 'album'],
  ['https://wavlake.com/feed/music/e1f9dfcb-ee9b-4a6d-aee7-189043917fb5', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-e1f9dfcb-ee9b-4a6d-aee7-189043917fb5.xml', 'album'],
  ['https://wavlake.com/feed/music/d4f791c3-4d0c-4fbd-a543-c136ee78a9de', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-d4f791c3-4d0c-4fbd-a543-c136ee78a9de.xml', 'album'],
  ['https://wavlake.com/feed/music/51606506-66f8-4394-b6c6-cc0c1b554375', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-51606506-66f8-4394-b6c6-cc0c1b554375.xml', 'album'],
  ['https://wavlake.com/feed/music/6b7793b8-fd9d-432b-af1a-184cd41aaf9d', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-6b7793b8-fd9d-432b-af1a-184cd41aaf9d.xml', 'album'],
  ['https://wavlake.com/feed/music/0bb8c9c7-1c55-4412-a517-572a98318921', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-0bb8c9c7-1c55-4412-a517-572a98318921.xml', 'album'],
  ['https://wavlake.com/feed/music/16e46ed0-b392-4419-a937-a7815f6ca43b', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-16e46ed0-b392-4419-a937-a7815f6ca43b.xml', 'album'],
  ['https://wavlake.com/feed/music/2cd1b9ea-9ef3-4a54-aa25-55295689f442', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-2cd1b9ea-9ef3-4a54-aa25-55295689f442.xml', 'album'],
  ['https://wavlake.com/feed/music/33eeda7e-8591-4ff5-83f8-f36a879b0a09', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-33eeda7e-8591-4ff5-83f8-f36a879b0a09.xml', 'album'],
  ['https://wavlake.com/feed/music/32a79df8-ec3e-4a14-bfcb-7a074e1974b9', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-32a79df8-ec3e-4a14-bfcb-7a074e1974b9.xml', 'album'],
  ['https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-06376ab5-efca-459c-9801-49ceba5fdab1.xml', 'album'],
  
  // Additional Wavlake Publisher feeds - these need to be identified (currently missing one)
  ['https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-aa909244-7555-4b52-ad88-7233860c6fb4.xml', 'publisher'],
];

// Separate album feeds from publisher feeds
const albumFeeds = feedUrlMappings.filter(([, , type]) => type === 'album').map(([originalUrl, cdnUrl]) => 
  isProduction ? cdnUrl : originalUrl
);

const publisherFeeds = feedUrlMappings.filter(([, , type]) => type === 'publisher').map(([originalUrl, cdnUrl]) => 
  isProduction ? cdnUrl : originalUrl
);

// For backwards compatibility, keep feedUrls as album feeds only
const feedUrls = albumFeeds;

// Debug logging
console.log('🔧 Environment check:', { isProduction, NODE_ENV: process.env.NODE_ENV });
console.log('🔧 Feed URLs count:', feedUrls.length);
console.log('🔧 First few feed URLs:', feedUrls.slice(0, 3));

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [customFeeds, setCustomFeeds] = useState<string[]>([]);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Audio player state for main page
  const [currentPlayingAlbum, setCurrentPlayingAlbum] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasLoadedRef = useRef(false);
  
  // Rotating background state
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0);
  const [backgroundAlbums, setBackgroundAlbums] = useState<RSSAlbum[]>([]);
  const backgroundIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Controls state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [sortType, setSortType] = useState<SortType>('name');

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    console.log('🔄 useEffect triggered - starting to load albums');
    console.log('🔄 hasLoadedRef.current:', hasLoadedRef.current);
    console.log('🔄 isClient:', isClient);
    
    // Always try to load, regardless of hasLoadedRef
    console.log('🔄 Attempting to load albums...');
    
    // Try to load from cache first
    if (typeof window !== 'undefined') {
      const cachedAlbums = localStorage.getItem('cachedAlbums');
      const cacheTimestamp = localStorage.getItem('albumsCacheTimestamp');
      
      if (cachedAlbums && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes
        
        if (cacheValid) {
          try {
            const parsedAlbums = JSON.parse(cachedAlbums);
            console.log('📦 Loading albums from cache:', parsedAlbums.length, 'albums');
            setAlbums(parsedAlbums);
            setIsLoading(false);
            return;
          } catch (error) {
            console.warn('⚠️ Failed to parse cached albums:', error);
          }
        }
      }
    }
    
    // Add a small delay to let the UI render first
    setTimeout(() => {
      console.log('🔄 Calling loadAlbumsData after timeout');
      loadAlbumsData();
    }, 100);
  }, [isClient]); // Add isClient as dependency

  // Initialize audio state from localStorage
  useEffect(() => {
    const globalState = getGlobalAudioState();
    if (globalState.isPlaying && globalState.currentAlbum && globalState.trackUrl) {
      // Only restore state if we have a valid audio element and it can actually play
      if (audioRef.current) {
        // Set up the audio element
        audioRef.current.src = globalState.trackUrl;
        audioRef.current.currentTime = globalState.currentTime;
        audioRef.current.volume = globalState.volume;
        
        // Check if the audio is actually ready to play
        const checkAudioReady = () => {
          if (audioRef.current && audioRef.current.readyState >= 2) {
            // Audio is ready, restore state
            setCurrentPlayingAlbum(globalState.currentAlbum);
            setCurrentTrackIndex(globalState.currentTrackIndex);
            
            // Only set as playing if the audio is actually playing
            if (audioRef.current && !audioRef.current.paused) {
              setIsPlaying(true);
            } else {
              // Audio is not actually playing, clear the playing state
              setIsPlaying(false);
              updateGlobalAudioState({ isPlaying: false });
            }
          } else {
            // Audio not ready yet, try again in a moment
            setTimeout(checkAudioReady, 100);
          }
        };
        
        checkAudioReady();
      } else {
        // No audio element available, clear the playing state
        setIsPlaying(false);
        updateGlobalAudioState({ isPlaying: false });
      }
    }
  }, []);

  // Mobile audio initialization - handle autoplay restrictions
  useEffect(() => {
    if (typeof window !== 'undefined' && audioRef.current) {
      // Add touch event listener to initialize audio context on mobile
      const handleTouchStart = () => {
        if (audioRef.current) {
          // Try to play and immediately pause to initialize audio context
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
          }).catch(() => {
            // Ignore autoplay errors - this is just for initialization
          });
          
          // Remove the listener after first touch
          document.removeEventListener('touchstart', handleTouchStart);
        }
      };
      
      document.addEventListener('touchstart', handleTouchStart);
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
      };
    }
  }, []);

  // Audio event listeners to properly track state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      updateGlobalAudioState({ isPlaying: true }, audioRef.current || undefined);
    };

    const handlePause = () => {
      setIsPlaying(false);
      updateGlobalAudioState({ isPlaying: false }, audioRef.current || undefined);
    };

    const handleEnded = () => {
      // Try to play next track, or reset if no more tracks
      playNextTrack();
    };

    const handleError = (event: Event) => {
      const audioError = (event.target as HTMLAudioElement)?.error;
      let errorMessage = 'Audio playback failed';
      
      if (audioError) {
        switch (audioError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio playback was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio file is corrupted or unsupported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported';
            break;
        }
      }
      
      logger.error('Audio playback error', audioError, {
        currentAlbum: currentPlayingAlbum,
        trackIndex: currentTrackIndex,
        errorCode: audioError?.code,
        errorMessage: audioError?.message
      });
      
      toast.error(errorMessage);
      
      setIsPlaying(false);
      setCurrentPlayingAlbum(null);
      updateGlobalAudioState({ 
        isPlaying: false, 
        currentAlbum: null, 
        trackUrl: null 
      });
    };

    // Add event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Cleanup
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [currentPlayingAlbum, currentTrackIndex]); // Re-add listeners when album/track changes

  // Cleanup effect - clear audio state on unmount if not playing
  useEffect(() => {
    return () => {
      // If we're unmounting and audio is not actually playing, clear the state
      if (audioRef.current && audioRef.current.paused) {
        clearGlobalAudioState();
      }
    };
  }, []);

  // Rotating background effect - optimized for all devices
  useEffect(() => {
    if (albums.length > 0) {
      // Filter albums with good cover art for background rotation
      const albumsWithArt = albums.filter(album => 
        album.coverArt && 
        album.coverArt !== getPlaceholderImageUrl('large') &&
        !album.coverArt.includes('placeholder')
      );
      
      // Take first 8 albums with art for rotation (reduced for better performance)
      const rotationAlbums = albumsWithArt.slice(0, 8);
      setBackgroundAlbums(rotationAlbums);
      
      // Start rotation if we have albums with art and not on mobile
      if (rotationAlbums.length > 1 && typeof window !== 'undefined' && window.innerWidth > 768) {
        backgroundIntervalRef.current = setInterval(() => {
          setCurrentBackgroundIndex(prev => (prev + 1) % rotationAlbums.length);
        }, 10000); // Change every 10 seconds (increased for better performance)
      }
    }

    return () => {
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
      }
    };
  }, [albums]);

  const handleAddFeed = async (feedUrl: string) => {
    setIsAddingFeed(true);
    try {
      // Add to custom feeds
      const newCustomFeeds = [...customFeeds, feedUrl];
      setCustomFeeds(newCustomFeeds);
      
      // Reload with the new feed
      await loadAlbumsData(newCustomFeeds);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error adding RSS feed', err, { feedUrl });
      setError(`Failed to add RSS feed: ${errorMessage}`);
      toast.error(`Failed to add feed: ${errorMessage}`);
    } finally {
      setIsAddingFeed(false);
    }
  };

  const loadAlbumsData = async (additionalFeeds: string[] = []) => {
    // Combine default feeds with custom feeds - declare outside try block for error logging
    const allFeeds = [...feedUrls, ...additionalFeeds];
    
    try {
      console.log('🚀 loadAlbumsData called with additionalFeeds:', additionalFeeds);
      console.log('🚀 Current feedUrls:', feedUrls);
      console.log('🚀 isProduction value:', isProduction);
      setIsLoading(true);
      setError(null);
      
      // Remove test code and restore normal RSS feed loading
      console.log('🚀 Starting normal RSS feed loading...');
      
      console.log('Starting to load album data...');
      
      // Add debugging to see what's happening
      console.log('🔍 About to call RSSParser.parseMultipleFeeds with:', allFeeds.length, 'feeds');
      console.log('🔍 First few feed URLs:', allFeeds.slice(0, 3));
      console.log('Feed URLs:', allFeeds);
      console.log('Loading', allFeeds.length, 'feeds...');
      
      // Update progress as feeds load
      setLoadingProgress(0);
      
      // Progressive loading configuration
      const BATCH_SIZE = 20;
      const BATCH_DELAY = 100; // Small delay between batches to prevent overwhelming
      
      let albumsData: RSSAlbum[] = [];
      
      try {
        // Process feeds in batches for progressive loading
        console.log(`📊 Loading ${allFeeds.length} feeds in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < allFeeds.length; i += BATCH_SIZE) {
          const batch = allFeeds.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allFeeds.length / BATCH_SIZE);
          
          console.log(`🔄 Loading batch ${batchNumber}/${totalBatches} (${batch.length} feeds)`);
          
          try {
            // Parse batch with individual timeout
            const batchPromise = RSSParser.parseMultipleFeeds(batch);
            const batchTimeout = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Batch ${batchNumber} timeout`)), 15000);
            });
            
            const batchAlbums = await Promise.race([batchPromise, batchTimeout]) as RSSAlbum[];
            
            if (batchAlbums && batchAlbums.length > 0) {
              albumsData = [...albumsData, ...batchAlbums];
              setAlbums(albumsData);
              
              // Update progress
              const progress = Math.min(((i + BATCH_SIZE) / allFeeds.length) * 100, 100);
              setLoadingProgress(progress);
              
              console.log(`✅ Batch ${batchNumber} loaded: ${batchAlbums.length} albums (total: ${albumsData.length})`);
            }
            
            // Small delay between batches to prevent rate limiting
            if (i + BATCH_SIZE < allFeeds.length) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
          } catch (batchError) {
            console.warn(`⚠️ Batch ${batchNumber} failed:`, batchError);
            // Continue with next batch instead of failing completely
          }
        }
        
        console.log(`📦 Total albums loaded: ${albumsData.length}`);

        // Load configured publisher feeds in background (non-blocking)
        console.log(`🏢 Loading ${publisherFeeds.length} configured publisher feeds in background`);

        // Load publisher feeds asynchronously without blocking the UI
        if (publisherFeeds.length > 0) {
          
          const loadPublisherFeeds = async () => {
            const publisherAlbums: RSSAlbum[] = [];
            
            for (let i = 0; i < publisherFeeds.length; i++) {
              const publisherFeedUrl = publisherFeeds[i];
              console.log(`🏢 Loading publisher feed ${i + 1}/${publisherFeeds.length}: ${publisherFeedUrl}`);
              
              try {
                // Use the proper publisher feed parsing method
                const publisherBatchAlbums = await RSSParser.parsePublisherFeedAlbums(publisherFeedUrl);
                publisherAlbums.push(...publisherBatchAlbums);
                console.log(`✅ Publisher ${i + 1}/${publisherFeeds.length} loaded: ${publisherBatchAlbums.length} albums`);
              } catch (error) {
                console.warn(`⚠️ Publisher feed ${publisherFeedUrl} failed:`, error);
              }
              
              // Small delay between publisher feeds
              if (i + 1 < publisherFeeds.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY * 2));
              }
            }
            
            console.log(`🎶 Loaded ${publisherAlbums.length} albums from ${publisherFeeds.length} publisher feeds`);
            
            // Combine with existing albums
            const existingKeys = new Set(
              albumsData.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`)
            );
            
            const newAlbums = publisherAlbums.filter(album => {
              const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
              return !existingKeys.has(key);
            });
            
            if (newAlbums.length > 0) {
              setAlbums(prev => [...prev, ...newAlbums]);
              console.log(`✅ Added ${newAlbums.length} new albums from ${publisherFeeds.length} publisher feeds`);
            }
          };
          
          // Don't await this - let it run in background
          loadPublisherFeeds().catch(error => {
            console.warn('⚠️ Failed to load publisher feeds:', error);
          });
        }
        console.log(`📦 Total albums after initial load: ${albumsData.length}`);
      } catch (parseError) {
        console.error('❌ Album parsing failed:', parseError);
        console.error('❌ Failed feeds:', allFeeds);
        throw parseError;
      }
      
      console.log('Albums data received:', albumsData);
      
      if (albumsData && albumsData.length > 0) {
        console.log('✅ Setting albums:', albumsData.length, 'albums');
        setAlbums(albumsData);
        console.log('Successfully set', albumsData.length, 'albums');
        
        // Cache albums in localStorage for faster subsequent loads
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('cachedAlbums', JSON.stringify(albumsData));
            localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
            console.log('💾 Cached albums in localStorage');
          } catch (error) {
            console.warn('⚠️ Failed to cache albums:', error);
          }
        }
      } else {
        const errorMsg = 'Failed to load any album data from RSS feeds';
        logger.error(errorMsg, null, { feedCount: allFeeds.length });
        setError(errorMsg);
        toast.error('No albums could be loaded. Please try again later.');
      }
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error loading albums', err, { feedCount: allFeeds?.length });
      setError(`Error loading album data: ${errorMessage}`);
      toast.error(`Failed to load albums: ${errorMessage}`);
    } finally {
      console.log('🏁 loadAlbumsData finally block - setting isLoading to false');
      setIsLoading(false);
    }
  };

  const playAlbum = async (album: RSSAlbum, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the first playable track
    const firstTrack = album.tracks.find(track => track.url);
    
    if (!firstTrack || !firstTrack.url || !audioRef.current) {
      console.warn('Cannot play album: missing track or audio element');
      setError('No playable tracks found in this album');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (currentPlayingAlbum === album.title && isPlaying) {
      // Pause current album
      try {
        audioRef.current.pause();
        setIsPlaying(false);
        updateGlobalAudioState({ isPlaying: false }, audioRef.current || undefined);
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    } else {
      // Play this album from the beginning
      try {
        console.log('🎵 Attempting to play:', album.title, 'Track URL:', firstTrack.url);
        
        // Set up audio element first
        audioRef.current.src = firstTrack.url;
        audioRef.current.load(); // Force load on iOS
        
        // Set volume to a reasonable level for mobile
        audioRef.current.volume = 0.8;
        
        // iOS requires user gesture - ensure we're in a user-initiated event
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          await playPromise;
          
          // Success - update state
          setCurrentPlayingAlbum(album.title);
          setCurrentTrackIndex(0);
          setIsPlaying(true);
          
          // Update global state
          updateGlobalAudioState({
            isPlaying: true,
            currentAlbum: album.title,
            currentTrackIndex: 0,
            trackUrl: firstTrack.url,
          }, audioRef.current || undefined);
          
          console.log('✅ Successfully started playback');
        }
      } catch (error) {
        let errorMessage = 'Unable to play audio - please try again';
        let errorCode: ErrorCode = ErrorCodes.AUDIO_PLAYBACK_ERROR;
        
        if (error instanceof DOMException) {
          switch (error.name) {
            case 'NotAllowedError':
              errorMessage = 'Tap the play button again to start playback';
              errorCode = ErrorCodes.PERMISSION_ERROR;
              break;
            case 'NotSupportedError':
              errorMessage = 'Audio format not supported on this device';
              errorCode = ErrorCodes.AUDIO_NOT_FOUND;
              break;
          }
        }
        
        logger.error('Audio playback error', error, {
          album: album.title,
          trackUrl: firstTrack?.url,
          errorName: error instanceof DOMException ? error.name : 'Unknown'
        });
        
        const appError = new AppError(errorMessage, errorCode, 400, false);
        setError(appError.message);
        toast.error(appError.message);
        
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const playNextTrack = () => {
    if (!currentPlayingAlbum || !audioRef.current) return;
    
    // Find the current album
    const currentAlbum = albums.find(album => album.title === currentPlayingAlbum);
    if (!currentAlbum) return;
    
    // Check if there's a next track
    if (currentTrackIndex < currentAlbum.tracks.length - 1) {
      const nextTrack = currentAlbum.tracks[currentTrackIndex + 1];
      if (nextTrack && nextTrack.url) {
        audioRef.current.src = nextTrack.url;
        audioRef.current.play().then(() => {
          setCurrentTrackIndex(currentTrackIndex + 1);
          
          // Update global state
          updateGlobalAudioState({
            currentTrackIndex: currentTrackIndex + 1,
            trackUrl: nextTrack.url,
          }, audioRef.current || undefined);
        }).catch(err => {
          console.error('Error playing next track:', err);
        });
      }
    } else {
      // Album ended, reset
      setIsPlaying(false);
      setCurrentPlayingAlbum(null);
      setCurrentTrackIndex(0);
      clearGlobalAudioState();
    }
  };

  // Helper functions for filtering and sorting
  const getFilteredAlbums = () => {
    // Universal sorting function that implements hierarchical order: Albums → EPs → Singles
    const sortWithHierarchy = (albums: RSSAlbum[]) => {
      return albums.sort((a, b) => {
        // Special album prioritization (preserved from original)
        const aIsStayAwhile = a.title.toLowerCase().includes('stay awhile');
        const bIsStayAwhile = b.title.toLowerCase().includes('stay awhile');
        
        if (aIsStayAwhile && !bIsStayAwhile) return -1;
        if (!aIsStayAwhile && bIsStayAwhile) return 1;
        
        const aIsBloodshot = a.title.toLowerCase().includes('bloodshot lie');
        const bIsBloodshot = b.title.toLowerCase().includes('bloodshot lie');
        
        if (aIsBloodshot && !bIsBloodshot) return -1;
        if (!aIsBloodshot && bIsBloodshot) return 1;
        
        // Hierarchical sorting: Albums (7+ tracks) → EPs (2-6 tracks) → Singles (1 track)
        const aIsAlbum = a.tracks.length > 6;
        const bIsAlbum = b.tracks.length > 6;
        const aIsEP = a.tracks.length > 1 && a.tracks.length <= 6;
        const bIsEP = b.tracks.length > 1 && b.tracks.length <= 6;
        const aIsSingle = a.tracks.length === 1;
        const bIsSingle = b.tracks.length === 1;
        
        // Albums come first
        if (aIsAlbum && !bIsAlbum) return -1;
        if (!aIsAlbum && bIsAlbum) return 1;
        
        // EPs come second (if both are not albums)
        if (!aIsAlbum && !bIsAlbum) {
          if (aIsEP && bIsSingle) return -1;
          if (aIsSingle && bIsEP) return 1;
        }
        
        // Within same category, apply the selected sort
        switch (sortType) {
          case 'year':
            return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
          case 'tracks':
            return b.tracks.length - a.tracks.length;
          default: // name
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        }
      });
    };
    
    // Apply filtering based on active filter
    let filtered = albums;
    
    switch (activeFilter) {
      case 'albums':
        filtered = albums.filter(album => album.tracks.length > 6);
        break;
      case 'eps':
        filtered = albums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6);
        break;
      case 'singles':
        filtered = albums.filter(album => album.tracks.length === 1);
        break;
      default: // 'all'
        filtered = albums; // Show all albums
    }

    // Apply hierarchical sorting to filtered results
    return sortWithHierarchy(filtered);
  };

  const filteredAlbums = getFilteredAlbums();

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Rotating Background - Desktop Only */}
      {backgroundAlbums.length > 0 && typeof window !== 'undefined' && window.innerWidth > 768 && (
        <div className="fixed inset-0 z-0">
          {backgroundAlbums.map((album, index) => (
            <div
              key={`${album.title}-${index}`}
              className={`absolute inset-0 transition-opacity duration-3000 ease-in-out ${
                index === currentBackgroundIndex ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${album.coverArt}') center/cover fixed`,
              }}
            />
          ))}
        </div>
      )}

      {/* Fallback gradient background */}
      {(!backgroundAlbums.length || (typeof window !== 'undefined' && window.innerWidth <= 768)) && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 z-0" />
      )}

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Hidden audio element for main page playback */}
        <audio
          ref={audioRef}
          onPlay={() => {
            setIsPlaying(true);
            updateGlobalAudioState({ isPlaying: true }, audioRef.current || undefined);
          }}
          onPause={() => {
            setIsPlaying(false);
            updateGlobalAudioState({ isPlaying: false }, audioRef.current || undefined);
          }}
          onEnded={playNextTrack}
          onError={(e) => {
            console.error('Audio error:', e);
            setError('Audio playback error - please try again');
            setTimeout(() => setError(null), 3000);
          }}
          preload="metadata"
          crossOrigin="anonymous"
          playsInline
          webkit-playsinline="true"
          controls={false}
          style={{ display: 'none' }}
        />
        
        {/* Header */}
        <header 
          className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-12"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4 mb-8">
              {/* Menu Button - Left */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Logo and Title - Centered */}
              <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
                <Image 
                  src="/logo.webp" 
                  alt="VALUE Logo" 
                  width={40} 
                  height={40}
                  className="object-cover"
                  priority
                />
              </div>
              <h1 className="text-4xl font-bold">Into the ValueVerse</h1>
            </div>
            
            {/* Description */}
            <p className="text-gray-400 text-lg mb-4 mt-6">
              This is a demo app I built for the "StableKraft" project to see what we could do with RSS feeds and music. All data here comes from RSS feeds on{' '}
              <a href="https://podcastindex.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                podcastindex.org
              </a>. This is also a demo of a site for The Doerfels that I added other music I like also and some stuff to help test. -ChadF
            </p>
            
            {/* Loading/Error Status */}
            {isClient && (
              <div className="flex items-center gap-2 text-sm">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    <span className="text-yellow-400">
                      Loading {albums.length > 0 ? `${albums.length} albums` : `${feedUrls.length + customFeeds.length} RSS feeds`}...
                      {loadingProgress > 0 && ` (${Math.round(loadingProgress)}%)`}
                    </span>
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span className="text-red-400">{error}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </header>
        
        {/* Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm transform transition-transform duration-300 z-30 border-r border-gray-700 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 pt-20">
            <h2 className="text-xl font-bold mb-6">Menu</h2>
            
            {/* Add RSS Feed Component */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Add RSS Feed</h3>
              <AddRSSFeed onAddFeed={handleAddFeed} isLoading={isAddingFeed} />
            </div>
            
            {/* Custom Feeds Display */}
            {customFeeds.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3 text-white">Custom RSS Feeds ({customFeeds.length})</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customFeeds.map((feed, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded p-2">
                      <span className="text-sm text-gray-300 truncate flex-1">{feed}</span>
                      <button
                        onClick={() => {
                          const newCustomFeeds = customFeeds.filter((_, i) => i !== index);
                          setCustomFeeds(newCustomFeeds);
                          loadAlbumsData(newCustomFeeds);
                        }}
                        className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Remove feed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Artists with Publisher Feeds */}
            {(() => {
              // Extract unique artists with publisher feeds, excluding Doerfels artists
              const artistsWithPublishers = albums
                .filter(album => album.publisher && album.publisher.feedGuid)
                .filter(album => {
                  // Exclude Doerfels family artists
                  const artistName = album.artist.toLowerCase();
                  return !artistName.includes('doerfel') && 
                         !artistName.includes('ben doerfel') && 
                         !artistName.includes('sirtj') &&
                         !artistName.includes('shredward') &&
                         !artistName.includes('tj doerfel');
                })
                .reduce((acc, album) => {
                  const key = album.publisher!.feedGuid;
                  if (!acc.has(key)) {
                    acc.set(key, {
                      name: album.artist,
                      feedGuid: album.publisher!.feedGuid,
                      albumCount: 1
                    });
                  } else {
                    acc.get(key)!.albumCount++;
                  }
                  return acc;
                }, new Map<string, { name: string; feedGuid: string; albumCount: number }>());

              const artists = Array.from(artistsWithPublishers.values()).sort((a, b) => 
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
              );

              return artists.length > 0 ? (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                    <span>Artists</span>
                    <span className="text-xs bg-blue-600/80 px-2 py-1 rounded">PC 2.0</span>
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {artists.map((artist) => (
                      <Link
                        key={artist.feedGuid}
                        href={`/publisher/${generatePublisherSlug({ title: artist.name, feedGuid: artist.feedGuid })}`}
                        className="flex items-center justify-between bg-gray-800/30 hover:bg-gray-800/50 rounded p-2 transition-colors group"
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1">
                          {artist.name}
                        </span>
                        <span className="text-xs text-gray-500 group-hover:text-gray-400 ml-2">
                          {artist.albumCount} releases
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            
            {/* Feed Stats */}
            <div className="text-sm text-gray-400 space-y-1">
              <p>Default feeds: {feedUrls.length}</p>
              <p>Custom feeds: {customFeeds.length}</p>
              <p>Total releases: {albums.length}</p>
            </div>
            
            {/* Version Display */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Version</span>
                <span className="text-xs text-gray-400 font-mono">{getVersionString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Overlay to close sidebar when clicking outside */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <div className="container mx-auto px-6 py-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner />
              {loadingProgress > 0 && (
                <div className="w-full max-w-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Loading feeds...</span>
                    <span className="text-sm text-gray-400">{Math.round(loadingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  {albums.length > 0 && (
                    <p className="text-center text-sm text-gray-400 mt-2">
                      {albums.length} albums loaded so far...
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Albums</h2>
              <p className="text-gray-400">{error}</p>
              <button 
                onClick={() => loadAlbumsData(customFeeds)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : albums.length > 0 ? (
            <div className="max-w-7xl mx-auto">
              {/* Controls Bar */}
              <ControlsBar
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                sortType={sortType}
                onSortChange={setSortType}
                viewType={viewType}
                onViewChange={setViewType}
                resultCount={filteredAlbums.length}
                resultLabel={activeFilter === 'all' ? 'Releases' : 
                  activeFilter === 'albums' ? 'Albums' :
                  activeFilter === 'eps' ? 'EPs' : 'Singles'}
                className="mb-8"
              />

              {/* Albums Display */}
              {activeFilter === 'all' ? (
                // Original sectioned layout for "All" filter
                <>
                  {/* Albums Grid */}
                  {(() => {
                    const albumsWithMultipleTracks = filteredAlbums.filter(album => album.tracks.length > 6);
                    return albumsWithMultipleTracks.length > 0 && (
                      <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6">Albums</h2>
                        {viewType === 'grid' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {albumsWithMultipleTracks.map((album, index) => (
                              <AlbumCard
                                key={`album-${index}`}
                                album={album}
                                index={index}
                                currentPlayingAlbum={currentPlayingAlbum}
                                isPlaying={isPlaying}
                                onPlay={playAlbum}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {albumsWithMultipleTracks.map((album, index) => (
                              <Link
                                key={`album-${index}`}
                                href={generateAlbumUrl(album.title)}
                                className="group flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20"
                              >
                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <Image 
                                    src={getAlbumArtworkUrl(album.coverArt || '', 'thumbnail')} 
                                    alt={album.title}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = getPlaceholderImageUrl('thumbnail');
                                    }}
                                  />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">
                                    {album.title}
                                  </h3>
                                  <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>{new Date(album.releaseDate).getFullYear()}</span>
                                  <span>{album.tracks.length} tracks</span>
                                  <span className="px-2 py-1 bg-white/10 rounded text-xs">Album</span>
                                  {album.explicit && (
                                    <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                                      E
                                    </span>
                                  )}
                                </div>
                                
                                <button
                                  onClick={(e) => playAlbum(album, e)}
                                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                                >
                                  {currentPlayingAlbum === album.title && isPlaying ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  )}
                                </button>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* EPs and Singles Grid */}
                  {(() => {
                    const epsAndSingles = filteredAlbums.filter(album => album.tracks.length <= 6);
                    return epsAndSingles.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold mb-6">EPs and Singles</h2>
                        {viewType === 'grid' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {epsAndSingles.map((album, index) => (
                              <AlbumCard
                                key={`ep-single-${index}`}
                                album={album}
                                index={index}
                                currentPlayingAlbum={currentPlayingAlbum}
                                isPlaying={isPlaying}
                                onPlay={playAlbum}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {epsAndSingles.map((album, index) => (
                              <Link
                                key={`ep-single-${index}`}
                                href={generateAlbumUrl(album.title)}
                                className="group flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20"
                              >
                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <Image 
                                    src={getAlbumArtworkUrl(album.coverArt || '', 'thumbnail')} 
                                    alt={album.title}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = getPlaceholderImageUrl('thumbnail');
                                    }}
                                  />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">
                                    {album.title}
                                  </h3>
                                  <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>{new Date(album.releaseDate).getFullYear()}</span>
                                  <span>{album.tracks.length} tracks</span>
                                  <span className="px-2 py-1 bg-white/10 rounded text-xs">
                                    {album.tracks.length === 1 ? 'Single' : 'EP'}
                                  </span>
                                  {album.explicit && (
                                    <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                                      E
                                    </span>
                                  )}
                                </div>
                                
                                <button
                                  onClick={(e) => playAlbum(album, e)}
                                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                                >
                                  {currentPlayingAlbum === album.title && isPlaying ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  )}
                                </button>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                // Unified layout for specific filters (Albums, EPs, Singles)
                viewType === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAlbums.map((album, index) => (
                      <AlbumCard
                        key={`${album.title}-${index}`}
                        album={album}
                        index={index}
                        currentPlayingAlbum={currentPlayingAlbum}
                        isPlaying={isPlaying}
                        onPlay={playAlbum}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAlbums.map((album, index) => (
                      <Link
                        key={`${album.title}-${index}`}
                        href={generateAlbumUrl(album.title)}
                        className="group flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <Image 
                            src={getAlbumArtworkUrl(album.coverArt || '', 'thumbnail')} 
                            alt={album.title}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getPlaceholderImageUrl('thumbnail');
                            }}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">
                            {album.title}
                          </h3>
                          <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>{new Date(album.releaseDate).getFullYear()}</span>
                          <span>{album.tracks.length} tracks</span>
                          <span className="px-2 py-1 bg-white/10 rounded text-xs">
                            {album.tracks.length <= 6 ? (album.tracks.length === 1 ? 'Single' : 'EP') : 'Album'}
                          </span>
                          {album.explicit && (
                            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                              E
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => playAlbum(album, e)}
                          className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                        >
                          {currentPlayingAlbum === album.title && isPlaying ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </button>
                      </Link>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
              <p className="text-gray-400">Unable to load any album information from the RSS feeds.</p>
            </div>
          )}
        </div>

        {/* Now Playing Bar - Fixed at bottom */}
        {currentPlayingAlbum && (
          <div className="fixed bottom-0 left-0 right-0 backdrop-blur-md bg-gradient-to-t from-black/60 via-black/40 to-transparent border-t border-white/10 p-4 z-50 shadow-2xl">
            <div className="container mx-auto flex items-center gap-4 bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              {/* Current Album Info - Clickable */}
              {(() => {
                const currentAlbum = albums.find(album => album.title === currentPlayingAlbum);
                const currentTrack = currentAlbum?.tracks[currentTrackIndex];
                return currentAlbum ? (
                  <Link
                    href={generateAlbumUrl(currentAlbum.title)}
                    className="flex items-center gap-3 min-w-0 flex-1 hover:bg-white/10 rounded-lg p-2 -m-2 transition-colors cursor-pointer"
                  >
                    <Image 
                      src={getAlbumArtworkUrl(currentAlbum.coverArt || '', 'thumbnail')} 
                      alt={currentPlayingAlbum}
                      width={48}
                      height={48}
                      className="rounded object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = getPlaceholderImageUrl('thumbnail');
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {currentTrack?.title || 'Unknown Track'}
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        {currentAlbum.artist || 'Unknown Artist'} • {currentPlayingAlbum}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0">
                      <p className="font-medium truncate">Unknown Track</p>
                      <p className="text-sm text-gray-400 truncate">Unknown Artist</p>
                    </div>
                  </div>
                );
              })()}
              
              {/* Playback Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlaying) {
                        audioRef.current.pause();
                      } else {
                        audioRef.current.play();
                      }
                    }
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    if (currentTrackIndex > 0) {
                      const currentAlbum = albums.find(album => album.title === currentPlayingAlbum);
                      if (currentAlbum && audioRef.current) {
                        const prevTrack = currentAlbum.tracks[currentTrackIndex - 1];
                        if (prevTrack && prevTrack.url) {
                          audioRef.current.src = prevTrack.url;
                          audioRef.current.play().then(() => {
                            setCurrentTrackIndex(currentTrackIndex - 1);
                          });
                        }
                      }
                    }
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                  disabled={currentTrackIndex === 0}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
                
                <button
                  onClick={playNextTrack}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                  }
                  setIsPlaying(false);
                  setCurrentPlayingAlbum(null);
                  setCurrentTrackIndex(0);
                  clearGlobalAudioState();
                }}
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}