'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAudio } from '@/contexts/AudioContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from '@/components/Toast';
import CDNImage from '@/components/CDNImage';
import { Play, Pause, Search, Music, Info, ExternalLink } from 'lucide-react';

interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  audioUrl: string;
  image?: string;
  source: string;
  addedAt: string;
  feedGuid?: string;
  itemGuid?: string;
  feedTitle?: string;
  publishDate?: string;
}

export default function UpBeatsPlaylistPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { playAlbum, currentPlayingAlbum, isPlaying, pause, resume, currentTrackIndex } = useAudio();
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/data/music-tracks.json');
      const data = await response.json();
      
      // Filter for UpBEATs tracks
      const upbeatsTracks = data.musicTracks.filter((track: any) => 
        track.source && track.source.includes('UpBEATs')
      );
      
      console.log(`Loaded ${upbeatsTracks.length} UpBEATs tracks`);
      setTracks(upbeatsTracks);
    } catch (error) {
      console.error('Error loading tracks:', error);
      toast.error('Failed to load UpBEATs playlist');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = async (track: Track, index: number) => {
    setPlayingTrackId(track.id);
    
    // Create album object for audio player
    const album = {
      id: `upbeats-${track.id}`,
      title: track.album || 'UpBEATs Playlist',
      artist: track.artist,
      description: track.feedTitle || 'Music from UpBEATs podcast',
      coverArt: track.image || '/api/placeholder/300/300',
      releaseDate: track.publishDate || new Date().toISOString(),
      tracks: filteredTracks.map(t => ({
        title: t.title,
        duration: formatDuration(t.duration),
        url: t.audioUrl,
        trackNumber: t.id,
        image: t.image
      }))
    };

    try {
      await playAlbum(album, index);
    } catch (error) {
      console.error('Error playing track:', error);
      toast.error('Failed to play track');
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter tracks based on search query
  const filteredTracks = useMemo(() => {
    if (!searchQuery) return tracks;
    
    const query = searchQuery.toLowerCase();
    return tracks.filter(track =>
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      (track.album && track.album.toLowerCase().includes(query))
    );
  }, [tracks, searchQuery]);

  const handleTogglePlay = (track: Track, index: number) => {
    const isCurrentTrack = currentPlayingAlbum && 
      playingTrackId === track.id &&
      currentPlayingAlbum.tracks[currentTrackIndex]?.url === track.audioUrl;
    
    if (isCurrentTrack) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      handlePlayTrack(track, index);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <LoadingSpinner size="large" text="Loading UpBEATs playlist..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-12" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
                <Image 
                  src="/logo.webp" 
                  alt="VALUE Logo" 
                  width={40} 
                  height={40}
                  className="object-cover"
                  priority
                />
              </div>
              <span className="text-xl font-semibold">Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Playlist Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Music className="w-12 h-12 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">UpBEATs Music Playlist</h1>
              <p className="text-gray-400">Every music reference from UpBEATs podcast</p>
              <p className="text-sm text-gray-500 mt-2">
                {tracks.length} tracks • Curated by ChadF
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p>This playlist contains music tracks referenced in the UpBEATs podcast.</p>
                <p className="mt-2">Tracks are resolved from various music feeds and platforms.</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900/50 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Play All Button */}
          <button
            onClick={() => filteredTracks.length > 0 && handlePlayTrack(filteredTracks[0], 0)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            Play All ({filteredTracks.length} tracks)
          </button>
        </div>

        {/* Track List */}
        <div className="space-y-2 pb-32">
          {filteredTracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No tracks found</p>
            </div>
          ) : (
            filteredTracks.map((track, index) => {
              const isCurrentTrack = currentPlayingAlbum && 
                playingTrackId === track.id &&
                currentPlayingAlbum.tracks[currentTrackIndex]?.url === track.audioUrl;
              
              return (
                <div
                  key={track.id}
                  className={`group flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer ${
                    isCurrentTrack 
                      ? 'bg-purple-900/30 border border-purple-500/30' 
                      : 'bg-gray-900/30 hover:bg-gray-800/50'
                  }`}
                  onClick={() => handleTogglePlay(track, index)}
                >
                  {/* Play/Pause Button */}
                  <button className="w-10 h-10 flex items-center justify-center">
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="w-6 h-6 text-purple-400" />
                    ) : (
                      <Play className="w-6 h-6 text-gray-400 group-hover:text-white" />
                    )}
                  </button>
                  
                  {/* Track Image */}
                  {track.image && (
                    <div className="w-12 h-12 flex-shrink-0">
                      <CDNImage 
                        src={track.image}
                        alt={track.title}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                  )}
                  
                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${isCurrentTrack ? 'text-purple-300' : 'text-white'}`}>
                      {track.title}
                    </h3>
                    <p className="text-sm text-gray-400 truncate">
                      {track.artist} {track.album && `• ${track.album}`}
                    </p>
                  </div>
                  
                  {/* Duration */}
                  <div className="text-sm text-gray-400">
                    {formatDuration(track.duration)}
                  </div>
                  
                  {/* External Link (if available) */}
                  {track.feedGuid && (
                    <a
                      href={`https://podcastindex.org/podcast/${track.feedGuid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-700/50 rounded transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}