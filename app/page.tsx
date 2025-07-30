'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generatePublisherSlug } from '@/lib/url-utils';
import { getVersionString } from '@/lib/version';
import { useAudio } from '@/contexts/AudioContext';
import { AppError, ErrorCodes, ErrorCode, getErrorMessage, createErrorLogger } from '@/lib/error-utils';
import { toast } from '@/components/Toast';
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const AlbumCard = dynamic(() => import('@/components/AlbumCardLazy'), {
  loading: () => (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 animate-pulse">
      <div className="aspect-square bg-gray-800/50 rounded-lg mb-3"></div>
      <div className="h-4 bg-gray-700/50 rounded mb-2"></div>
      <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
    </div>
  ),
  ssr: true
});

const CDNImage = dynamic(() => import('@/components/CDNImageLazy'), {
  loading: () => (
    <div className="animate-pulse bg-gray-800/50 rounded flex items-center justify-center">
      <div className="w-6 h-6 bg-white/20 rounded-full animate-spin"></div>
    </div>
  ),
  ssr: false
});

const ControlsBar = dynamic(() => import('@/components/ControlsBarLazy'), {
  loading: () => (
    <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 bg-gray-700/50 rounded w-24"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
        <div className="h-8 bg-gray-700/50 rounded w-16"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
      </div>
    </div>
  ),
  ssr: true
});

// Import types from the original component
import type { FilterType, ViewType, SortType } from '@/components/ControlsBar';
// RSS feed configuration - CDN removed, using original URLs directly

// Temporarily disable error logger to prevent recursion
// const logger = createErrorLogger('MainPage');

// Development logging utility - disabled for performance
const isDev = process.env.NODE_ENV === 'development';
const isVerbose = process.env.NEXT_PUBLIC_LOG_LEVEL === 'verbose';

const devLog = (...args: any[]) => {
  // Disabled for performance
};

const verboseLog = (...args: any[]) => {
  // Disabled for performance
};

// RSS feed URLs - hardcoded for client-side compatibility
// All CDN URLs removed, using original URLs directly

// Feed URLs are now loaded dynamically from /api/feeds endpoint
// This ensures feeds are always up-to-date with data/feeds.json

// Debug logging - Performance optimization info
devLog('🚀 PERFORMANCE OPTIMIZATION ENABLED - Dynamic feed loading');
devLog('🔧 Environment check:', { NODE_ENV: process.env.NODE_ENV });
devLog('🚀 Feeds will be loaded dynamically from /api/feeds endpoint');

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalFeedsCount, setTotalFeedsCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Progressive loading states
  const [criticalAlbums, setCriticalAlbums] = useState<RSSAlbum[]>([]);
  const [enhancedAlbums, setEnhancedAlbums] = useState<RSSAlbum[]>([]);
  const [isCriticalLoaded, setIsCriticalLoaded] = useState(false);
  const [isEnhancedLoaded, setIsEnhancedLoaded] = useState(false);
  
  // Global audio context
  const { playAlbum: globalPlayAlbum, shuffleAllTracks } = useAudio();
  const hasLoadedRef = useRef(false);
  
  // Static background state - Bloodshot Lies album art
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);

  // Controls state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [sortType, setSortType] = useState<SortType>('name');
  
  // Shuffle functionality is now handled by the global AudioContext
  const handleShuffle = async () => {
    try {
      console.log('🎲 Shuffle button clicked - starting shuffle all tracks');
      const success = await shuffleAllTracks();
      if (success) {
        toast.success('🎲 Shuffle started!');
      } else {
        toast.error('Failed to start shuffle');
      }
    } catch (error) {
      console.error('Error starting shuffle:', error);
      toast.error('Error starting shuffle');
    }
  };

  useEffect(() => {
    setIsClient(true);
    
    // Add scroll detection for mobile
    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      document.body.classList.add('is-scrolling');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 150);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      clearTimeout(scrollTimer);
    };
  }, []);

  // Audio playback is now handled by the global AudioContext
  
  useEffect(() => {
    // Prevent multiple loads
    if (hasLoadedRef.current) {
      return;
    }
    
    hasLoadedRef.current = true;
    
    // Clear cache to force fresh data load
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cachedAlbums');
      localStorage.removeItem('albumsCacheTimestamp');
    }
    
    // Progressive loading: Load critical data first, then enhance
    loadCriticalAlbums();
  }, []); // Run only once on mount


  // Static background loading - Bloodshot Lies album art
  // CDNImage component handles loading internally, so we just need to track the state
  useEffect(() => {
    // Set a small delay to ensure the CDNImage component has time to load
    const timer = setTimeout(() => {
      setBackgroundImageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Remove isClient dependency to prevent potential loops



  // Progressive loading: Load critical albums first (core feeds only)
  const loadCriticalAlbums = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Load critical albums first (core feeds)
      const criticalAlbums = await loadAlbumsData('core');
      setCriticalAlbums(criticalAlbums);
      setIsCriticalLoaded(true);
      setLoadingProgress(30);
      
      // Start loading enhanced data in background
      loadEnhancedAlbums();
      
    } catch (error) {
      setError('Failed to load critical albums');
      setIsLoading(false);
    }
  };

  // Progressive loading: Load enhanced albums (all feeds)
  const loadEnhancedAlbums = async () => {
    try {
      // Load all albums in background
      const allAlbums = await loadAlbumsData('all');
      setEnhancedAlbums(allAlbums);
      setIsEnhancedLoaded(true);
      setLoadingProgress(100);
      setIsLoading(false);
      
    } catch (error) {
      console.warn('Failed to load enhanced albums, using critical albums only');
      setIsLoading(false);
    }
  };

  const loadAlbumsData = async (loadTier: 'core' | 'extended' | 'lowPriority' | 'all' = 'all') => {
    try {
      // Fetch pre-parsed album data from the new API endpoint
      const response = await fetch('/api/albums');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const albums = data.albums || [];
      
      // Filter albums based on load tier if needed
      let filteredAlbums = albums;
      
      if (loadTier !== 'all') {
        // Get feeds configuration to filter by priority
        let feedsConfig: any = { core: [], extended: [], low: [], publisher: [], all: [] };
        try {
          const feedsResponse = await fetch('/api/feeds');
          if (feedsResponse.ok) {
            feedsConfig = await feedsResponse.json();
          }
        } catch (error) {
          console.warn('Failed to load feeds configuration:', error);
        }
        
        // Get feed IDs for the specified tier
        const tierFeedIds = new Set(
          feedsConfig[loadTier]?.map((feed: any) => feed.id) || []
        );
        
        // Filter albums to only include those from the specified tier
        filteredAlbums = albums.filter((album: any) => 
          tierFeedIds.has(album.feedId)
        );
      }
      
      setLoadingProgress(75);
      
      // Convert to RSSAlbum format for compatibility
      const rssAlbums: RSSAlbum[] = filteredAlbums.map((album: any) => ({
        title: album.title,
        artist: album.artist,
        description: album.description,
        coverArt: album.coverArt,
        tracks: album.tracks.map((track: any) => ({
          title: track.title,
          duration: track.duration,
          url: track.url,
          trackNumber: track.trackNumber,
          subtitle: track.subtitle,
          summary: track.summary,
          image: track.image,
          explicit: track.explicit,
          keywords: track.keywords
        })),
        publisher: album.publisher, // Preserve publisher information
        podroll: album.podroll,
        funding: album.funding,
        feedId: album.feedId,
        feedUrl: album.feedUrl,
        lastUpdated: album.lastUpdated
      }));
      
      // Deduplicate albums
      const albumMap = new Map<string, RSSAlbum>();
      
      rssAlbums.forEach((album) => {
        const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
        if (!albumMap.has(key)) {
          albumMap.set(key, album);
        }
      });
      
      const uniqueAlbums = Array.from(albumMap.values());
      
      // Cache the results
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cachedAlbums', JSON.stringify(uniqueAlbums));
          localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
        } catch (error) {
          console.warn('⚠️ Failed to cache albums:', error);
        }
      }
      
      return uniqueAlbums;
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      // Temporarily disable error logging to prevent recursion
      // logger.error('Error loading albums', err);
      setError(`Error loading album data: ${errorMessage}`);
      toast.error(`Failed to load albums: ${errorMessage}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const playAlbum = async (album: RSSAlbum, e: React.MouseEvent | React.TouchEvent) => {
    // Only prevent default/propagation for the play button, not the entire card
    e.stopPropagation();
    
    // Find the first playable track
    const firstTrack = album.tracks.find(track => track.url);
    
    if (!firstTrack || !firstTrack.url) {
      console.warn('Cannot play album: missing track');
      setError('No playable tracks found in this album');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      console.log('🎵 Attempting to play:', album.title, 'Track URL:', firstTrack.url);
      
      // Use global audio context to play album
      const success = await globalPlayAlbum(album, 0);
      if (success) {
        console.log('✅ Successfully started playback');
      } else {
        throw new Error('Failed to start album playback');
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
      
      // Temporarily disable error logging to prevent recursion
      // logger.error('Audio playback error', error, {
      //   album: album.title,
      //   trackUrl: firstTrack?.url,
      //   errorName: error instanceof DOMException ? error.name : 'Unknown'
      // });
      
      const appError = new AppError(errorMessage, errorCode, 400, false);
      setError(appError.message);
      toast.error(appError.message);
      
      setTimeout(() => setError(null), 5000);
    }
  };

  // Audio playback functions are now handled by the global AudioContext

  // Shuffle functionality is now handled by the global AudioContext

  // Helper functions for filtering and sorting
  const getFilteredAlbums = () => {
    // Use progressive loading: show critical albums first, then enhanced
    const albumsToUse = isEnhancedLoaded ? enhancedAlbums : criticalAlbums;
    
    // Universal sorting function that implements hierarchical order: Albums → EPs → Singles
    const sortWithHierarchy = (albums: RSSAlbum[]) => {
      return albums.sort((a, b) => {
        // Pin "Stay Awhile" first - with proper type checking
        const aTitle = a.title && typeof a.title === 'string' ? a.title : '';
        const bTitle = b.title && typeof b.title === 'string' ? b.title : '';
        
        const aIsStayAwhile = aTitle.toLowerCase().includes('stay awhile');
        const bIsStayAwhile = bTitle.toLowerCase().includes('stay awhile');
        
        if (aIsStayAwhile && !bIsStayAwhile) return -1;
        if (!aIsStayAwhile && bIsStayAwhile) return 1;
        
        // Pin "Bloodshot Lies" second - with proper type checking
        const aIsBloodshot = aTitle.toLowerCase().includes('bloodshot lie');
        const bIsBloodshot = bTitle.toLowerCase().includes('bloodshot lie');
        
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
        if (aIsEP && !bIsEP) return -1;
        if (!aIsEP && bIsEP) return 1;
        
        // Singles come last (if both are not albums or EPs)
        if (aIsSingle && !bIsSingle) return -1;
        if (!aIsSingle && bIsSingle) return 1;
        
        // If same type, sort by title
        return aTitle.localeCompare(bTitle);
      });
    };
    
    // Apply filtering based on active filter
    let filtered = albumsToUse;
    
    // Filter out explicit content by default
    const baseAlbums = albumsToUse.filter(album => !album.explicit);
    
    switch (activeFilter) {
      case 'albums':
        filtered = baseAlbums.filter(album => album.tracks.length > 6);
        break;
      case 'eps':
        filtered = baseAlbums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6);
        break;
      case 'singles':
        filtered = baseAlbums.filter(album => album.tracks.length === 1);
        break;
      default: // 'all'
        filtered = baseAlbums; // Show all non-explicit albums
    }

    // Apply hierarchical sorting to filtered results
    return sortWithHierarchy(filtered);
  };

  const filteredAlbums = getFilteredAlbums();
  
  // Show loading state for progressive loading
  const showProgressiveLoading = isCriticalLoaded && !isEnhancedLoaded && filteredAlbums.length > 0;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Static Background - Bloodshot Lies Album Art */}
      <div className="fixed inset-0 z-0">
        <CDNImage
          src="https://www.doerfelverse.com/art/bloodshot-lies-the-album.png?v=1"
          alt="Bloodshot Lies Album Art"
          width={1920}
          height={1080}
          className="object-cover w-full h-full"
          priority
          onLoad={() => setBackgroundImageLoaded(true)}
          onError={() => setBackgroundImageLoaded(true)} // Mark as loaded even on error to show fallback
        />
        {/* Gradient overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/90"></div>
      </div>
      
      {/* Fallback gradient background - show when not loaded or on error */}
      {!backgroundImageLoaded && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 z-0" />
      )}

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Audio element is now handled by the global AudioContext */}
        
        {/* Header */}
        <header 
          className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-6"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="container mx-auto px-6 py-2">
            {/* Mobile Header - Stacked Layout */}
            <div className="block sm:hidden mb-3">
              {/* Top row - Menu, Logo, About */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  {/* Menu Button */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    aria-label="Toggle menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  
                  {/* Logo */}
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
                </div>
                
                {/* About Link */}
                <Link 
                  href="/about" 
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span className="text-sm">About</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
              </div>
              
              {/* Bottom row - Title and Beta badge */}
              <div className="text-center">
                <h1 className="text-xl font-bold mb-1">Project StableKraft</h1>
                <p className="text-xs text-gray-400 mb-2">- &quot;its was all this reimagined, its a different kind of speech, it was repition, it was what you wanted it to be&quot; - The Contortionist - Reimagined</p>
                                                  <div className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full border border-yellow-500/30">
                  Beta - if the page isn&apos;t loading try a hard refresh and wait a little for it to load
                </div>
              </div>
            </div>

            {/* Desktop Header - Original Layout */}
            <div className="hidden sm:block mb-4">
              <div className="relative flex items-center justify-center">
                {/* Left side - Menu Button and Logo */}
                <div className="absolute left-0 flex items-center gap-4">
                  {/* Menu Button */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    aria-label="Toggle menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  
                  {/* Logo */}
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
                </div>
                
                {/* Center - Title */}
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-1">Project StableKraft</h1>
                  <p className="text-sm text-gray-400 mb-2">- &quot;its was all this reimagined, its a different kind of speech, it was repition, it was what you wanted it to be&quot; - The Contortionist - Reimagined</p>
                  <div className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full border border-yellow-500/30 inline-block">
                    Beta - if the page isn&apos;t loading try a hard refresh and wait a little for it to load
                  </div>
                </div>
                
                {/* Right side - About Link */}
                <div className="absolute right-0">
                  <Link 
                    href="/about" 
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">About this site</span>
                </Link>
              </div>
            </div>
            
            {/* Loading/Error Status */}
            {isClient && (
              <div className="flex items-center gap-2 text-sm">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    <span className="text-yellow-400">
                      {isCriticalLoaded ? 'Loading more albums...' : 'Loading albums...'}
                      {loadingProgress > 0 && ` (${Math.round(loadingProgress)}%)`}
                    </span>
                  </div>
                ) : showProgressiveLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    <span className="text-blue-400">
                      Loading more albums... ({filteredAlbums.length} loaded)
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
          </div>
        </header>
        
        {/* Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm transform transition-transform duration-300 z-30 border-r border-gray-700 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4 pt-16 flex flex-col h-full">
            <h2 className="text-lg font-bold mb-4">Menu</h2>
            
            {/* Navigation Links */}
            <div className="mb-4 space-y-1">
              <Link 
                href="/about" 
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">About & Support</span>
              </Link>
            </div>
            


            {/* Artists with Publisher Feeds */}
            {(() => {
              // Extract unique artists with publisher feeds, excluding Doerfels artists
              const albumsToUse = isEnhancedLoaded ? enhancedAlbums : criticalAlbums;
              const artistsWithPublishers = albumsToUse
                .filter(album => album.publisher && album.publisher.feedGuid)
                .filter(album => {
                  // Exclude Doerfels family artists
                  const artistName = album.artist && typeof album.artist === 'string' ? album.artist.toLowerCase() : '';
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

              // Always show the section, even if empty, to indicate it exists
              return (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2 text-white">
                    Publisher Feeds
                    {showProgressiveLoading && (
                      <span className="ml-2 text-xs text-blue-400">(Loading more...)</span>
                    )}
                  </h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {artists.length > 0 ? (
                      artists.map((artist) => (
                        <Link
                          key={artist.feedGuid}
                          href={`/publisher/${generatePublisherSlug({ title: artist.name, feedGuid: artist.feedGuid })}`}
                          className="flex items-center justify-between bg-gray-800/30 hover:bg-gray-800/50 rounded p-1.5 transition-colors group"
                          onClick={() => setIsSidebarOpen(false)}
                        >
                          <span className="text-xs text-gray-300 group-hover:text-white truncate flex-1">
                            {artist.name}
                          </span>
                          <span className="text-xs text-gray-500 group-hover:text-gray-400 ml-1">
                            {artist.albumCount}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        {isLoading ? 'Loading publisher feeds...' : 'No publisher feeds available'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            

            
            
            {/* Version Display - Moved to top for better visibility */}
            <div className="mt-auto pt-2 border-t border-gray-700">
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
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28">
          {isLoading && !isCriticalLoaded ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner 
                size="large"
                text="Loading music feeds..."
                showProgress={false}
              />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Albums</h2>
              <p className="text-gray-400">{error}</p>
              <button 
                onClick={() => loadCriticalAlbums()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : filteredAlbums.length > 0 ? (
            <div className="max-w-7xl mx-auto">
              {/* Controls Bar */}
              <ControlsBar
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                sortType={sortType}
                onSortChange={setSortType}
                viewType={viewType}
                onViewChange={setViewType}
                showShuffle={true}
                onShuffle={handleShuffle}
                resultCount={filteredAlbums.length}
                resultLabel={activeFilter === 'all' ? 'Releases' : 
                  activeFilter === 'albums' ? 'Albums' :
                  activeFilter === 'eps' ? 'EPs' : 
                  activeFilter === 'singles' ? 'Singles' : 'Releases'}
                className="mb-8"
              />

              {/* Shuffle functionality is now handled by the global AudioContext */}

              {/* Progressive Loading Indicator */}
              {showProgressiveLoading && (
                <div className="mb-6 p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-300 text-sm">
                      Loading more albums in the background... ({filteredAlbums.length} loaded so far)
                    </span>
                  </div>
                </div>
              )}

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
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            {albumsWithMultipleTracks.map((album, index) => (
                              <AlbumCard
                                key={`album-${index}`}
                                album={album}
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
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            {epsAndSingles.map((album, index) => (
                              <AlbumCard
                                key={`ep-single-${index}`}
                                album={album}
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
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {filteredAlbums.map((album, index) => (
                      <AlbumCard
                        key={`${album.title}-${index}`}
                        album={album}

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
                        
                        {/* Play button removed - now handled by global audio context */}
                      </Link>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
              <p className="text-gray-400">
                {isCriticalLoaded ? 'Unable to load additional album information.' : 'Unable to load any album information from the RSS feeds.'}
              </p>
              {isCriticalLoaded && (
                <button 
                  onClick={() => loadEnhancedAlbums()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load More Albums
                </button>
              )}
            </div>
          )}
        </div>

        {/* Now Playing Bar is now handled by the global AudioContext */}
      </div>
    </div>
  );
}