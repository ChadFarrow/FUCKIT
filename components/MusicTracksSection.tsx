'use client';

import { useState, useEffect } from 'react';
import { MusicTrack } from '@/lib/music-track-parser';
import MusicTrackCard from './MusicTrackCard';
import LoadingSpinner from './LoadingSpinner';

interface MusicTracksSectionProps {
  onPlayTrack?: (track: MusicTrack) => void;
}

export default function MusicTracksSection({ onPlayTrack }: MusicTracksSectionProps) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadMusicTracks = async () => {
    if (hasLoaded) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Load tracks from the Doerfel-Verse feed
      const response = await fetch('/api/music-tracks?feedUrl=https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
      
      if (!response.ok) {
        throw new Error('Failed to load music tracks');
      }
      
      const data = await response.json();
      
      if (data.success && data.data.tracks) {
        // Sort tracks by episode date (newest first)
        const sortedTracks = data.data.tracks.sort((a: MusicTrack, b: MusicTrack) => {
          return new Date(b.episodeDate).getTime() - new Date(a.episodeDate).getTime();
        });
        
        setTracks(sortedTracks);
        setHasLoaded(true);
      } else {
        throw new Error('No tracks found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load music tracks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMusicTracks();
  }, []);

  const handlePlayTrack = (track: MusicTrack) => {
    if (onPlayTrack) {
      onPlayTrack(track);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Music Tracks</h2>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-3 text-gray-400">Loading music tracks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Music Tracks</h2>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadMusicTracks}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return null; // Don't show section if no tracks
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Music Tracks</h2>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{tracks.length} tracks</span>
          <span>•</span>
          <span>From RSS feeds</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.slice(0, 12).map((track) => (
          <MusicTrackCard
            key={track.id}
            track={track}
            onPlay={handlePlayTrack}
          />
        ))}
      </div>
      
      {tracks.length > 12 && (
        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            Showing 12 of {tracks.length} tracks
          </p>
          <button
            onClick={() => window.open('/music-track-tester', '_blank')}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View All Tracks
          </button>
        </div>
      )}
    </div>
  );
} 