'use client';

import { useState } from 'react';
import { MusicTrack } from '@/lib/music-track-parser';
import { formatTime, formatDate } from '@/lib/utils';

interface MusicTrackCardProps {
  track: MusicTrack;
  onPlay?: (track: MusicTrack) => void;
  onViewDetails?: (track: MusicTrack) => void;
}

export default function MusicTrackCard({ track, onPlay, onViewDetails }: MusicTrackCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handlePlay = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) {
      onPlay(track);
    }
  };

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(track);
    }
  };



  const getSourceColor = (source: string) => {
    switch (source) {
      case 'chapter':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'value-split':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'description':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'external-feed':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div
      className="group bg-white/5 backdrop-blur-sm rounded-xl p-4 hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4">
        {/* Track Image */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
          {track.image && !imageError ? (
            <img
              src={track.image}
              alt={track.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          
          {/* Play overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <button
                onClick={handlePlay}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                title="Play track"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">
              {track.title}
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSourceColor(track.source)}`}>
              {track.source}
            </span>
          </div>
          
          <p className="text-gray-400 text-sm mb-1">{track.artist}</p>
          <p className="text-gray-500 text-xs mb-2">From: {track.episodeTitle}</p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{formatDate(track.episodeDate)}</span>
            {track.startTime > 0 && (
              <>
                <span>•</span>
                <span>{formatTime(track.startTime)}</span>
              </>
            )}
            {track.valueForValue && (
              <>
                <span>•</span>
                <span className="text-green-400">⚡ V4V</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 