'use client';

import { useState, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';
import { Play, Pause, Music, ExternalLink, Download } from 'lucide-react';

interface ITDVTrack {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  duration: number;
  audioUrl?: string;
  startTime?: number;
  endTime?: number;
  valueForValue?: {
    feedGuid?: string;
    itemGuid?: string;
    resolved?: boolean;
    resolvedTitle?: string;
    resolvedArtist?: string;
    resolvedImage?: string;
    resolvedAudioUrl?: string;
  };
}

export default function ITDVPlaylistAlbum() {
  const [tracks, setTracks] = useState<ITDVTrack[]>([]);
  const [totalTracks, setTotalTracks] = useState(122);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { playTrack, isPlaying, pause, resume, playAlbum } = useAudio();
  const { shouldPreventClick } = useScrollDetectionContext();

  useEffect(() => {
    setIsClient(true);
    loadITDVTracks();
  }, []);

  const loadITDVTracks = async () => {
    try {
      console.log('🔄 Loading Into The Doerfel-Verse tracks...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // First, try to load from the ITDV RSS playlist API
      let response;
      let dataSource = '';
      
      try {
        // Load from the ITDV RSS playlist endpoint
        response = await fetch('/api/playlist/itdv-rss', { signal: controller.signal });
        dataSource = 'ITDV RSS Playlist';
        
        if (response.ok) {
          console.log('✅ Successfully loaded ITDV RSS playlist');
          const xmlText = await response.text();
          
          // Parse the XML to extract remoteItem references
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const items = xmlDoc.querySelectorAll('item');
          
          console.log(`📊 Found ${items.length} items in ITDV RSS playlist`);
          
          const remoteItemTracks = Array.from(items).map((item, index) => {
            const title = item.querySelector('title')?.textContent || `Music Track ${index + 1}`;
            const guid = item.querySelector('guid')?.textContent || `track-${index}`;
            const remoteItem = item.querySelector('remoteItem, [feedguid]');
            
            const feedGuid = remoteItem?.getAttribute('feedGuid') || remoteItem?.getAttribute('feedguid') || undefined;
            const itemGuid = remoteItem?.getAttribute('itemGuid') || remoteItem?.getAttribute('itemguid') || undefined;
            
            return {
              id: guid,
              title: title,
              artist: 'Unknown Artist', // Will be resolved via V4V if available
              episodeTitle: 'Into The Doerfel-Verse',
              duration: 180, // Default 3 minutes
              audioUrl: '', // Will be resolved via V4V
              valueForValue: {
                feedGuid: feedGuid,
                itemGuid: itemGuid,
                resolved: false
              }
            };
          });
          
          console.log('📊 Extracted remoteItem tracks:', remoteItemTracks.length);
          setTotalTracks(remoteItemTracks.length);
          setTracks(remoteItemTracks);
          clearTimeout(timeoutId);
          return;
        }
      } catch (error) {
        console.log('ITDV RSS playlist failed, trying database API...', error);
      }

      // Fallback to database API
      try {
        response = await fetch('/api/music-tracks/database?pageSize=1000', { signal: controller.signal });
        dataSource = 'Database API';
        
        if (!response.ok) {
          throw new Error(`Database API failed: ${response.status}`);
        }
        
        const data = await response.json();
        const allTracks = data.data?.tracks || [];
        
        console.log('📊 Database API tracks fetched:', allTracks.length);
        
        // Filter for ITDV tracks
        const itdvTracks = allTracks.filter((track: any) => {
          const hasITDVInFeed = track.feedUrl?.toLowerCase().includes('intothedoerfelverse') || 
                              track.feedUrl?.toLowerCase().includes('doerfelverse');
          const hasITDVInSource = track.playlistInfo?.source?.toLowerCase().includes('itdv') ||
                                track.playlistInfo?.source === 'ITDV RSS Playlist' ||
                                track.source === 'rss-playlist';
          const hasITDVInArtist = track.artist?.toLowerCase().includes('doerfel');
          
          return hasITDVInFeed || hasITDVInSource || hasITDVInArtist;
        });
        
        console.log('📊 ITDV tracks found:', itdvTracks.length);
        setTotalTracks(itdvTracks.length || 122);
        setTracks(itdvTracks);
        
      } catch (error) {
        console.log('Database API failed, trying static file...', error);
        // Final fallback to static file
        response = await fetch('/music-tracks.json', { signal: controller.signal });
        dataSource = 'Static file (fallback)';
        
        if (!response.ok) {
          throw new Error(`All data sources failed`);
        }
        
        const data = await response.json();
        const allTracks = data.musicTracks || [];
        setTotalTracks(allTracks.length || 122);
        setTracks(allTracks);
      }
      
      clearTimeout(timeoutId);
      console.log('📊 Data source:', dataSource);
    } catch (error) {
      console.error('❌ Error loading ITDV tracks:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timed out');
      }
      setTotalTracks(0);
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTrack = async (track: ITDVTrack, index: number) => {
    // Prevent accidental clicks while scrolling
    if (shouldPreventClick()) {
      console.log('🚫 Prevented accidental click while scrolling');
      return;
    }

    // If this is the current track and it's playing, pause it
    if (currentTrackIndex === index && isPlaying) {
      pause();
      return;
    }
    
    // If this is the current track and it's paused, resume it
    if (currentTrackIndex === index && !isPlaying) {
      resume();
      return;
    }
    
    // Otherwise, play this track and set up the playlist
    setCurrentTrackIndex(index);
    
    // Create album object for the audio context
    const playlistAlbum = {
      title: 'Into The Doerfel-Verse Playlist',
      artist: 'Into The Doerfel-Verse',
      description: 'Music playlist from Into The Doerfel-Verse podcast',
      coverArt: "https://www.doerfelverse.com/art/itdvchadf.png",
      releaseDate: new Date().toISOString(),
      tracks: tracks.map(t => ({
        title: t.valueForValue?.resolved && t.valueForValue?.resolvedTitle ? t.valueForValue.resolvedTitle : t.title,
        url: t.valueForValue?.resolved && t.valueForValue?.resolvedAudioUrl ? t.valueForValue.resolvedAudioUrl : t.audioUrl || '',
        startTime: t.valueForValue?.resolved ? 0 : (t.startTime || 0), // No startTime for resolved V4V tracks
        duration: t.duration ? t.duration.toString() : '300'
      }))
    };
    
    // Play the album starting from the selected track
    await playAlbum(playlistAlbum, index);
  };

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading Into The Doerfel-Verse Playlist...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="text-sm text-gray-400">Loading Into The Doerfel-Verse tracks...</div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <div className="w-12 h-12 bg-gray-700 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-lg text-gray-300">⚠️ No Into The Doerfel-Verse tracks found</div>
        <div className="text-sm text-gray-400">
          The ITDV playlist tracks may be loading or temporarily unavailable.
        </div>
        <div className="text-xs text-gray-500">
          Check the browser console for more details or try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-400 mb-3">
        Showing {tracks.length} of {totalTracks} tracks
      </div>
      {tracks.filter(track => track && track.id && track.title).map((track, index) => {
        const isCurrentTrack = currentTrackIndex === index;
        const displayTitle = track.valueForValue?.resolved && track.valueForValue?.resolvedTitle
          ? track.valueForValue.resolvedTitle
          : track.title;
        const displayArtist = track.valueForValue?.resolved && track.valueForValue?.resolvedArtist
          ? track.valueForValue.resolvedArtist
          : track.artist;
        const displayImage = track.valueForValue?.resolved && track.valueForValue?.resolvedImage
          ? track.valueForValue.resolvedImage
          : "https://www.doerfelverse.com/art/itdvchadf.png";
        
        // Check if this is a generic track that needs V4V resolution
        const isGenericTrack = track.title.startsWith('Music Track ') && track.valueForValue?.feedGuid;
        const needsResolution = isGenericTrack && !track.valueForValue?.resolved;
        
        return (
          <div 
            key={track.id} 
            className={`flex items-center justify-between p-4 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
              isCurrentTrack ? 'bg-white/20' : ''
            } ${needsResolution ? 'border-l-2 border-yellow-500/50' : ''}`}
            onClick={() => handlePlayTrack(track, index)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded">
                <img 
                  src={displayImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {/* V4V Resolution Status Indicator */}
                {needsResolution && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-500 rounded-full border border-gray-800"></div>
                )}
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <button 
                    className="bg-cyan-400/20 backdrop-blur-sm text-white rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg border border-cyan-400/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track, index);
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-sm md:text-base text-white">{displayTitle}</p>
                  {needsResolution && (
                    <span className="flex-shrink-0 text-xs bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30">
                      V4V
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || 'Into The Doerfel-Verse'}
                  {track.valueForValue?.feedGuid && (
                    <span className="ml-1 text-gray-500">
                      • ID: {track.valueForValue.feedGuid.substring(0, 8)}...
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <span className="text-xs md:text-sm text-gray-400">
                {formatDuration(track.duration)}
              </span>
            </div>
          </div>
        );
      })}
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <p className="text-sm text-gray-400">
            Tracks marked with <span className="text-yellow-300 bg-yellow-500/20 px-1 py-0.5 rounded text-xs border border-yellow-500/30">V4V</span> use Value for Value remote references that link to the original music feeds.
          </p>
        </div>
        <p className="text-sm text-gray-400">
          Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Doerfel-Verse →
          </a>
        </p>
      </div>
    </div>
  );
}