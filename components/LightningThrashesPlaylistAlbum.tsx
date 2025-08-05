'use client';

import { useState, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { Play, Pause, Music, ExternalLink, Download } from 'lucide-react';

interface LightningThrashesTrack {
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

export default function LightningThrashesPlaylistAlbum() {
  const [tracks, setTracks] = useState<LightningThrashesTrack[]>([]);
  const [totalTracks, setTotalTracks] = useState(383);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { playTrack, isPlaying, pause, resume } = useAudio();

  useEffect(() => {
    setIsClient(true);
    loadLightningThrashesTracks();
  }, []);

  const loadLightningThrashesTracks = async () => {
    try {
      console.log('🔄 Loading Lightning Thrashes tracks...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Fetch more tracks to ensure we get Lightning Thrashes tracks
      const response = await fetch('/api/music-tracks/database?source=rss-playlist&pageSize=500', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to load tracks');
      
      const data = await response.json();
      const allTracks = data.data?.tracks || [];
      
      console.log('📊 Total tracks fetched:', allTracks.length);
      
      // Filter for Lightning Thrashes tracks with more specific criteria
      const lightningThrashesTracks = allTracks.filter((track: any) => {
        const hasLightningThrashesInFeed = track.feedUrl?.includes('lightning-thrashes');
        const hasLightningThrashesInSource = track.playlistInfo?.source?.includes('Lightning Thrashes');
        const hasLightningThrashesInArtist = track.artist?.includes('Lightning Thrashes');
        
        return hasLightningThrashesInFeed || hasLightningThrashesInSource || hasLightningThrashesInArtist;
      });
      
      console.log('📊 Lightning Thrashes tracks found:', lightningThrashesTracks.length);
      console.log('First few Lightning Thrashes tracks:', lightningThrashesTracks.slice(0, 3));
      
      setTotalTracks(lightningThrashesTracks.length);
      setTracks(lightningThrashesTracks.slice(0, 50)); // Show first 50 tracks
    } catch (error) {
      console.error('❌ Error loading Lightning Thrashes tracks:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timed out');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTrack = async (track: LightningThrashesTrack, index: number) => {
    setCurrentTrackIndex(index);
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      await playTrack(track.valueForValue.resolvedAudioUrl);
    } else {
      await playTrack(track.audioUrl || '', track.startTime || 0, track.endTime || 300);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading Lightning Thrashes Playlist...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading Lightning Thrashes Playlist...</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">No Lightning Thrashes tracks found. Please try refreshing the page.</div>
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
          : "https://cdn.kolomona.com/podcasts/lightning-thrashes/060/060-Lightning-Thrashes-1000.jpg";
        
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
                  {displayArtist} • {track.episodeTitle || 'Lightning Thrashes'}
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
          Lightning Thrashes playlist with Value for Value support. 
          <a href="https://lightningthrashes.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1">
            Visit Lightning Thrashes
          </a>
        </p>
      </div>
    </div>
  );
} 