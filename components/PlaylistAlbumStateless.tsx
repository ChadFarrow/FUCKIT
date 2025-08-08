'use client';

import { useState } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';
import { Play, Pause } from 'lucide-react';
import type { PlaylistConfig } from './PlaylistAlbum';

interface ProcessedTrack {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  duration: number;
  audioUrl: string;
  artworkUrl: string;
}

interface PlaylistStats {
  total: number;
  withAudio: number;
  withArtwork: number;
  playablePercentage: number;
}

interface PlaylistAlbumStatelessProps {
  tracks: ProcessedTrack[];
  config: PlaylistConfig;
  stats: PlaylistStats;
}

export default function PlaylistAlbumStateless({ tracks, config, stats }: PlaylistAlbumStatelessProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const { isPlaying, pause, resume, playAlbum } = useAudio();
  const { shouldPreventClick } = useScrollDetectionContext();

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayTrack = async (trackIndex: number) => {
    if (shouldPreventClick()) return;
    
    const track = tracks[trackIndex];
    if (!track?.audioUrl) {
      console.warn('No audio URL for track:', track?.title);
      return;
    }

    setCurrentTrackIndex(trackIndex);
    
    // Create RSSAlbum format expected by playAlbum
    const albumForPlayer = {
      title: config.name,
      artist: track.artist,
      description: config.description,
      coverArt: config.coverArt,
      releaseDate: new Date().toISOString(),
      tracks: [{
        title: track.title,
        duration: track.duration?.toString() || '180',
        url: track.audioUrl,
        trackNumber: trackIndex + 1,
        image: track.artworkUrl,
        artist: track.artist
      }]
    };

    await playAlbum(albumForPlayer, 0);
  };

  const handlePlayPause = async (trackIndex: number) => {
    if (shouldPreventClick()) return;
    
    if (currentTrackIndex === trackIndex && isPlaying) {
      pause();
    } else if (currentTrackIndex === trackIndex && !isPlaying) {
      resume();
    } else {
      await handlePlayTrack(trackIndex);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No tracks available in this playlist</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Playlist Summary */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">{config.name}</h3>
          <span className="text-sm text-gray-400">{stats.total} tracks</span>
        </div>
        <p className="text-sm text-gray-300 mb-3">{config.description}</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400 block">Playable</span>
            <span className="text-green-400 font-medium">{stats.withAudio} ({stats.playablePercentage}%)</span>
          </div>
          <div>
            <span className="text-gray-400 block">With Artwork</span>
            <span className="text-blue-400 font-medium">{stats.withArtwork}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Episodes</span>
            <span className="text-white font-medium">31-56</span>
          </div>
          <div>
            <span className="text-gray-400 block">Source</span>
            <span className="text-white font-medium">ITDV Podcast</span>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-1">
        {tracks.map((track, index) => {
          const isCurrentTrack = currentTrackIndex === index;
          const hasAudio = Boolean(track.audioUrl);
          
          return (
            <div 
              key={track.id}
              className={`group flex items-center gap-4 p-3 rounded-lg transition-all duration-200 
                ${isCurrentTrack 
                  ? 'bg-orange-500/20 border border-orange-500/30' 
                  : 'hover:bg-gray-800/50 border border-transparent'
                }
                ${!hasAudio ? 'opacity-60' : ''}
              `}
            >
              {/* Track Number / Play Button */}
              <div className="w-8 h-8 flex items-center justify-center relative">
                {hasAudio ? (
                  <button
                    onClick={() => handlePlayPause(index)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                      ${isCurrentTrack 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 group-hover:scale-110'
                      }`}
                    disabled={shouldPreventClick()}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                ) : (
                  <span className="text-gray-500 text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`font-medium truncate ${isCurrentTrack ? 'text-orange-400' : 'text-white'}`}>
                    {track.title}
                  </h4>
                  {!hasAudio && (
                    <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded flex-shrink-0">
                      No Audio
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="truncate">{track.artist}</span>
                  <span>•</span>
                  <span className="flex-shrink-0">{formatTime(track.duration)}</span>
                </div>
              </div>

              {/* Album Art Thumbnail */}
              {track.artworkUrl && track.artworkUrl !== config.coverArt && (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}