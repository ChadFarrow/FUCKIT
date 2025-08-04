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

      const response = await fetch('/api/music-tracks/database?source=rss-playlist&pageSize=20', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to load tracks');
      
      const data = await response.json();
      const allTracks = data.data?.tracks || [];
      
      // Filter for Lightning Thrashes tracks
      const lightningThrashesTracks = allTracks.filter((track: any) => 
        track.feedUrl?.includes('lightning-thrashes') || 
        track.playlistInfo?.source?.includes('Lightning Thrashes')
      );
      
      console.log('📊 Lightning Thrashes tracks loaded:', lightningThrashesTracks.length);
      setTracks(lightningThrashesTracks.slice(0, 20)); // Show first 20 tracks
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
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Album Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-20 h-20 flex-shrink-0">
          <img
            src="https://cdn.kolomona.com/podcasts/lightning-thrashes/060/060-Lightning-Thrashes-1000.jpg"
            alt="Lightning Thrashes"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2">Lightning Thrashes Playlist</h3>
          <p className="text-gray-300 mb-2">Episodes 1-60 • 383 tracks</p>
          <p className="text-gray-400 text-sm mb-4">
            Every song played on Lightning Thrashes from episode 1 to episode 60
          </p>
          <div className="flex gap-2">
            <a
              href="/api/playlist/lightning-thrashes-rss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              RSS Feed
            </a>
            <a
              href="/api/playlist/lightning-thrashes-rss"
              download="lightning-thrashes-playlist.xml"
              className="inline-flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-3">
          Showing {tracks.length} of 383 tracks
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
            <div key={track.id} className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${isCurrentTrack ? 'bg-blue-700' : 'hover:bg-gray-700'}`}>
              {/* Track Image */}
              <div className="w-10 h-10 flex-shrink-0">
                <img
                  src={displayImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover rounded"
                />
              </div>
              
              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate">{displayTitle}</h4>
                <p className="text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || 'Unknown Episode'}
                </p>
              </div>
              
              {/* Duration */}
              <div className="text-sm text-gray-400 flex-shrink-0">
                {formatDuration(track.duration)}
              </div>
              
              {/* Play Button */}
              <button
                onClick={() => handlePlayTrack(track, index)}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0"
                title="Play track"
              >
                {isCurrentTrack && isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          Lightning Thrashes playlist with Value for Value support. 
          <a href="https://lightninthrashes.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1">
            Visit Lightning Thrashes
          </a>
        </p>
      </div>
    </div>
  );
} 