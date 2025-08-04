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

const CACHE_KEY = 'itdv_playlist_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export default function ITDVPlaylistPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
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
    const loadCachedData = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: CachedData = JSON.parse(cached);
          const now = Date.now();
          
          // Check if cache is still valid
          if (now - data.timestamp < CACHE_DURATION) {
            console.log('📦 Loading tracks from cache');
            setTracks(data.tracks);
            setLoading(false);
            setCacheStatus('cached');
            return true; // Cache was used
          } else {
            console.log('⏰ Cache expired, will fetch fresh data');
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
      loadTracks();
    }
  }, []);

  const saveToCache = (tracks: Track[], feedUrl: string) => {
    try {
      const cacheData: CachedData = {
        tracks,
        timestamp: Date.now(),
        feedUrl
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log('💾 Saved tracks to cache');
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  };

  const refreshData = async () => {
    console.log('🔄 Force refreshing data from RSS feed...');
    localStorage.removeItem(CACHE_KEY);
    setLoading(true);
    setError(null);
    setCacheStatus(null);
    
    try {
      // Force fetch from RSS feed and update database with V4V resolution
      const feedUrl = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';
      const encodedFeedUrl = encodeURIComponent(feedUrl);
      const response = await fetch(`/api/music-tracks?feedUrl=${encodedFeedUrl}&forceRefresh=true&saveToDatabase=true&resolveV4V=true&clearV4VCache=true&limit=1000`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.tracks) {
        console.log(`🔄 Refreshed with ${data.data.tracks.length} tracks from RSS feed`);
        
        // Wait a moment for database to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now reload from the updated database with fresh V4V resolution
        await loadMainFeedTracks();
      } else {
        throw new Error('Failed to refresh data from RSS feed');
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh data');
      setLoading(false);
    }
  };


  const extractEpisodeNumber = (episodeTitle: string): number => {
    const match = episodeTitle.match(/Episode (\d+)/i);
    return match ? parseInt(match[1], 10) : 999;
  };

  const loadTracks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (viewMode === 'main') {
        await loadMainFeedTracks();
      } else {
        await loadCompleteCatalog();
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tracks');
      setLoading(false);
    }
  };


  const loadMainFeedTracks = async () => {
    console.log('🎵 Loading tracks from persistent storage...');
    
    // Always load from local database with high limit to get all tracks and V4V resolution
    const response = await fetch('/api/music-tracks?feedUrl=local://database&limit=1000&resolveV4V=true');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data.tracks) {
      console.log(`📦 Loaded ${data.data.tracks.length} tracks from persistent storage`);
      
      // Filter tracks for main feed only
      const mainFeedTracks = data.data.tracks.filter((track: any) => 
        track.feedUrl === 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml'
      );
      
      console.log(`📊 Filtered to ${mainFeedTracks.length} tracks from main feed`);
      
      const formattedTracks = mainFeedTracks.map((track: any) => ({
        id: track.id,
        title: track.title || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
        episodeTitle: track.episodeTitle || 'Unknown Episode',
        audioUrl: track.audioUrl,
        startTime: track.startTime || 0,
        endTime: track.endTime || (track.startTime + (track.duration || 0)),
        duration: track.duration || 0,
        image: track.image,
        feedGuid: track.feedGuid,
        itemGuid: track.itemGuid,
        resolved: track.artist !== 'Unknown Artist' && !track.title.includes('Featured Track'),
        loading: false,
        source: track.source || 'unknown',
        valueForValue: track.valueForValue // Add the missing V4V data!
      }));

      // Sort by episode (newest first) then by start time
      const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
        const episodeA = extractEpisodeNumber(a.episodeTitle);
        const episodeB = extractEpisodeNumber(b.episodeTitle);
        
        if (episodeA !== episodeB) {
          return episodeB - episodeA;
        }
        
        return a.startTime - b.startTime;
      });

      setTracks(sortedTracks);
      setStats({
        totalTracks: sortedTracks.length,
        uniqueArtists: Array.from(new Set(sortedTracks.map((t: Track) => t.artist))).length,
        feeds: 1,
        unresolvedV4V: sortedTracks.filter((t: Track) => t.source === 'value-split' && t.title.includes('External Music Track')).length,
        lastUpdated: data.data.metadata?.lastUpdated || new Date().toISOString()
      });
      
      // Set the last updated timestamp
      if (data.data.metadata?.lastUpdated) {
        setLastUpdated(data.data.metadata.lastUpdated);
      }
      
      // Save to local cache for faster subsequent loads
      saveToCache(sortedTracks, 'local://database');
      
      setLoading(false);
      setCacheStatus('fresh');
    } else {
      throw new Error('No tracks found in persistent storage');
    }
  };

  const loadCompleteCatalog = async () => {
    console.log('🎵 Loading complete catalog...');
    const feeds = [
      'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml'
    ];

    const allTracks: Track[] = [];
    let totalTracks = 0;

    for (const feedUrl of feeds) {
      try {
        console.log(`📡 Loading from: ${feedUrl}`);
        const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(feedUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.tracks) {
            const feedTracks = data.data.tracks.map((track: any) => ({
              id: track.id,
              title: track.title,
              artist: track.artist || 'Unknown Artist',
              episodeTitle: track.episodeTitle || 'Unknown Episode',
              audioUrl: track.audioUrl,
              startTime: track.startTime || 0,
              endTime: track.endTime || (track.startTime + (track.duration || 0)),
              duration: track.duration,
              image: track.image,
              feedGuid: track.valueForValue?.feedGuid,
              itemGuid: track.valueForValue?.itemGuid,
              resolved: track.artist !== 'Unknown Artist',
              loading: false,
              source: track.source || 'unknown',
              valueForValue: track.valueForValue // Add the missing V4V data!
            }));
            allTracks.push(...feedTracks);
            totalTracks += feedTracks.length;
            console.log(`✅ Loaded ${feedTracks.length} tracks from ${feedUrl}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to load tracks from ${feedUrl}:`, error);
      }
    }

    const sortedTracks = allTracks.sort((a: Track, b: Track) => {
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.title.localeCompare(b.title);
    });

    setTracks(sortedTracks);
    setStats({
      totalTracks,
      uniqueArtists: Array.from(new Set(sortedTracks.map((t: Track) => t.artist))).length,
      feeds: feeds.length,
      unresolvedV4V: sortedTracks.filter(t => t.source === 'value-split' && t.title.includes('External Music Track')).length
    });
    setLoading(false);
  };

  // Filter and sort tracks
  const filteredAndSortedTracks = tracks.filter(track => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.episodeTitle.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Source filter
    if (filterSource !== 'all' && track.source !== filterSource) {
      return false;
    }

    // Episode filter
    if (filterEpisode !== 'all' && track.episodeTitle !== filterEpisode) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'episode-desc':
        const episodeA = extractEpisodeNumber(a.episodeTitle);
        const episodeB = extractEpisodeNumber(b.episodeTitle);
        if (episodeA !== episodeB) return episodeB - episodeA;
        return a.startTime - b.startTime;
      case 'episode-asc':
        const episodeA2 = extractEpisodeNumber(a.episodeTitle);
        const episodeB2 = extractEpisodeNumber(b.episodeTitle);
        if (episodeA2 !== episodeB2) return episodeA2 - episodeB2;
        return a.startTime - b.startTime;
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'artist-asc':
        return a.artist.localeCompare(b.artist);
      case 'artist-desc':
        return b.artist.localeCompare(a.artist);
      case 'time-asc':
        return a.startTime - b.startTime;
      default:
        return 0;
    }
  });

  // Helper function to get the correct audio URL
  const getAudioUrl = (track: Track): string => {
    // Use resolved audio URL if available and track is resolved
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      return track.valueForValue.resolvedAudioUrl;
    }
    // Fallback to original audio URL
    return track.audioUrl;
  };

  // Helper function to get display title
  const getDisplayTitle = (track: Track): string => {
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedTitle) {
      return track.valueForValue.resolvedTitle;
    }
    return track.title;
  };

  // Helper function to get display artist
  const getDisplayArtist = (track: Track): string => {
    // Check for resolved artist first (V4V resolution)
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedArtist) {
      return track.valueForValue.resolvedArtist;
    }
    
    // Fallback to original artist
    return track.artist;
  };

  const playTrack = async (track: Track, addToQueue = false) => {
    console.log('🎵 playTrack called for:', track.title);
    console.log('🎵 Track data:', { 
      id: track.id, 
      audioUrl: track.audioUrl,
      hasValueForValue: !!track.valueForValue,
      resolved: track.valueForValue?.resolved 
    });
    console.log('🎵 Full track object:', track);
    
    if (currentTrack === track.id) {
      console.log('🎵 Stopping current track');
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setCurrentTrack(null);
      setAudio(null);
      setAudioLoading(null);
      return;
    }

    if (addToQueue) {
      // Add to queue instead of playing immediately
      const newQueue = [...playQueue];
      if (!newQueue.includes(track.id)) {
        newQueue.push(track.id);
        setPlayQueue(newQueue);
        localStorage.setItem('itdv_queue', JSON.stringify(newQueue));
      }
      return;
    }

    if (audio) {
      console.log('🎵 Pausing existing audio');
      audio.pause();
    }
    
    console.log('🎵 Setting audio loading state');
    setAudioLoading(track.id);
    
    try {
      console.log('🎵 Getting audio URL...');
      console.log('🎵 getAudioUrl check:', {
        hasValueForValue: !!track.valueForValue,
        resolved: track.valueForValue?.resolved,
        resolvedAudioUrl: track.valueForValue?.resolvedAudioUrl,
        fallbackAudioUrl: track.audioUrl
      });
      const audioUrl = getAudioUrl(track);
      console.log('🎵 Final audio URL:', audioUrl);
      
      console.log('🎵 Creating new Audio element...');
      const newAudio = new Audio(audioUrl);
      console.log('🎵 Audio element created successfully');
      
      // Set up comprehensive error logging
      newAudio.addEventListener('loadstart', () => console.log('🎵 Audio loadstart event'));
      newAudio.addEventListener('loadeddata', () => console.log('🎵 Audio loadeddata event'));
      newAudio.addEventListener('canplay', () => console.log('🎵 Audio canplay event'));
      newAudio.addEventListener('canplaythrough', () => console.log('🎵 Audio canplaythrough event'));
      newAudio.addEventListener('playing', () => console.log('🎵 Audio playing event'));
      newAudio.addEventListener('pause', () => console.log('🎵 Audio pause event'));
      
      newAudio.addEventListener('error', (e) => {
        console.error('🎵 Audio error event:', e);
        console.error('🎵 Audio error details:', {
          code: newAudio.error?.code,
          message: newAudio.error?.message,
          networkState: newAudio.networkState,
          readyState: newAudio.readyState
        });
        setAudioLoading(null);
        alert('Failed to play track. The audio URL might not be accessible.');
      });
      
      // Set up event listeners for queue management
      newAudio.addEventListener('ended', () => {
        handleTrackEnd();
      });
      
      // Only set currentTime for episode audio, not individual resolved tracks
      if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
        console.log('🎵 Using resolved track - starting from beginning (0 seconds)');
        newAudio.currentTime = 0;
      } else {
        console.log('🎵 Using episode audio - setting current time to:', track.startTime);
        newAudio.currentTime = track.startTime;
      }
      
      // Set up timer to stop at endTime (only for episode audio, not individual tracks)
      if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
        console.log('🎵 Individual track - will play until natural end');
        // Let the track play until its natural end (audio 'ended' event will handle it)
      } else {
        const duration = track.endTime - track.startTime;
        console.log('🎵 Episode audio - setting timer for duration:', duration, 'seconds');
        setTimeout(() => {
          if (newAudio && !newAudio.paused) {
            console.log('🎵 Episode segment duration reached, stopping playback');
            newAudio.pause();
            handleTrackEnd();
          }
        }, duration * 1000);
      }
      
      console.log('🎵 Attempting to play audio...');
      try {
        await newAudio.play();
        console.log('🎵 Audio play() succeeded');
        setCurrentTrack(track.id);
        setAudio(newAudio);
      } catch (playError) {
        console.error('🎵 Audio play() failed:', playError);
        setAudioLoading(null);
        alert(`Failed to play track: ${playError instanceof Error ? playError.message : 'Unknown error'}`);
      }
      setAudioLoading(null);
      
      // Update queue index if playing from queue
      const currentIndex = playQueue.indexOf(track.id);
      if (currentIndex !== -1) {
        setQueueIndex(currentIndex);
      }
    } catch (error) {
      console.error('Failed to play track:', error);
      setAudioLoading(null);
      alert('Failed to play track. The audio URL might not be accessible.');
    }
  };

  const handleTrackEnd = () => {
    if (continuousPlay && playQueue.length > 0) {
      playNextInQueue();
    } else {
      // Auto-play next track in the filtered list
      const currentTrackIndex = filteredAndSortedTracks.findIndex(t => t.id === currentTrack);
      if (currentTrackIndex !== -1 && currentTrackIndex < filteredAndSortedTracks.length - 1) {
        const nextTrack = filteredAndSortedTracks[currentTrackIndex + 1];
        console.log('🎵 Auto-playing next track:', nextTrack.title);
        playTrack(nextTrack);
      } else {
        console.log('🎵 Reached end of playlist');
        setCurrentTrack(null);
        setAudio(null);
        setAudioLoading(null);
      }
    }
  };

  const playNextInQueue = () => {
    if (playQueue.length === 0) return;
    
    let nextIndex = queueIndex + 1;
    if (nextIndex >= playQueue.length) {
      nextIndex = 0; // Loop back to start
    }
    
    const nextTrackId = playQueue[nextIndex];
    const nextTrack = tracks.find(t => t.id === nextTrackId);
    
    if (nextTrack) {
      setQueueIndex(nextIndex);
      playTrack(nextTrack);
    }
  };

  const playPreviousInQueue = () => {
    if (playQueue.length === 0) return;
    
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playQueue.length - 1; // Loop to end
    }
    
    const prevTrackId = playQueue[prevIndex];
    const prevTrack = tracks.find(t => t.id === prevTrackId);
    
    if (prevTrack) {
      setQueueIndex(prevIndex);
      playTrack(prevTrack);
    }
  };

  const addAllToQueue = () => {
    const allTrackIds = filteredAndSortedTracks.map(t => t.id);
    setPlayQueue(allTrackIds);
    localStorage.setItem('itdv_queue', JSON.stringify(allTrackIds));
    setContinuousPlay(true);
    
    if (allTrackIds.length > 0) {
      setQueueIndex(0);
      const firstTrack = tracks.find(t => t.id === allTrackIds[0]);
      if (firstTrack) {
        playTrack(firstTrack);
      }
    }
  };

  const clearQueue = () => {
    setPlayQueue([]);
    setQueueIndex(-1);
    setContinuousPlay(false);
    localStorage.removeItem('itdv_queue');
  };

  const removeFromQueue = (trackId: string) => {
    const newQueue = playQueue.filter(id => id !== trackId);
    setPlayQueue(newQueue);
    localStorage.setItem('itdv_queue', JSON.stringify(newQueue));
    
    // Adjust queue index if necessary
    const currentTrackIndex = playQueue.indexOf(trackId);
    if (currentTrackIndex !== -1 && currentTrackIndex <= queueIndex) {
      setQueueIndex(Math.max(0, queueIndex - 1));
    }
  };

  const stopTrack = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTrack(null);
    setAudio(null);
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

  const exportToPodcasting20 = () => {
    const now = new Date().toUTCString();
    const playlistGuid = `itdv-music-playlist-${Date.now()}`;
    
    // Generate XML in Podcasting 2.0 musicL format matching the blank template
    const xml = `<rss xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
    <channel>
        <author>The Doerfels</author>
        <itunes:author>The Doerfels</itunes:author>
        <title>Into The Doerfel-Verse Music Playlist</title>
        <description>Complete music collection from Into The Doerfel-Verse podcast episodes. Features ${filteredAndSortedTracks.length} tracks extracted from podcast episodes using chapter markers, value splits, and episode descriptions.</description>
        <link>https://www.doerfelverse.com</link>
        <language>en</language>
        <pubDate>${now}</pubDate>
        <image>
            <url>https://www.doerfelverse.com/images/podcast-cover.jpg</url>
        </image>
        <podcast:guid>${playlistGuid}</podcast:guid>
        <podcast:medium>musicL</podcast:medium>
        <itunes:image href="https://www.doerfelverse.com/images/podcast-cover.jpg" />
        
     
${generateRemoteItems(filteredAndSortedTracks)}
    </channel>
</rss>`;

    // Create and download the file
    const blob = new Blob([xml], { type: 'application/rss+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itdv-music-playlist.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateRemoteItems = (tracks: Track[]): string => {
    return tracks
      .filter(track => track.feedGuid && track.itemGuid) // Only tracks with V4V references
      .map(track => 
        `        <podcast:remoteItem feedGuid="${track.feedGuid}" itemGuid="${track.itemGuid}" />`
      )
      .join('\n') + '\n' +
      // For tracks without V4V references, we can create pseudo-references
      tracks
        .filter(track => !track.feedGuid || !track.itemGuid)
        .slice(0, 50) // Limit to first 50 non-V4V tracks to keep file manageable
        .map(track => {
          // Generate pseudo-GUIDs for chapter-based tracks
          const pseudoFeedGuid = 'doerfelverse-main-feed-guid';
          const pseudoItemGuid = `episode-${extractEpisodeNumber(track.episodeTitle)}-track-${track.id}`;
          return `        <podcast:remoteItem feedGuid="${pseudoFeedGuid}" itemGuid="${pseudoItemGuid}" />`;
        })
        .join('\n');
  };

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
              <p className="text-xl">
                {viewMode === 'main' ? 'Loading main feed tracks...' : 'Loading complete catalog...'}
              </p>
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
              <h1 className="text-3xl font-bold mb-2">
                {viewMode === 'main' ? 'Into The Doerfel-Verse' : 'Doerfel-Verse Complete Catalog'}
              </h1>
              <p className="text-gray-400 mb-2">
                {viewMode === 'main' 
                  ? 'Music tracks from the main podcast feed' 
                  : 'All music tracks from the Doerfel-Verse ecosystem'
                }
              </p>
              <div className="flex items-center gap-4 text-sm">
                <a 
                  href="/playlist/itdv-music" 
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Music className="w-4 h-4" />
                  V4V Music Library
                </a>
                <span className="text-gray-500">•</span>
                <a 
                  href="/playlist/lightning-thrashes" 
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Lightning Thrashes Playlist
                </a>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">
                  {viewMode === 'main' 
                    ? 'All tracks from episodes' 
                    : 'Complete music catalog across all feeds'
                  }
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select 
                className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'main' | 'complete')}
              >
                <option value="main">Main Feed Only</option>
                <option value="complete">Complete Catalog</option>
              </select>
              <button
                onClick={exportToPodcasting20}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm flex items-center gap-2"
                title="Download Podcasting 2.0 music playlist"
              >
                <ExternalLink className="w-4 h-4" />
                Export Playlist
              </button>
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
                <div className="text-2xl font-bold text-blue-400">{stats.uniqueArtists}</div>
                <div className="text-gray-400">Unique Artists</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{stats.feeds}</div>
                <div className="text-gray-400">Music Feeds</div>
              </div>
              {stats.unresolvedV4V > 0 && (
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{stats.unresolvedV4V}</div>
                  <div className="text-gray-400">Unresolved V4V</div>
                </div>
              )}
            </div>
            {stats.lastUpdated && (
              <div className="text-center mt-4">
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(stats.lastUpdated).toLocaleString()}
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
                For original music tracks with V4V resolution, visit the <a href="/playlist/itdv-music" className="text-blue-400 hover:text-blue-300">V4V Music Library</a>.
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
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
            <span>{filteredAndSortedTracks.length} of {tracks.length} tracks</span>
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
          {filteredAndSortedTracks.map((track) => (
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

        {filteredAndSortedTracks.length === 0 && (
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