'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddRSSFeed from '@/components/AddRSSFeed';
import AlbumCard from '@/components/AlbumCard';
import CDNImage from '@/components/CDNImage';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generatePublisherSlug } from '@/lib/url-utils';
import { getVersionString } from '@/lib/version';
import ControlsBar, { FilterType, ViewType, SortType } from '@/components/ControlsBar';
import { useAudio } from '@/contexts/AudioContext';
import { AppError, ErrorCodes, ErrorCode, getErrorMessage, createErrorLogger } from '@/lib/error-utils';
import { toast } from '@/components/Toast';
// RSS feed configuration - CDN removed, using original URLs directly

const logger = createErrorLogger('MainPage');

// Development logging utility
const isDev = process.env.NODE_ENV === 'development';
const isVerbose = process.env.NEXT_PUBLIC_LOG_LEVEL === 'verbose';

const devLog = (...args: any[]) => {
  if (isDev) console.log(...args);
};

const verboseLog = (...args: any[]) => {
  if (isVerbose) console.log(...args);
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
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [customFeeds, setCustomFeeds] = useState<string[]>([]);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [totalFeedsCount, setTotalFeedsCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
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
  }, []);

  // Audio playback is now handled by the global AudioContext
  
  useEffect(() => {
    verboseLog('🔄 useEffect triggered - starting to load albums');
    verboseLog('🔄 hasLoadedRef.current:', hasLoadedRef.current);
    verboseLog('🔄 isClient:', isClient);
    
    // Prevent multiple loads
    if (hasLoadedRef.current) {
      verboseLog('🔄 Already loaded, skipping...');
      return;
    }
    
    hasLoadedRef.current = true;
    verboseLog('🔄 Attempting to load albums...');
    
    // Clear cache to force fresh data load with updated CDN URLs
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cachedAlbums');
      localStorage.removeItem('albumsCacheTimestamp');
      devLog('🧹 Cache cleared to force fresh data load');
    }
    
    // Load all feeds at once for smooth experience
    devLog('🔄 Loading all feeds for smooth experience');
    loadAlbumsData([], 'all');
  }, []); // Run only once on mount


  // Static background loading - Bloodshot Lies album art
  // CDNImage component handles loading internally, so we just need to track the state
  useEffect(() => {
    // Set a small delay to ensure the CDNImage component has time to load
    const timer = setTimeout(() => {
      setBackgroundImageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isClient]);

  const handleAddFeed = async (feedUrl: string) => {
    setIsAddingFeed(true);
    try {
      // First, save the feed permanently via API
      const response = await fetch('/api/admin/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: feedUrl,
          type: 'album'
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save feed');
      }

      // Show success message
      toast.success('RSS feed added successfully!');
      
      // Add to custom feeds for immediate loading
      const newCustomFeeds = [...customFeeds, feedUrl];
      setCustomFeeds(newCustomFeeds);
      
      // Reload with the new feed
      await loadAlbumsData(newCustomFeeds);
      
      console.log('✅ RSS feed added and loaded:', feedUrl);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error adding RSS feed', err, { feedUrl });
      setError(`Failed to add RSS feed: ${errorMessage}`);
      toast.error(`Failed to add feed: ${errorMessage}`);
    } finally {
      setIsAddingFeed(false);
    }
  };

  const loadAlbumsData = async (additionalFeeds: string[] = [], loadTier: 'core' | 'extended' | 'lowPriority' | 'all' = 'all') => {
    verboseLog('🔄 loadAlbumsData called with loadTier:', loadTier);
    
    try {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      verboseLog('🚀 Loading pre-parsed album data from API...');
      
      // Fetch pre-parsed album data from the new API endpoint
      const response = await fetch('/api/albums');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const albums = data.albums || [];
      
      verboseLog(`✅ Loaded ${albums.length} pre-parsed albums from API`);
      setLoadingProgress(50);
      
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
        
        verboseLog(`📊 Filtered to ${filteredAlbums.length} albums for ${loadTier} tier`);
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
      
      verboseLog(`📦 Converted ${rssAlbums.length} albums to RSSAlbum format`);
      
      // Deduplicate albums with better logging
      const albumMap = new Map<string, RSSAlbum>();
      const duplicates: string[] = [];
      
      rssAlbums.forEach((album) => {
        const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
        if (albumMap.has(key)) {
          duplicates.push(`"${album.title}" by ${album.artist}`);
          console.warn(`⚠️ Duplicate album found: "${album.title}" by ${album.artist}`);
        } else {
          albumMap.set(key, album);
        }
      });
      
      const uniqueAlbums = Array.from(albumMap.values());
      
      if (duplicates.length > 0) {
        console.warn(`📦 Found ${duplicates.length} duplicate albums:`, duplicates);
      }
      
      verboseLog(`📦 Deduplicated ${rssAlbums.length} albums to ${uniqueAlbums.length} unique albums`);
      
      // Set albums state
      setAlbums(uniqueAlbums);
      setLoadingProgress(100);
      
      // Cache the results
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cachedAlbums', JSON.stringify(uniqueAlbums));
          localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
          verboseLog('💾 Cached albums in localStorage');
        } catch (error) {
          console.warn('⚠️ Failed to cache albums:', error);
        }
      }
      
      devLog(`✅ Successfully loaded ${uniqueAlbums.length} albums from pre-parsed data`);
      
      return uniqueAlbums;
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error loading albums', err);
      setError(`Error loading album data: ${errorMessage}`);
      toast.error(`Failed to load albums: ${errorMessage}`);
      return [];
    } finally {
      verboseLog('🏁 loadAlbumsData finally block - setting isLoading to false');
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
  };

  // Audio playback functions are now handled by the global AudioContext

  // Shuffle functionality is now handled by the global AudioContext

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
    
    // Filter out explicit content by default
    const baseAlbums = albums.filter(album => !album.explicit);
    
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
                <h1 className="text-xl font-bold mb-1">Into the ValueVerse</h1>
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
                  <h1 className="text-3xl font-bold mb-1">Into the ValueVerse</h1>
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
                      Loading {albums.length > 0 ? `${albums.length} albums` : `RSS feeds`}...
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
          </div>
        </header>
        
        {/* Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm transform transition-transform duration-300 z-30 border-r border-gray-700 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 pt-20">
            <h2 className="text-xl font-bold mb-6">Menu</h2>
            
            {/* Navigation Links */}
            <div className="mb-8 space-y-2">
              <Link 
                href="/about" 
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>About & Support</span>
              </Link>
            </div>
            
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

              // Always show the section, even if empty, to indicate it exists
              return (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                    <span>Publisher Feeds</span>
                    <span className="text-xs bg-blue-600/80 px-2 py-1 rounded">PC 2.0</span>
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {artists.length > 0 ? (
                      artists.map((artist) => (
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
            
            {/* Feed Stats */}
            <div className="text-sm text-gray-400 space-y-1">
              <p>Default feeds: {totalFeedsCount}</p>
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
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28">
          {isLoading && albums.length === 0 ? (
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
                showShuffle={true}
                onShuffle={handleShuffle}
                resultCount={filteredAlbums.length}
                resultLabel={activeFilter === 'all' ? 'Releases' : 
                  activeFilter === 'albums' ? 'Albums' :
                  activeFilter === 'eps' ? 'EPs' : 'Singles'}
                className="mb-8"
              />

              {/* Shuffle functionality is now handled by the global AudioContext */}

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
              <p className="text-gray-400">Unable to load any album information from the RSS feeds.</p>
            </div>
          )}
        </div>

        {/* Now Playing Bar is now handled by the global AudioContext */}
      </div>
    </div>
  );
}