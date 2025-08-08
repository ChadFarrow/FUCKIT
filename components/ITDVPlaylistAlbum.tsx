'use client';

import { useState, useEffect } from 'react';

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
  albumArtwork?: string;
  artwork?: string;
}

// Interface for our resolved song data
interface ResolvedSong {
  feedGuid: string;
  itemGuid: string;
  title: string;
  artist: string;
  feedUrl?: string;
  feedTitle?: string;
  episodeId?: number;
  feedId?: number;
  albumArtwork?: string;
  artwork?: string;
}

export default function ITDVPlaylistAlbum() {
  const [tracks, setTracks] = useState<ITDVTrack[]>([]);
  const [totalTracks, setTotalTracks] = useState(122);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [resolvedSongs, setResolvedSongs] = useState<ResolvedSong[]>([]);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      setIsClient(true);
      loadResolvedSongs();
    }
  }, []);

  useEffect(() => {
    // Only run on client side and when we have data
    if (isClient && (resolvedSongs.length > 0 || isClient)) {
      loadITDVTracks();
    }
  }, [resolvedSongs, isClient]);

  const loadResolvedSongs = async () => {
    try {
      console.log('🔄 Loading resolved ITDV songs...');
      const response = await fetch('/api/itdv-resolved-songs');
      
      if (response.ok) {
        const data = await response.json();
        const songs = Array.isArray(data) ? data : [];
        console.log('✅ Loaded resolved songs:', songs.length);
        setResolvedSongs(songs);
      } else {
        console.log('⚠️ Could not load resolved songs, will use fallback data');
        setResolvedSongs([]);
      }
    } catch (error) {
      console.log('⚠️ Error loading resolved songs:', error);
      setResolvedSongs([]);
    }
  };

  const loadITDVTracks = async () => {
    try {
      console.log('🔄 Loading Into The Doerfel-Verse tracks...');

      // First, try to use our resolved songs data
      if (resolvedSongs.length > 0) {
        console.log('📊 Using resolved songs data');
        const resolvedTracks = resolvedSongs
          .filter(song => song && song.feedGuid && song.itemGuid) // Filter out invalid entries
          .map((song, index) => ({
            id: `resolved-${index + 1}-${song.feedGuid?.substring(0, 8) || 'unknown'}`,
            title: song.title || `Music Track ${index + 1}`,
            artist: song.artist || 'Unknown Artist',
            episodeTitle: song.feedTitle || 'Into The Doerfel-Verse',
            duration: 180, // Default 3 minutes
            audioUrl: song.feedUrl || '', // Use feedUrl if available
            albumArtwork: song.albumArtwork || song.artwork || '',
            valueForValue: {
              feedGuid: song.feedGuid,
              itemGuid: song.itemGuid,
              resolved: true,
              resolvedTitle: song.title,
              resolvedArtist: song.artist,
              resolvedImage: song.albumArtwork || song.artwork || '',
              resolvedAudioUrl: song.feedUrl || ''
            }
          }));
        
        console.log('📊 Created resolved tracks:', resolvedTracks.length);
        setTracks(resolvedTracks);
        setTotalTracks(resolvedTracks.length);
        setIsLoading(false);
        return;
      }

      // If no resolved songs, try to load from RSS feed
      console.log('📊 No resolved songs available, trying fallback data sources');
      
      // Create fallback tracks
      const fallbackTracks = Array.from({ length: 10 }, (_, index) => ({
        id: `fallback-${index + 1}`,
        title: `Music Track ${index + 1}`,
        artist: 'Unknown Artist',
        episodeTitle: 'Into The Doerfel-Verse',
        duration: 180,
        valueForValue: {
          feedGuid: `fallback-guid-${index}`,
          itemGuid: `fallback-item-${index}`,
          resolved: false,
          resolvedTitle: '',
          resolvedArtist: '',
          resolvedImage: '',
          resolvedAudioUrl: ''
        }
      }));

      setTracks(fallbackTracks);
      setTotalTracks(fallbackTracks.length);
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Error loading ITDV tracks:', error);
      setIsLoading(false);
    }
  };

  // Show loading state on server side or while loading
  if (!isClient || isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading Into The Doerfel-Verse Playlist...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {tracks.map((track, index) => (
        <div key={track.id} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
          {/* Album Art */}
          <div className="relative mb-4">
            {track.albumArtwork || track.artwork || track.valueForValue?.resolvedImage ? (
              <div className="w-full aspect-square rounded-lg overflow-hidden">
                <img 
                  src={track.albumArtwork || track.artwork || track.valueForValue?.resolvedImage || ''}
                  alt={`${track.title} by ${track.artist}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Fallback placeholder */}
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center hidden">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🎵</div>
                    <div className="text-xs text-white/80">Album Art</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                {track.valueForValue?.resolved ? (
                  <div className="text-center">
                    <div className="text-4xl mb-2">🎵</div>
                    <div className="text-xs text-white/80">Album Art</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-2">❓</div>
                    <div className="text-xs text-white/80">Unresolved</div>
                  </div>
                )}
              </div>
            )}
            {track.valueForValue?.resolved && (
              <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                V4V
              </div>
            )}
            {(track.albumArtwork || track.artwork || track.valueForValue?.resolvedImage) && (
              <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                ART
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white truncate" title={track.title}>
              {track.title}
            </h3>
            
            <div className="text-sm text-gray-300 space-y-1">
              <p className="truncate" title={track.artist}>
                {track.artist}
              </p>
              <p className="truncate text-gray-400" title={track.episodeTitle}>
                {track.episodeTitle}
              </p>
              <p className="text-xs text-gray-500">
                ID: {track.id.substring(0, 8)}...
              </p>
            </div>

            {/* Duration */}
            <div className="text-sm text-gray-400">
              {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </div>

            {/* Resolution Status */}
            {!track.valueForValue?.resolved && (
              <div className="text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">
                Unresolved Track
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}



