'use client';

import { useState, useEffect, useRef } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';
import { Play, Pause } from 'lucide-react';
import type { PlaylistTrack, PlaylistConfig } from './PlaylistAlbum';

interface PlaylistAlbumProgressiveProps {
  tracks: any[]; // Pre-enriched track data
  config: PlaylistConfig;
  onTrackResolved?: (track: PlaylistTrack) => void;
}

const BATCH_SIZE = 10; // Number of tracks to load per batch
const BATCH_DELAY = 100; // Milliseconds between batches

export default function PlaylistAlbumProgressive({ 
  tracks: rawTracks, 
  config, 
  onTrackResolved 
}: PlaylistAlbumProgressiveProps) {
  const [displayedTracks, setDisplayedTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const { isPlaying, pause, resume, playAlbum } = useAudio();
  const { shouldPreventClick } = useScrollDetectionContext();
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate realistic duration if not provided
  const generateRealisticDuration = (song: any, index: number): number => {
    if (song.duration && song.duration > 0) return song.duration;
    
    const baseDurations = [180, 210, 240, 195, 225, 165, 270, 200];
    const variation = (Math.random() - 0.5) * 60; // ±30 seconds variation
    return Math.max(120, baseDurations[index % baseDurations.length] + variation);
  };

  // Process tracks progressively in batches
  useEffect(() => {
    const processTracksProgressively = async () => {
      console.log(`✅ Starting progressive loading for playlist: ${config.name}`);
      setIsLoading(true);
      setDisplayedTracks([]);
      setLoadingProgress(0);

      // Filter and prepare all tracks first
      const allProcessedTracks = rawTracks
        .filter(song => song && song.feedGuid && song.itemGuid)
        .map((song, index) => ({
          id: `${config.name.toLowerCase().replace(/\s+/g, '-')}-${index + 1}-${song.feedGuid?.substring(0, 8) || 'unknown'}`,
          title: song.title || `Track ${index + 1}`,
          artist: song.artist || 'Unknown Artist',
          episodeTitle: song.feedTitle || config.name,
          duration: song.duration || generateRealisticDuration(song, index),
          audioUrl: song.audioUrl || '',
          artworkUrl: song.artworkUrl || config.coverArt,
          valueForValue: {
            feedGuid: song.feedGuid,
            itemGuid: song.itemGuid,
            resolved: true,
            resolvedTitle: song.title,
            resolvedArtist: song.artist,
            resolvedImage: song.artworkUrl || config.coverArt,
            resolvedAudioUrl: song.audioUrl,
            resolvedDuration: song.duration
          }
        }));

      console.log(`📦 Processing ${allProcessedTracks.length} tracks in batches of ${BATCH_SIZE}`);

      // Load tracks in batches with delays for smooth progressive display
      let batchIndex = 0;
      const loadNextBatch = () => {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, allProcessedTracks.length);
        const batch = allProcessedTracks.slice(startIndex, endIndex);

        if (batch.length > 0) {
          setDisplayedTracks(prev => [...prev, ...batch]);
          setLoadingProgress(Math.min(100, Math.round((endIndex / allProcessedTracks.length) * 100)));
          
          console.log(`✅ Loaded batch ${batchIndex + 1}: tracks ${startIndex + 1}-${endIndex} of ${allProcessedTracks.length}`);
          
          // Call onTrackResolved for each track in the batch
          batch.forEach(track => onTrackResolved?.(track));

          batchIndex++;

          // Schedule next batch if there are more tracks
          if (endIndex < allProcessedTracks.length) {
            batchTimeoutRef.current = setTimeout(loadNextBatch, BATCH_DELAY);
          } else {
            // All tracks loaded
            setIsLoading(false);
            setLoadingProgress(100);
            console.log(`🎉 Progressive loading complete: ${allProcessedTracks.length} tracks loaded`);
          }
        } else {
          setIsLoading(false);
          setLoadingProgress(100);
        }
      };

      // Start loading the first batch
      loadNextBatch();
    };

    processTracksProgressively();

    // Cleanup timeout on unmount
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [rawTracks, config.name, onTrackResolved]);

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayTrack = async (trackIndex: number) => {
    if (shouldPreventClick()) return;
    
    const track = displayedTracks[trackIndex];
    if (!track?.audioUrl) {
      console.warn('No audio URL for track:', track?.title);
      return;
    }

    setCurrentTrackIndex(trackIndex);
    
    // Create album for the audio player
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

  if (displayedTracks.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No tracks available in this playlist</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Loading Progress Bar */}
      {isLoading && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Loading tracks...</span>
            <span className="text-sm text-gray-400">{displayedTracks.length} of {rawTracks.length}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="space-y-1">
        {displayedTracks.map((track, index) => {
          const isCurrentTrack = currentTrackIndex === index;
          const hasAudio = Boolean(track.audioUrl);
          
          return (
            <div 
              key={track.id}
              className={`group flex items-center gap-4 p-3 rounded-lg transition-all duration-200 animate-in fade-in slide-in-from-left-2
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

      {/* Loading indicator for remaining tracks */}
      {isLoading && displayedTracks.length > 0 && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full" />
            Loading more tracks...
          </div>
        </div>
      )}
    </div>
  );
}