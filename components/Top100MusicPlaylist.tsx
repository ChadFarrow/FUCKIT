'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, ExternalLink } from 'lucide-react';

interface Top100Track {
  position: number;
  title: string;
  artist: string;
  artwork: string;
  podcastLink: string;
  sats: string;
}

export default function Top100MusicPlaylist() {
  const [tracks, setTracks] = useState<Top100Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTop100Tracks();
  }, []);

  const loadTop100Tracks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For now, we'll create sample data since we need to proxy the HTML data
      // In the future, this could fetch from an API that parses the GitHub data
      const sampleTracks: Top100Track[] = [
        {
          position: 1,
          title: "Sample Track 1",
          artist: "Sample Artist 1",
          artwork: "https://via.placeholder.com/150x150?text=1",
          podcastLink: "#",
          sats: "1,234,567"
        },
        {
          position: 2,
          title: "Sample Track 2", 
          artist: "Sample Artist 2",
          artwork: "https://via.placeholder.com/150x150?text=2",
          podcastLink: "#",
          sats: "987,654"
        },
        {
          position: 3,
          title: "Sample Track 3",
          artist: "Sample Artist 3", 
          artwork: "https://via.placeholder.com/150x150?text=3",
          podcastLink: "#",
          sats: "654,321"
        }
        // Add more sample data as needed...
      ];

      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTracks(sampleTracks);
      
    } catch (err) {
      console.error('Error loading Top 100 tracks:', err);
      setError('Failed to load Top 100 music tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSats = (sats: string) => {
    return `${sats} sats`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-500 mb-4">Loading Top 100 music tracks...</div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg animate-pulse">
            <div className="w-8 h-8 bg-gray-300 rounded text-center flex items-center justify-center">
              <span className="text-sm font-bold text-gray-500">{i + 1}</span>
            </div>
            <div className="w-12 h-12 bg-gray-300 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-lg text-red-600">⚠️ Error Loading Top 100</div>
        <div className="text-sm text-gray-600">
          {error}
        </div>
        <button 
          onClick={loadTop100Tracks}
          className="px-4 py-2 bg-stablekraft-teal text-white rounded-lg hover:bg-stablekraft-orange transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-lg text-gray-600">📊 No Top 100 data available</div>
        <div className="text-sm text-gray-500">
          The Top 100 music chart data is currently unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 mb-4">
        Showing top {tracks.length} tracks by sats received
      </div>
      
      {tracks.map((track) => (
        <div 
          key={track.position}
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          {/* Chart Position */}
          <div className="w-8 h-8 bg-stablekraft-teal text-white rounded text-center flex items-center justify-center">
            <span className="text-sm font-bold">{track.position}</span>
          </div>
          
          {/* Track Artwork */}
          <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded">
            <img 
              src={track.artwork}
              alt={track.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://via.placeholder.com/150x150/4ECDC4/FFFFFF?text=${track.position}`;
              }}
            />
          </div>
          
          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm md:text-base text-gray-900 truncate group-hover:text-stablekraft-teal transition-colors">
              {track.title}
            </h3>
            <p className="text-xs md:text-sm text-gray-600 truncate">
              {track.artist}
            </p>
          </div>
          
          {/* Sats Amount */}
          <div className="flex items-center gap-2 text-right">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {formatSats(track.sats)}
              </div>
              <div className="text-xs text-gray-500">
                earned
              </div>
            </div>
          </div>
          
          {/* External Link */}
          <a 
            href={track.podcastLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-stablekraft-teal transition-colors"
            title="View source podcast"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ))}
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Data updated daily from the Podcast Index. 
          <a 
            href="https://github.com/Podcastindex-org/top100_music" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-stablekraft-teal hover:text-stablekraft-orange transition-colors ml-1"
          >
            Learn more about V4V music
          </a>
        </p>
      </div>
    </div>
  );
}