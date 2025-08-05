'use client';

import { useState, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
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

  useEffect(() => {
    setIsClient(true);
    loadITDVTracks();
  }, []);

  const loadITDVTracks = async () => {
    try {
      console.log('🔄 Loading Into The Doerfel-Verse tracks...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Try different data sources to find ITDV tracks
      let response;
      let isApiData = true;
      let dataSource = '';
      
      // Try the main API without filters first
      try {
        response = await fetch('/api/music-tracks/database?pageSize=1000', { signal: controller.signal });
        dataSource = 'API (no filter)';
        
        if (!response.ok || (await response.clone().json()).data?.tracks?.length === 0) {
          // Try with different source filter
          response = await fetch('/api/music-tracks/database?pageSize=1000&source=rss-playlist', { signal: controller.signal });
          dataSource = 'API (source filter)';
          
          if (!response.ok || (await response.clone().json()).data?.tracks?.length === 0) {
            // Fall back to static file
            console.log('API endpoints returned no data, trying static file...');
            response = await fetch('/music-tracks.json', { signal: controller.signal });
            dataSource = 'Static file';
            isApiData = false;
          }
        }
      } catch (error) {
        console.log('API failed, trying static data...', error);
        response = await fetch('/music-tracks.json', { signal: controller.signal });
        dataSource = 'Static file (fallback)';
        isApiData = false;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to load tracks: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const allTracks = isApiData ? (data.data?.tracks || []) : (data.musicTracks || []);
      
      console.log('📊 Data source:', dataSource);
      console.log('📊 Total tracks fetched:', allTracks.length);
      
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
      console.log('🎵 First few ITDV tracks:', itdvTracks.slice(0, 3));
      
      if (itdvTracks.length === 0) {
        console.warn('⚠️ No ITDV tracks found. Showing sample of all tracks:');
        console.log('Sample tracks:', allTracks.slice(0, 5).map((t: any) => ({
          id: t.id,
          title: t.title, 
          artist: t.artist,
          feedUrl: t.feedUrl,
          source: t.playlistInfo?.source || t.source
        })));
      }
      
      setTotalTracks(itdvTracks.length || 122);
      setTracks(itdvTracks);
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
        
        return (
          <div 
            key={track.id} 
            className={`flex items-center justify-between p-4 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
              isCurrentTrack ? 'bg-white/20' : ''
            }`}
            onClick={() => handlePlayTrack(track, index)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded">
                <img 
                  src={displayImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <button 
                    className="bg-white text-black rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg"
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
                <p className="font-medium truncate text-sm md:text-base text-white">{displayTitle}</p>
                <p className="text-xs md:text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || 'Into The Doerfel-Verse'}
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
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          Into The Doerfel-Verse playlist with Value for Value support. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1">
            Visit Doerfel-Verse
          </a>
        </p>
      </div>
    </div>
  );
}