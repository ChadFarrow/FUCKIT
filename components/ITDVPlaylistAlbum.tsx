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
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { playTrack, isPlaying, pause, resume } = useAudio();

  useEffect(() => {
    // Set client flag and load tracks
    setIsClient(true);
    loadITDVTracks();
  }, []);

  const loadITDVTracks = async () => {
    try {
      console.log('🔄 Loading ITDV tracks...');
      // Use the main database API now that it's fixed
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/music-tracks/database?source=rss-playlist&pageSize=20', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Failed to load tracks');
      
      const data = await response.json();
      console.log('📊 ITDV tracks loaded:', data.data?.tracks?.length || 0);
      setTracks(data.data?.tracks || []);
    } catch (error) {
      console.error('❌ Error loading ITDV tracks:', error);
      if (error.name === 'AbortError') {
        console.error('Request timed out');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTrack = async (track: ITDVTrack, index: number) => {
    setCurrentTrackIndex(index);
    
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      // Play resolved audio URL
      await playTrack(track.valueForValue.resolvedAudioUrl);
    } else {
      // Play from episode with timestamps
      await playTrack(track.audioUrl || '', track.startTime || 0, track.endTime || 300);
    }
  };

  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      await handlePlayTrack(tracks[0], 0);
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
        <div className="text-white">Loading ITDV Playlist...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading ITDV Playlist...</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">No ITDV tracks found. Please try refreshing the page.</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      {/* Album Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-24 h-24 flex-shrink-0">
          <img
            src="https://www.doerfelverse.com/art/itdvchadf.png"
            alt="Into The Doerfel-Verse"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-2">
            Into The Doerfel-Verse Music Playlist
          </h2>
          <p className="text-gray-300 mb-2">Various Artists</p>
          <p className="text-sm text-gray-400 mb-4">
            Music from Episodes 31-56 • {tracks.length} tracks
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Play All
            </button>
            
            <a
              href="/api/playlist/itdv-rss"
              download="ITDV-playlist.xml"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download RSS
            </a>
            
            <a
              href="/playlist/itdv-rss"
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Details
            </a>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white mb-3">Tracks</h3>
        
        {tracks.filter(track => track && track.id && track.title).map((track, index) => {
          
          const isCurrentTrack = currentTrackIndex === index;
          const displayTitle = track.valueForValue?.resolved && track.valueForValue?.resolvedTitle
            ? track.valueForValue.resolvedTitle 
            : (track.title || 'Unknown Title');
          const displayArtist = track.valueForValue?.resolved && track.valueForValue?.resolvedArtist
            ? track.valueForValue.resolvedArtist 
            : (track.artist || 'Unknown Artist');
          const displayImage = track.valueForValue?.resolved && track.valueForValue?.resolvedImage
            ? track.valueForValue.resolvedImage 
            : "https://www.doerfelverse.com/art/itdvchadf.png";

          return (
            <div
              key={track.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                isCurrentTrack 
                  ? 'bg-purple-900/30 border border-purple-500/30' 
                  : 'hover:bg-gray-700/50'
              }`}
              onClick={() => handlePlayTrack(track, index)}
            >
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
                <h4 className={`font-medium truncate ${
                  isCurrentTrack ? 'text-purple-300' : 'text-white'
                }`}>
                  {displayTitle}
                </h4>
                <p className="text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || 'Unknown Episode'}
                </p>
              </div>

              {/* Duration */}
              <div className="text-sm text-gray-400">
                {formatDuration(track.duration)}
              </div>

              {/* Play/Pause Icon */}
              <div className="w-8 h-8 flex items-center justify-center">
                {isCurrentTrack && isPlaying ? (
                  <Pause className="w-5 h-5 text-purple-400" />
                ) : (
                  <Play className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400 text-center">
          Podcasting 2.0 compliant • Value4Value enabled • 
          <a href="/playlist/itdv-rss" className="text-blue-400 hover:text-blue-300 ml-1">
            View full playlist →
          </a>
        </p>
      </div>
    </div>
  );
} 