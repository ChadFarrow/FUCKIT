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
import { getVersionString } from '@/lib/version';
import ControlsBar, { FilterType, ViewType, SortType } from '@/components/ControlsBar';
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
  
  // Shuffle state
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [shuffledTracks, setShuffledTracks] = useState<Array<{track: any, album: RSSAlbum, originalIndex: number}>>([]);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffleTrackIndex, setShuffleTrackIndex] = useState(0);

  useEffect(() => {
    setIsClient(true);
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
    if (!audioRef.current) return false;
    
    const urlsToTry = getAudioUrlsToTry(originalUrl);
    
    for (let i = 0; i < urlsToTry.length; i++) {
      const audioUrl = urlsToTry[i];
      console.log(`🔄 ${context} attempt ${i + 1}/${urlsToTry.length}: ${audioUrl.includes('proxy-audio') ? 'Proxied URL' : 'Direct URL'}`);
      
      try {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        audioRef.current.volume = 0.8;
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log(`✅ ${context} started successfully with ${audioUrl.includes('proxy-audio') ? 'proxied' : 'direct'} URL`);
          return true;
        }
      } catch (attemptError) {
        console.warn(`⚠️ ${context} attempt ${i + 1} failed:`, attemptError);
        // Continue to next URL
      }
    }
    
    return false; // All attempts failed
  };
  
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
            devLog('📦 Loading albums from cache:', parsedAlbums.length, 'albums');
            setAlbums(parsedAlbums);
            setIsLoading(false);
            
            // IMPORTANT: Still load extended feeds in background even when using cache
            // This ensures the full catalog is available
            setTimeout(() => {
              devLog('🔄 Loading extended feeds in background (cached start)');
              loadAlbumsData([], 'extended').then((extendedAlbums) => {
                if (extendedAlbums && extendedAlbums.length > 0) {
                  setAlbums(prevAlbums => {
                    // Filter out duplicates by title+artist
                    const existingKeys = new Set(prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
                    const newAlbums = extendedAlbums.filter(album => {
                      const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                      return !existingKeys.has(key);
                    });
                    
                    if (newAlbums.length > 0) {
                      const combined = [...prevAlbums, ...newAlbums];
                      devLog(`📦 Added ${newAlbums.length} new extended albums to cache, total: ${combined.length}`);
                      
                      // Update cache with full catalog
                      try {
                        localStorage.setItem('cachedAlbums', JSON.stringify(combined));
                        localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
                      } catch (error) {
                        console.warn('⚠️ Failed to update cache with extended albums:', error);
                      }
                      
                      return combined;
                    }
                    return prevAlbums;
                  });
                }
              }).catch(error => {
                console.warn('⚠️ Failed to load extended feeds from cache:', error);
              });
            }, 1000); // 1 second delay when loading from cache
            
            return;
          } catch (error) {
            console.warn('⚠️ Failed to parse cached albums:', error);
          }
        }
      }
    }
    
    // Performance optimization: Load core feeds immediately for fast page load
    setTimeout(() => {
      devLog('🔄 Loading core feeds first for fast initial page load');
      loadAlbumsData([], 'core').then(() => {
        // Load extended feeds in background after core feeds are loaded
        setTimeout(() => {
          devLog('🔄 Loading extended feeds in background');
          loadAlbumsData([], 'extended').then((extendedAlbums) => {
            if (extendedAlbums && extendedAlbums.length > 0) {
              // Append extended albums to existing albums with deduplication
              setAlbums(prevAlbums => {
                // Filter out duplicates by title+artist
                const existingKeys = new Set(prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
                const newAlbums = extendedAlbums.filter(album => {
                  const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                  return !existingKeys.has(key);
                });
                
                const combined = [...prevAlbums, ...newAlbums];
                devLog(`📦 Added ${newAlbums.length} extended albums, total: ${combined.length}`);
                
                // Update cache with combined data
                try {
                  localStorage.setItem('cachedAlbums', JSON.stringify(combined));
                  localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
                } catch (error) {
                  console.warn('⚠️ Failed to cache extended albums:', error);
                }
                
                return combined;
              });
            }
            
            // Load low priority feeds after extended feeds
            setTimeout(() => {
              devLog('🔄 Loading low priority feeds in background');
              loadAlbumsData([], 'lowPriority').then((lowPriorityAlbums) => {
                if (lowPriorityAlbums && lowPriorityAlbums.length > 0) {
                  // Append low priority albums with deduplication
                  setAlbums(prevAlbums => {
                    const existingKeys = new Set(prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
                    const newAlbums = lowPriorityAlbums.filter(album => {
                      const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                      return !existingKeys.has(key);
                    });
                    
                    const combined = [...prevAlbums, ...newAlbums];
                    devLog(`📦 Added ${newAlbums.length} low priority albums, total: ${combined.length}`);
                    
                    // Update cache with all data
                    try {
                      localStorage.setItem('cachedAlbums', JSON.stringify(combined));
                      localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
                    } catch (error) {
                      console.warn('⚠️ Failed to cache low priority albums:', error);
                    }
                    
                    return combined;
                  });
                }
              }).catch(error => {
                console.warn('⚠️ Failed to load low priority feeds:', error);
              });
            }, 4000); // 4 second delay to load after extended feeds
            
          }).catch(error => {
            console.warn('⚠️ Failed to load extended feeds:', error);
          });
        }, 2000); // 2 second delay to let core content load first
      });
    }, 100);
  }, []); // Run only once on mount


  // Mobile audio initialization - handle autoplay restrictions
  useEffect(() => {
    if (typeof window !== 'undefined' && audioRef.current) {
      // Add touch event listener to initialize audio context on mobile
      const handleTouchStart = () => {
        if (audioRef.current) {
          // Just load the audio context without playing
          // This prevents unwanted autoplay while still initializing the context
          audioRef.current.load();
          
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
    };

    const handlePause = () => {
      setIsPlaying(false);
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
    // Load feeds configuration from data/feeds.json
    let feedsConfig: any = { core: [], extended: [], low: [] };
    try {
      const response = await fetch('/api/feeds');
      if (response.ok) {
        feedsConfig = await response.json();
        devLog('✅ Loaded feeds configuration:', feedsConfig);
        
        // Update total feeds count for display
        const totalCount = (feedsConfig.core?.length || 0) + 
                          (feedsConfig.extended?.length || 0) + 
                          (feedsConfig.low?.length || 0) +
                          (feedsConfig.publisher?.length || 0);
        setTotalFeedsCount(totalCount);
      }
    } catch (error) {
      console.warn('Failed to load feeds configuration:', error);
    }
    
    // Convert feed objects to URLs for PodcastIndex API
    const convertFeedsToUrls = (feeds: any[]) => 
      feeds.map((feed: any) => `/api/podcastindex?feedUrl=${encodeURIComponent(feed.originalUrl)}`);
    
    // Get publisher feeds for background loading
    const publisherFeeds = convertFeedsToUrls(feedsConfig.publisher || []);
    
    // Performance optimization: Load feeds in tiers for faster initial page load
    let feedsToLoad: string[] = [];
    
    if (loadTier === 'core') {
      feedsToLoad = [...convertFeedsToUrls(feedsConfig.core || []), ...additionalFeeds];
      devLog('🚀 Loading CORE feeds only for fast initial load:', feedsToLoad.length, 'feeds');
    } else if (loadTier === 'extended') {
      feedsToLoad = convertFeedsToUrls(feedsConfig.extended || []);
      devLog('🚀 Loading EXTENDED feeds (background load):', feedsToLoad.length, 'feeds');
    } else if (loadTier === 'lowPriority') {
      feedsToLoad = convertFeedsToUrls(feedsConfig.low || []);
      devLog('🚀 Loading LOW PRIORITY feeds (background load):', feedsToLoad.length, 'feeds');
    } else {
      // 'all' - load all feeds from configuration
      const allConfigFeeds = [
        ...(feedsConfig.core || []),
        ...(feedsConfig.extended || []),
        ...(feedsConfig.low || [])
      ];
      feedsToLoad = [...convertFeedsToUrls(allConfigFeeds), ...additionalFeeds];
      devLog('🚀 Loading ALL feeds from configuration:', feedsToLoad.length, 'feeds');
    }
    
    // DEDUPLICATION: Remove duplicate URLs to prevent redundant parsing
    const originalCount = feedsToLoad.length;
    feedsToLoad = Array.from(new Set(feedsToLoad)); // Remove duplicates using Set
    const deduplicatedCount = feedsToLoad.length;
    
    if (originalCount !== deduplicatedCount) {
      const duplicatesRemoved = originalCount - deduplicatedCount;
      console.warn(`⚠️ DEDUPLICATION: Removed ${duplicatesRemoved} duplicate feed URLs`);
      verboseLog(`📊 Feed count: ${originalCount} → ${deduplicatedCount} (${duplicatesRemoved} duplicates removed)`);
    } else {
      verboseLog(`✅ No duplicate feeds found in ${loadTier} tier`);
    }
    
    const allFeeds = feedsToLoad;
    
    try {
      verboseLog('🚀 loadAlbumsData called with additionalFeeds:', additionalFeeds);
      verboseLog('🚀 Current feedsToLoad:', feedsToLoad);
      verboseLog('🚀 Using original RSS feed URLs directly');
      setIsLoading(true);
      setError(null);
      
      // Remove test code and restore normal RSS feed loading
      if (loadTier === 'core') {
        devLog('🚀 Starting CORE feed loading for fast page display...');
      } else if (loadTier === 'extended') {
        devLog('🚀 Starting EXTENDED feed loading in background...');
      } else if (loadTier === 'lowPriority') {
        devLog('🚀 Starting LOW PRIORITY feed loading in background...');
      } else {
        devLog('🚀 Starting ALL feed loading (legacy mode)...');
      }
      
      verboseLog('Starting to load album data...');
      
      // Add debugging to see what's happening
      verboseLog('🔍 About to call RSSParser.parseMultipleFeeds with:', allFeeds.length, 'feeds');
      verboseLog('🔍 First few feed URLs:', allFeeds.slice(0, 3));
      verboseLog('Feed URLs:', allFeeds);
      verboseLog('Loading', allFeeds.length, 'feeds...');
      
      // Update progress as feeds load
      setLoadingProgress(0);
      
      // Performance optimization: Smaller batches for faster perceived loading
      const BATCH_SIZE = loadTier === 'core' ? 6 : (loadTier === 'lowPriority' ? 8 : 12); // Smaller batches for core, medium for low priority, larger for extended
      const BATCH_DELAY = loadTier === 'core' ? 50 : (loadTier === 'lowPriority' ? 300 : 200); // Faster core loading, slower low priority, medium extended
      
      let albumsData: RSSAlbum[] = [];
      
      try {
        // Process feeds in batches for progressive loading
        devLog(`📊 Loading ${allFeeds.length} feeds in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < allFeeds.length; i += BATCH_SIZE) {
          const batch = allFeeds.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allFeeds.length / BATCH_SIZE);
          
          verboseLog(`🔄 Loading batch ${batchNumber}/${totalBatches} (${batch.length} feeds)`);
          
          try {
            // Parse batch with individual timeout
            const batchPromise = RSSParser.parseMultipleFeeds(batch);
            const batchTimeout = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Batch ${batchNumber} timeout`)), 15000);
            });
            
            const batchAlbums = await Promise.race([batchPromise, batchTimeout]) as RSSAlbum[];
            
            if (batchAlbums && batchAlbums.length > 0) {
              // Use React state-based deduplication to prevent sync issues
              setAlbums(prev => {
                const existingKeys = new Set(prev.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
                const newAlbums = batchAlbums.filter(album => {
                  const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                  return !existingKeys.has(key);
                });
                
                // Debug: Log albums without cover art
                const albumsWithoutArt = newAlbums.filter(album => !album.coverArt);
                if (albumsWithoutArt.length > 0 && isDev) {
                  console.log(`⚠️ ${albumsWithoutArt.length} albums missing cover art:`, albumsWithoutArt.map(a => a.title));
                }
                
                return [...prev, ...newAlbums];
              });
              
              albumsData = [...albumsData, ...batchAlbums]; // Keep local copy in sync
              
              // Update progress (only show for core feeds to avoid confusing users)
              if (loadTier === 'core') {
                const progress = Math.min(((i + BATCH_SIZE) / allFeeds.length) * 100, 100);
                setLoadingProgress(progress);
              }
              
              verboseLog(`✅ Batch ${batchNumber} loaded: ${batchAlbums.length} albums (total: ${albumsData.length})`);
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
        
        devLog(`📦 Total albums loaded: ${albumsData.length}`);

        // Load configured publisher feeds in background (non-blocking)
        devLog(`🏢 Loading ${publisherFeeds.length} configured publisher feeds in background`);

        // Load publisher feeds asynchronously without blocking the UI
        if (publisherFeeds.length > 0) {
          
          const loadPublisherFeeds = async () => {
            const publisherAlbums: RSSAlbum[] = [];
            
            for (let i = 0; i < publisherFeeds.length; i++) {
              const publisherFeedUrl = publisherFeeds[i];
              devLog(`🏢 Loading publisher feed ${i + 1}/${publisherFeeds.length}: ${publisherFeedUrl}`);
              
              try {
                // Use the proper publisher feed parsing method
                const publisherBatchAlbums = await RSSParser.parsePublisherFeedAlbums(publisherFeedUrl);
                publisherAlbums.push(...publisherBatchAlbums);
                devLog(`✅ Publisher ${i + 1}/${publisherFeeds.length} loaded: ${publisherBatchAlbums.length} albums`);
              } catch (error) {
                console.warn(`⚠️ Publisher feed ${publisherFeedUrl} failed:`, error);
              }
              
              // Small delay between publisher feeds
              if (i + 1 < publisherFeeds.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY * 2));
              }
            }
            
            devLog(`🎶 Loaded ${publisherAlbums.length} albums from ${publisherFeeds.length} publisher feeds`);
            
            // Combine with existing albums using React state for proper deduplication
            setAlbums(prevAlbums => {
              const existingKeys = new Set(
                prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`)
              );
              
              const newAlbums = publisherAlbums.filter(album => {
                const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                return !existingKeys.has(key);
              });
              
              if (newAlbums.length > 0) {
                devLog(`✅ Added ${newAlbums.length} new albums from ${publisherFeeds.length} publisher feeds`);
                return [...prevAlbums, ...newAlbums];
              } else {
                devLog(`📦 No new albums from publisher feeds (${publisherAlbums.length} total, all duplicates)`);
                return prevAlbums;
              }
            });
          };
          
          // Don't await this - let it run in background
          loadPublisherFeeds().catch(error => {
            console.warn('⚠️ Failed to load publisher feeds:', error);
          });
        }
        devLog(`📦 Total albums after initial load: ${albumsData.length}`);
      } catch (parseError) {
        console.error('❌ Album parsing failed:', parseError);
        console.error('❌ Failed feeds:', allFeeds);
        throw parseError;
      }
      
      verboseLog('Albums data received:', albumsData);
      
      if (albumsData && albumsData.length > 0) {
        verboseLog('✅ Setting albums:', albumsData.length, 'albums');
        // Only set albums if we don't already have albums displayed (prevents page refresh)
        setAlbums(prev => prev.length === 0 ? albumsData : prev);
        verboseLog('Successfully set', albumsData.length, 'albums');
        
        // Cache albums in localStorage for faster subsequent loads (only for core tier)
        if (typeof window !== 'undefined' && loadTier === 'core') {
          try {
            localStorage.setItem('cachedAlbums', JSON.stringify(albumsData));
            localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
            verboseLog('💾 Cached core albums in localStorage');
          } catch (error) {
            console.warn('⚠️ Failed to cache albums:', error);
          }
        }
        
        // Return albums for use in promise chains
        return albumsData;
      } else {
        const errorMsg = 'Failed to load any album data from RSS feeds';
        logger.error(errorMsg, null, { feedCount: allFeeds.length });
        setError(errorMsg);
        toast.error('No albums could be loaded. Please try again later.');
        return [];
      }
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error loading albums', err, { feedCount: allFeeds?.length });
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

      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    } else {
      // Play this album from the beginning
      try {
        console.log('🎵 Attempting to play:', album.title, 'Track URL:', firstTrack.url);
        
        // Use proxy helper for external URLs
        const success = await attemptAudioPlayback(firstTrack.url, 'Album playback');
        if (success) {
          // Success - update state
          setCurrentPlayingAlbum(album.title);
          setCurrentTrackIndex(0);
          setIsPlaying(true);
          
          // Set global track info for persistent player

          
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
    }
  };

  const playShuffledTrack = async (index: number) => {
    if (!shuffledTracks[index] || !audioRef.current) return;
    
    const { track, album } = shuffledTracks[index];
    const originalUrl = track.url;
    
    try {
      console.log('🎵 Playing shuffled track:', track.title, 'from album:', album.title, 'URL:', originalUrl);
      
      const success = await attemptAudioPlayback(originalUrl, 'Shuffle');
      
      if (success) {
        // Update state
        setCurrentPlayingAlbum(album.title);
        setCurrentTrackIndex(index);
        setIsPlaying(true);
        setShuffleTrackIndex(index);
        
      } else {
        throw new Error('All URL attempts failed for shuffled track');
      }
      
    } catch (error) {
      console.error('Error playing shuffled track:', error);
      toast.error('Failed to play track');
    }
  };

  const playNextTrack = () => {
    if (!audioRef.current) return;
    
    // Handle shuffle mode
    if (isShuffleMode && shuffledTracks.length > 0) {
      const nextIndex = shuffleTrackIndex + 1;
      if (nextIndex < shuffledTracks.length) {
        playShuffledTrack(nextIndex);
      } else {
        // End of shuffled playlist, reset
        setIsPlaying(false);
        setCurrentPlayingAlbum(null);
        setCurrentTrackIndex(0);
        setIsShuffleMode(false);
        setShuffledTracks([]);
        setShuffleTrackIndex(0);

        toast.success('🎵 Shuffle playlist completed!');
      }
      return;
    }
    
    // Original album-based next track logic
    if (!currentPlayingAlbum) return;
    
    // Find the current album
    const currentAlbum = albums.find(album => album.title === currentPlayingAlbum);
    if (!currentAlbum) return;
    
    // Check if there's a next track
    if (currentTrackIndex < currentAlbum.tracks.length - 1) {
      const nextTrack = currentAlbum.tracks[currentTrackIndex + 1];
      if (nextTrack && nextTrack.url) {
        attemptAudioPlayback(nextTrack.url, 'Next track').then((success) => {
          if (success) {
            setCurrentTrackIndex(currentTrackIndex + 1);
            
          } else {
            console.error('Error playing next track: all URLs failed');
          }
        }).catch(err => {
          console.error('Error playing next track:', err);
        });
      }
    } else {
      // Album ended, reset
      setIsPlaying(false);
      setCurrentPlayingAlbum(null);
      setCurrentTrackIndex(0);

    }
  };

  // Shuffle function that flattens all tracks and shuffles them
  const handleShuffle = async () => {
    // Flatten all tracks from all albums into a single array
    const allTracks: Array<{track: any, album: RSSAlbum, originalIndex: number}> = [];
    
    albums.forEach(album => {
      album.tracks.forEach((track, trackIndex) => {
        // Only include tracks with valid URLs
        if (track.url && track.url.trim()) {
          allTracks.push({
            track,
            album,
            originalIndex: trackIndex
          });
        }
      });
    });
    
    // Check if we have any playable tracks
    if (allTracks.length === 0) {
      toast.error('No playable tracks found');
      return;
    }
    
    // Shuffle the tracks using Fisher-Yates algorithm
    const shuffled = [...allTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Set shuffle mode and tracks
    setShuffledTracks(shuffled);
    setIsShuffleMode(true);
    setShuffleTrackIndex(0);
    setViewType('list'); // Force list view for track display
    
    // Show success message
    toast.success(`🎵 Shuffled ${shuffled.length} tracks! Starting playback...`);
    
    // Start playing the first shuffled track immediately with the shuffled array
    if (shuffled.length > 0 && audioRef.current) {
      const { track, album } = shuffled[0];
      
      try {
        console.log('🎵 Starting shuffle playback:', track.title, 'from album:', album.title);
        
        // Use proxy helper for external URLs
        const success = await attemptAudioPlayback(track.url, 'Shuffle startup');
        if (success) {
          // Update state after successful play
          setCurrentPlayingAlbum(album.title);
          setCurrentTrackIndex(0);
          setIsPlaying(true);
          setShuffleTrackIndex(0);
          
          
          console.log('✅ Successfully started shuffle playback');
        } else {
          console.error('Error starting shuffle playback: all URLs failed');
          toast.error('Failed to start playback - try a different track');
        }
      } catch (error) {
        console.error('Error setting up shuffle playback:', error);
        toast.error('Failed to start playback');
      }
    }
  };

  // Helper functions for filtering and sorting
    const getFilteredAlbums = () => {
    // Universal sorting function that implements hierarchical order: Albums → EPs → Singles
    const sortWithHierarchy = (albums: RSSAlbum[]) => {
      // If shuffle is active, randomize the order
      if (shuffleSeed > 0) {
        // Create a seeded random function for consistent shuffling
        const seededRandom = (min: number, max: number) => {
          const x = Math.sin(shuffleSeed) * 10000;
          return min + (x - Math.floor(x)) * (max - min);
        };
        
        // Shuffle the albums array
        const shuffled = [...albums].sort(() => seededRandom(-1, 1));
        return shuffled;
      }
      
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
      case 'explicit':
        filtered = albums.filter(album => album.explicit); // Show only explicit content
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

          }}
          onPause={() => {
            setIsPlaying(false);

          }}
          onEnded={playNextTrack}
          onError={(e) => {
            console.error('Audio error:', e);
            setError('Audio playback error - please try again');
            setTimeout(() => setError(null), 3000);
          }}
          preload="none"
          crossOrigin="anonymous"
          playsInline
          webkit-playsinline="true"
          autoPlay={false}
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
            {/* Mobile Header - Stacked Layout */}
            <div className="block sm:hidden mb-6">
              {/* Top row - Menu, Logo, About */}
              <div className="flex items-center justify-between mb-3">
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
                <h1 className="text-2xl font-bold mb-2">Into the ValueVerse</h1>
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full border border-yellow-500/30">
                  Beta - might not work
                </span>
              </div>
            </div>

            {/* Desktop Header - Original Layout */}
            <div className="hidden sm:block mb-8">
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
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold">Into the ValueVerse</h1>
                  <span className="text-sm bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full border border-yellow-500/30">
                    Beta - might not work
                  </span>
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
        <div className="container mx-auto px-6 py-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner 
                size="large"
                text="Loading music feeds"
                showProgress={loadingProgress > 0}
                progress={loadingProgress}
              />
              {albums.length > 0 && (
                <p className="text-center text-sm text-gray-400 mt-2">
                  {albums.length} albums loaded so far...
                </p>
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
                onShuffle={handleShuffle}
                showShuffle={true}
                resultCount={filteredAlbums.length}
                resultLabel={activeFilter === 'all' ? 'Releases' : 
                  activeFilter === 'albums' ? 'Albums' :
                  activeFilter === 'eps' ? 'EPs' : 'Singles'}
                className="mb-8"
              />

              {/* Shuffle Mode Track List */}
              {isShuffleMode && shuffledTracks.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      🎵 Shuffle Mode
                      <span className="text-sm bg-purple-600/80 px-2 py-1 rounded-full">
                        {shuffledTracks.length} tracks
                      </span>
                    </h2>
                    <button
                      onClick={() => {
                        setIsShuffleMode(false);
                        setShuffledTracks([]);
                        setShuffleTrackIndex(0);
                        setViewType('grid');
                        toast.success('🎵 Exited shuffle mode');
                      }}
                      className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium"
                    >
                      Exit Shuffle
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {shuffledTracks.map((item, index) => {
                      const { track, album } = item;
                      const isCurrentlyPlaying = isShuffleMode && shuffleTrackIndex === index && isPlaying;
                      
                      return (
                        <div
                          key={`shuffle-${index}`}
                          className={`group flex items-center gap-4 p-4 backdrop-blur-sm rounded-xl transition-all duration-200 border ${
                            isCurrentlyPlaying 
                              ? 'bg-blue-600/20 border-blue-500/50' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                            <Image 
                              src={getAlbumArtworkUrl(album.coverArt || '', 'thumbnail')} 
                              alt={album.title}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getPlaceholderImageUrl('thumbnail');
                              }}
                            />
                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                              <button 
                                className="bg-white text-black rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg"
                                onClick={() => playShuffledTrack(index)}
                              >
                                {isCurrentlyPlaying ? (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate group-hover:text-blue-400 transition-colors">
                              {track.title}
                            </h3>
                            <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                            <p className="text-gray-500 text-xs truncate">from {album.title}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="px-2 py-1 bg-white/10 rounded text-xs">
                              #{index + 1}
                            </span>
                            {isCurrentlyPlaying && (
                              <div className="flex items-center gap-1 text-blue-400">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <span className="text-xs">Now Playing</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Albums Display */}
              {!isShuffleMode && activeFilter === 'all' ? (
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
                          attemptAudioPlayback(prevTrack.url, 'Previous track').then((success) => {
                            if (success) {
                              setCurrentTrackIndex(currentTrackIndex - 1);
                            }
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