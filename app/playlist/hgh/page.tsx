'use client';

import { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Music, Search, Filter, ChevronDown, X, Loader2, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  source: string;
  image?: string;
  feedGuid?: string;
  itemGuid?: string;
  resolved?: boolean;
  loading?: boolean;
  valueForValue?: {
    feedGuid: string;
    itemGuid: string;
    remotePercentage: number;
    resolved?: boolean;
    resolvedTitle?: string;
    resolvedArtist?: string;
    resolvedAudioUrl?: string;
    resolvedDuration?: number;
  };
}

type SortOption = 'episode-desc' | 'episode-asc' | 'title-asc' | 'title-desc' | 'artist-asc' | 'artist-desc' | 'time-asc';
type FilterSource = 'all' | 'chapter' | 'value-split' | 'description' | 'external-feed';

interface CachedData {
  tracks: Track[];
  timestamp: number;
  feedUrl: string;
}

const CACHE_KEY = 'hgh_playlist_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
const FEED_URL = 'https://feed.homegrownhits.xyz/feed.xml';

export default function HGHPlaylistPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Debug loading state changes
  useEffect(() => {
    console.log('🔄 Loading state changed to:', loading);
  }, [loading]);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'main' | 'complete'>('main');
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'cached' | null>(null);
  const [playQueue, setPlayQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [continuousPlay, setContinuousPlay] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  
  // Search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('episode-desc');
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [filterEpisode, setFilterEpisode] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Load cached data on component mount
  useEffect(() => {
    console.log('🚀 HGH Playlist component mounted');
    
    // Force clear cache to ensure fresh data
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Cleared HGH cache to force fresh data load');
    
    const loadCachedData = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: CachedData = JSON.parse(cached);
          const now = Date.now();
          
          // Check if cache has resolved V4V data
          const hasResolvedData = data.tracks.some(track => 
            track.valueForValue?.resolved === true && track.valueForValue?.resolvedAudioUrl
          );
          
          // Check if cache is still valid AND has resolved V4V data
          if (now - data.timestamp < CACHE_DURATION && hasResolvedData) {
            console.log('📦 Loading tracks from cache with resolved V4V data');
            setTracks(data.tracks);
            setLoading(false);
            setCacheStatus('cached');
            return true; // Cache was used
          } else {
            if (!hasResolvedData) {
              console.log('🔄 Cache missing V4V resolved audio URLs, will fetch fresh data');
            } else {
              console.log('⏰ Cache expired, will fetch fresh data');
            }
            localStorage.removeItem(CACHE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to load cache:', error);
        localStorage.removeItem(CACHE_KEY);
      }
      return false; // Cache was not used
    };

    const cacheUsed = loadCachedData();
    if (!cacheUsed) {
      console.log('🔄 No cache available, loading tracks from API...');
      loadTracks();
    }
  }, []);

  const saveToCache = (tracks: Track[], feedUrl: string) => {
    try {
      const data: CachedData = {
        tracks,
        timestamp: Date.now(),
        feedUrl
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log('💾 Saved tracks to cache');
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    setCacheStatus(null);
    localStorage.removeItem(CACHE_KEY);
    
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for refresh
      
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(FEED_URL)}&forceRefresh=true&saveToDatabase=true&limit=50&resolveV4V=true`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.tracks) {
        const processedTracks = data.data.tracks.map((track: any, index: number) => ({
          ...track,
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          loading: false
        }));

        setTracks(processedTracks);
        setStats(data.data.stats);
        setLastUpdated(new Date().toLocaleString());
        setCacheStatus('fresh');
        
        // Save to cache
        saveToCache(processedTracks, FEED_URL);
        
        console.log(`✅ Refreshed ${processedTracks.length} tracks from Homegrown Hits feed`);
      } else {
        throw new Error(data.error || 'Failed to refresh tracks');
      }
    } catch (error) {
      console.error('Error refreshing tracks:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Refresh timed out. The Homegrown Hits feed is very large and may take a while to process.');
        } else {
          setError(`Failed to refresh tracks: ${error.message}`);
        }
      } else {
        setError('Failed to refresh tracks: Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  const extractEpisodeNumber = (episodeTitle: string): number => {
    const match = episodeTitle.match(/Episode\s+(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  const loadTracks = async () => {
    try {
      console.log('🎵 Loading main feed tracks...');
      await loadMainFeedTracks();
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setError('Failed to load tracks. Please try again.');
      setLoading(false);
    } finally {
      console.log('🏁 loadTracks completed, loading state:', loading);
    }
  };

  const loadMainFeedTracks = async () => {
    try {
      console.log('🔍 Starting to load main feed tracks...');
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      console.log('📡 Fetching from API...');
      // First try to load from database without forcing refresh, but ensure V4V is resolved
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(FEED_URL)}&limit=50&resolveV4V=true`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('✅ API response received:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('📄 Parsing JSON response...');
      const data = await response.json();
      console.log('✅ JSON parsed successfully, data structure:', Object.keys(data));
      
      if (data.success && data.data.tracks) {
        console.log('🎵 Processing tracks...');
        const processedTracks = data.data.tracks.map((track: any, index: number) => ({
          ...track,
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          loading: false
        }));

        console.log('📊 Setting state with tracks:', processedTracks.length);
        setTracks(processedTracks);
        setStats(data.data.stats);
        setLastUpdated(new Date().toLocaleString());
        setCacheStatus('fresh');
        
        // Save to cache
        saveToCache(processedTracks, FEED_URL);
        
        console.log(`✅ Loaded ${processedTracks.length} tracks from Homegrown Hits feed`);
      } else {
        throw new Error(data.error || 'Failed to load tracks');
      }
    } catch (error) {
      console.error('Error loading main feed tracks:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Request timed out. The Homegrown Hits feed is very large and may take a while to process.');
        } else {
          setError(`Failed to load tracks from Homegrown Hits feed: ${error.message}`);
        }
      } else {
        setError('Failed to load tracks from Homegrown Hits feed: Unknown error');
      }
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  const loadCompleteCatalog = async () => {
    try {
      setLoading(true);
      console.log('🎵 Loading complete catalog...');
      
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(FEED_URL)}&forceRefresh=true&saveToDatabase=true&includeAllEpisodes=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.tracks) {
        const processedTracks = data.data.tracks.map((track: any, index: number) => ({
          ...track,
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          loading: false
        }));

        setTracks(processedTracks);
        setStats(data.data.stats);
        setLastUpdated(new Date().toLocaleString());
        setCacheStatus('fresh');
        
        // Save to cache
        saveToCache(processedTracks, FEED_URL);
        
        console.log(`✅ Loaded ${processedTracks.length} tracks from complete catalog`);
      } else {
        throw new Error(data.error || 'Failed to load complete catalog');
      }
    } catch (error) {
      console.error('Error loading complete catalog:', error);
      setError('Failed to load complete catalog');
    } finally {
      setLoading(false);
    }
  };

  const getAudioUrl = (track: Track): string | null => {
    console.log('🔍 getAudioUrl called with track:', {
      title: track.title,
      hasValueForValue: !!track.valueForValue,
      resolved: track.valueForValue?.resolved,
      resolvedAudioUrl: track.valueForValue?.resolvedAudioUrl,
      feedGuid: track.valueForValue?.feedGuid,
      itemGuid: track.valueForValue?.itemGuid
    });
    
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      console.log('✅ Returning resolved V4V audio URL');
      return track.valueForValue.resolvedAudioUrl;
    }
    
    // If we have V4V data but it's not resolved, return null (no fallback)
    if (track.valueForValue?.feedGuid && track.valueForValue?.itemGuid) {
      console.log('❌ V4V data not resolved, no fallback allowed');
      console.warn(`Track "${track.title}" - V4V not resolved. Feed: ${track.valueForValue.feedGuid}, Item: ${track.valueForValue.itemGuid}. No episode audio fallback allowed.`);
      return null; // No fallback - only real MP3s allowed
    }
    
    // If no V4V data at all, return null
    console.log('❌ No V4V data available, no fallback allowed');
    return null;
  };

  const getDisplayTitle = (track: Track): string => {
    // First try resolved V4V title
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedTitle) {
      return track.valueForValue.resolvedTitle;
    }
    
    // If V4V not resolved, clean up the title by removing artist information
    const title = track.title;
    
    // Remove "by Artist Name" from end
    const cleanTitle = title.replace(/\s+by\s+.+$/i, '');
    
    // Remove "Artist Name - " or "Artist Name: " from beginning
    const finalTitle = cleanTitle.replace(/^.+?\s*[-:]\s*/, '');
    
    return finalTitle;
  };

  const getDisplayArtist = (track: Track): string => {
    // First try resolved V4V artist
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedArtist) {
      return track.valueForValue.resolvedArtist;
    }
    
    // If V4V not resolved, try to extract artist from track title
    const title = track.title;
    
    // Pattern: "Song Title by Artist Name"
    const byMatch = title.match(/by\s+(.+)$/i);
    if (byMatch) {
      return byMatch[1].trim();
    }
    
    // Pattern: "Artist Name - Song Title" or "Artist Name: Song Title"
    const dashMatch = title.match(/^(.+?)\s*[-:]\s*(.+)$/);
    if (dashMatch) {
      return dashMatch[1].trim();
    }
    
    // Pattern: "Song Title (Live) by Artist Name"
    const liveByMatch = title.match(/\(Live\)\s+by\s+(.+)$/i);
    if (liveByMatch) {
      return liveByMatch[1].trim();
    }
    
    // If no pattern matches, return the original artist (likely "Unknown Artist")
    return track.artist;
  };

  const getAudioSource = (track: Track): 'v4v' | 'unresolved' => {
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      return 'v4v';
    }
    return 'unresolved';
  };

  const playTrack = async (track: Track, addToQueue = false) => {
    console.log('🎵 playTrack called for:', getDisplayTitle(track));
    console.log('🎵 Track data:', {
      id: track.id,
      audioUrl: getAudioUrl(track),
      hasValueForValue: !!track.valueForValue,
      resolved: track.valueForValue?.resolved
    });
    console.log('🎵 Full track object:', track);

    try {
      // Stop current audio if playing
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      setAudioLoading(track.id);
      console.log('🎵 Setting audio loading state');

      const audioUrl = getAudioUrl(track);
      console.log('🎵 Getting audio URL...');
      console.log('🎵 getAudioUrl check:', {
        hasValueForValue: !!track.valueForValue,
        resolved: track.valueForValue?.resolved,
        resolvedAudioUrl: track.valueForValue?.resolvedAudioUrl
      });
      
      // Check if we have a valid audio URL
      if (!audioUrl) {
        console.log('❌ No valid audio URL available - V4V not resolved');
        setError(`Cannot play "${track.title}" - V4V data not resolved. Only real MP3 files are allowed, no episode audio fallback.`);
        setAudioLoading(null);
        return;
      }
      
      console.log('🎵 Final audio URL:', audioUrl);

      // Create new audio element
      const newAudio = new Audio();
      console.log('🎵 Creating new Audio element...');
      
      newAudio.src = audioUrl;
      newAudio.preload = 'metadata';
      
      console.log('🎵 Audio element created successfully');

      // All tracks now use resolved V4V audio - start from beginning and play full duration
      console.log('🎵 Using resolved V4V track - starting from beginning (0 seconds)');
      newAudio.currentTime = 0;
      console.log('🎵 Individual track - will play until natural end');

      // Set up event listeners
      newAudio.addEventListener('loadstart', () => {
        console.log('🎵 Audio loadstart event');
      });

      newAudio.addEventListener('loadeddata', () => {
        console.log('🎵 Audio loadeddata event');
      });

      newAudio.addEventListener('canplay', () => {
        console.log('🎵 Audio canplay event');
      });

      newAudio.addEventListener('canplaythrough', () => {
        console.log('🎵 Audio canplaythrough event');
      });

      newAudio.addEventListener('playing', () => {
        console.log('🎵 Audio playing event');
        setCurrentTrack(track.id);
        setAudioLoading(null);
      });

      newAudio.addEventListener('pause', () => {
        console.log('🎵 Audio pause event');
        if (currentTrack === track.id) {
          setCurrentTrack(null);
        }
      });

      newAudio.addEventListener('ended', () => {
        console.log('🎵 Audio ended event');
        handleTrackEnd();
      });

      newAudio.addEventListener('error', (e) => {
        console.error('🎵 Audio error:', e);
        setAudioLoading(null);
        setError('Failed to load audio');
      });

      // Set current time for episode audio
      if (track.startTime > 0) {
        console.log('🎵 Using episode audio - setting current time to:', track.startTime);
        newAudio.addEventListener('loadedmetadata', () => {
          newAudio.currentTime = track.startTime;
        });
      }

      // Set duration timer for episode audio
      if (track.duration > 0) {
        console.log('🎵 Episode audio - setting timer for duration:', track.duration, 'seconds');
        setTimeout(() => {
          if (newAudio === audio && currentTrack === track.id) {
            handleTrackEnd();
          }
        }, track.duration * 1000);
      }

      // Start playing
      console.log('🎵 Attempting to play audio...');
      const playResult = await newAudio.play();
      console.log('🎵 Audio play() succeeded');
      
      setAudio(newAudio);

      // Add to queue if requested
      if (addToQueue) {
        setPlayQueue(prev => [...prev, track.id]);
      }

    } catch (error) {
      console.error('Error playing track:', error);
      setAudioLoading(null);
      setError('Failed to play track');
    }
  };

  const handleTrackEnd = () => {
    console.log('🎵 Track ended, handling...');
    
    if (continuousPlay && playQueue.length > 0) {
      // Play next track in queue
      const nextIndex = queueIndex + 1;
      if (nextIndex < playQueue.length) {
        const nextTrackId = playQueue[nextIndex];
        const nextTrack = tracks.find(t => t.id === nextTrackId);
        if (nextTrack) {
          setQueueIndex(nextIndex);
          playTrack(nextTrack);
        }
      } else {
        // Queue finished, stop continuous play
        setContinuousPlay(false);
        setQueueIndex(-1);
        setCurrentTrack(null);
      }
    } else {
      // Stop current track
      setCurrentTrack(null);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  };

  const playNextInQueue = () => {
    if (queueIndex < playQueue.length - 1) {
      const nextIndex = queueIndex + 1;
      const nextTrackId = playQueue[nextIndex];
      const nextTrack = tracks.find(t => t.id === nextTrackId);
      if (nextTrack) {
        setQueueIndex(nextIndex);
        playTrack(nextTrack);
      }
    }
  };

  const playPreviousInQueue = () => {
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      const prevTrackId = playQueue[prevIndex];
      const prevTrack = tracks.find(t => t.id === prevTrackId);
      if (prevTrack) {
        setQueueIndex(prevIndex);
        playTrack(prevTrack);
      }
    }
  };

  const addAllToQueue = () => {
    const trackIds = filteredTracks.map(track => track.id);
    setPlayQueue(trackIds);
    setQueueIndex(-1);
    setContinuousPlay(true);
  };

  const clearQueue = () => {
    setPlayQueue([]);
    setQueueIndex(-1);
    setContinuousPlay(false);
  };

  const removeFromQueue = (trackId: string) => {
    setPlayQueue(prev => prev.filter(id => id !== trackId));
  };

  const stopTrack = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTrack(null);
    setAudioLoading(null);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSortBy('episode-desc');
    setFilterSource('all');
    setFilterEpisode('all');
  };

  // Filter and sort tracks
  const filteredTracks = useMemo(() => {
    let filtered = tracks;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(track => 
        getDisplayTitle(track).toLowerCase().includes(query) ||
        getDisplayArtist(track).toLowerCase().includes(query) ||
        track.episodeTitle.toLowerCase().includes(query)
      );
    }

    // Filter by source
    if (filterSource !== 'all') {
      filtered = filtered.filter(track => track.source === filterSource);
    }

    // Filter by episode
    if (filterEpisode !== 'all') {
      filtered = filtered.filter(track => track.episodeTitle === filterEpisode);
    }

    // Sort tracks
    switch (sortBy) {
      case 'episode-desc':
        filtered.sort((a, b) => extractEpisodeNumber(b.episodeTitle) - extractEpisodeNumber(a.episodeTitle));
        break;
      case 'episode-asc':
        filtered.sort((a, b) => extractEpisodeNumber(a.episodeTitle) - extractEpisodeNumber(b.episodeTitle));
        break;
      case 'title-asc':
        filtered.sort((a, b) => getDisplayTitle(a).localeCompare(getDisplayTitle(b)));
        break;
      case 'title-desc':
        filtered.sort((a, b) => getDisplayTitle(b).localeCompare(getDisplayTitle(a)));
        break;
      case 'artist-asc':
        filtered.sort((a, b) => getDisplayArtist(a).localeCompare(getDisplayArtist(b)));
        break;
      case 'artist-desc':
        filtered.sort((a, b) => getDisplayArtist(b).localeCompare(getDisplayArtist(a)));
        break;
      case 'time-asc':
        filtered.sort((a, b) => a.startTime - b.startTime);
        break;
    }

    return filtered;
  }, [tracks, searchQuery, sortBy, filterSource, filterEpisode]);

  // Get unique episodes for filter dropdown
  const uniqueEpisodes = Array.from(new Set(tracks.map(track => track.episodeTitle))).sort((a, b) => {
    const episodeA = extractEpisodeNumber(a);
    const episodeB = extractEpisodeNumber(b);
    return episodeB - episodeA;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-green-400 mx-auto mb-4 animate-spin" />
              <p className="text-xl">Loading Homegrown Hits playlist...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Homegrown Hits Playlist</h1>
              <p className="text-gray-400 mb-2">Discover DeMu (decentralized music) in the Hitter</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  Music tracks from the Homegrown Hits podcast feed
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={stopTrack}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Stop All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 mx-8 mt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-300 font-semibold mb-1">Error Loading Tracks</p>
              <p className="text-gray-300">{error}</p>
              <button 
                onClick={loadTracks}
                className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="bg-gray-800/30 border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.totalTracks}</div>
                <div className="text-gray-400">Total Tracks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.tracksFromValueSplits}</div>
                <div className="text-gray-400">V4V Tracks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{stats.tracksFromChapters}</div>
                <div className="text-gray-400">Chapter Tracks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400">{stats.tracksFromDescription}</div>
                <div className="text-gray-400">Description Tracks</div>
              </div>
            </div>
            {lastUpdated && (
              <div className="text-center mt-4">
                <div className="text-xs text-gray-500">
                  Last updated: {lastUpdated}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-900/20 border-b border-blue-500/20">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-300 font-semibold mb-1">About Track Sources</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                <div>
                  <p><span className="text-green-400">Chapters:</span> Music identified from episode chapter markers</p>
                  <p><span className="text-blue-400">Value Split:</span> V4V tracks with remote music references</p>
                </div>
                <div>
                  <p><span className="text-yellow-400">Description:</span> Music found in episode descriptions</p>
                  <p><span className="text-gray-400">External Feed:</span> Music from related podcast feeds</p>
                </div>
              </div>
              <p className="text-gray-400 mt-2 text-xs">
                Some V4V tracks may show generic titles if the referenced feeds are not in our database. 
                These tracks reference external music that was played during the episode but the original feed information is not available.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tracks, artists, or episodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg text-sm transition-colors"
            title="Force refresh with V4V artist resolution"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
            Fix Artists
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                >
                  <option value="episode-desc">Episode (Newest First)</option>
                  <option value="episode-asc">Episode (Oldest First)</option>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                  <option value="artist-asc">Artist (A-Z)</option>
                  <option value="artist-desc">Artist (Z-A)</option>
                  <option value="time-asc">Time (Chronological)</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Source</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as FilterSource)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                >
                  <option value="all">All Sources</option>
                  <option value="chapter">Chapters</option>
                  <option value="value-split">Value Split</option>
                  <option value="description">Description</option>
                  <option value="external-feed">External Feed</option>
                </select>
              </div>

              {/* Episode Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Episode</label>
                <select
                  value={filterEpisode}
                  onChange={(e) => setFilterEpisode(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                >
                  <option value="all">All Episodes</option>
                  {uniqueEpisodes.map(episode => (
                    <option key={episode} value={episode}>{episode}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Track List Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Music Tracks</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{filteredTracks.length} of {tracks.length} tracks</span>
            {cacheStatus && (
              <span className={`px-2 py-1 rounded text-xs ${
                cacheStatus === 'cached' 
                  ? 'bg-green-900/30 text-green-400' 
                  : 'bg-blue-900/30 text-blue-400'
              }`}>
                {cacheStatus === 'cached' ? '📦 Cached' : '🔄 Fresh'}
              </span>
            )}
            {(searchQuery || filterSource !== 'all' || filterEpisode !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-green-400 hover:text-green-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="space-y-2">
          {filteredTracks.map((track) => (
            <div
              key={track.id}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                currentTrack === track.id
                  ? 'bg-green-600/20 border border-green-500/50'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              <button 
                className="flex-shrink-0 w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors"
                onClick={() => playTrack(track)}
                disabled={audioLoading === track.id}
              >
                {audioLoading === track.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentTrack === track.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedTrack(track)}>
                <div className="font-medium truncate">
                  {track.title === 'External Music Track' || track.title.includes('External Music Track') 
                    ? `Music Track (${track.source})` 
                    : getDisplayTitle(track)}
                </div>
                <div className="text-sm text-gray-400 truncate">
                  {getDisplayArtist(track)} • {track.episodeTitle}
                  {track.source === 'value-split' && track.feedGuid && (
                    <span className="text-xs text-blue-400 ml-2">• V4V Reference</span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 text-sm text-gray-400">
                {track.duration ? formatDuration(track.duration) : '--:--'}
              </div>

              {track.source && (
                <div className="flex-shrink-0">
                  <span className={`px-2 py-1 rounded text-xs ${
                    track.source === 'value-split' ? 'bg-blue-600/20 text-blue-400' :
                    track.source === 'chapter' ? 'bg-green-600/20 text-green-400' :
                    track.source === 'description' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>
                    {track.source}
                    {track.source === 'value-split' && track.title.includes('External Music Track') && (
                      <span className="ml-1 text-yellow-400">⚠️</span>
                    )}
                  </span>
                </div>
              )}

              <button
                onClick={() => setSelectedTrack(track)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-white"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {filteredTracks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-4" />
            <p>
              {tracks.length === 0 ? 'No music tracks found' : 'No tracks match your filters'}
            </p>
            {tracks.length > 0 && (
              <button
                onClick={resetFilters}
                className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Track Details Modal */}
      {selectedTrack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Track Details</h3>
              <button
                onClick={() => setSelectedTrack(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">Title</label>
                <p className="font-medium">{selectedTrack.title}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Artist</label>
                <p className="font-medium">{getDisplayArtist(selectedTrack)}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Episode</label>
                <p className="font-medium">{selectedTrack.episodeTitle}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Source</label>
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedTrack.source === 'value-split' ? 'bg-blue-600/20 text-blue-400' :
                  selectedTrack.source === 'chapter' ? 'bg-green-600/20 text-green-400' :
                  selectedTrack.source === 'description' ? 'bg-yellow-600/20 text-yellow-400' :
                  'bg-gray-600/20 text-gray-400'
                }`}>
                  {selectedTrack.source}
                </span>
              </div>
              
              {selectedTrack.feedGuid && selectedTrack.itemGuid && (
                <div>
                  <label className="text-sm text-gray-400">V4V Reference</label>
                  <p className="text-xs text-gray-500 break-all">
                    Feed: {selectedTrack.feedGuid}<br/>
                    Item: {selectedTrack.itemGuid}
                  </p>
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ This track references a feed not currently in our database. 
                    The actual track title and artist information may not be available.
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    📻 This was external music played during the episode at {formatTime(selectedTrack.startTime)} - {formatTime(selectedTrack.endTime)}.
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    playTrack(selectedTrack);
                    setSelectedTrack(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  {currentTrack === selectedTrack.id ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 