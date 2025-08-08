'use client';

import React, { useState } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import CDNImage from '@/components/CDNImage';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';

interface QueueManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QueueManager: React.FC<QueueManagerProps> = ({ isOpen, onClose }) => {
  const {
    currentPlayingAlbum,
    currentTrackIndex,
    isShuffleMode,
    playAlbum,
    currentTime,
    duration
  } = useAudio();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (!isOpen || !currentPlayingAlbum) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrackClick = (trackIndex: number) => {
    playAlbum(currentPlayingAlbum, trackIndex);
  };

  const getCurrentProgress = () => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CDNImage 
                src={getAlbumArtworkUrl(currentPlayingAlbum.coverArt || '', 'thumbnail')}
                alt={currentPlayingAlbum.title}
                width={64}
                height={64}
                className="rounded-lg object-cover w-16 h-16"
                fallbackSrc={getPlaceholderImageUrl('thumbnail')}
              />
              <div>
                <h2 className="text-xl font-bold text-white">Playing Queue</h2>
                <p className="text-gray-400">{currentPlayingAlbum.title}</p>
                <p className="text-sm text-gray-500">
                  {currentPlayingAlbum.tracks.length} tracks
                  {isShuffleMode && ' • Shuffle Mode'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="overflow-y-auto max-h-96 p-4">
          <div className="space-y-2">
            {currentPlayingAlbum.tracks.map((track, index) => {
              const isCurrentTrack = index === currentTrackIndex;
              const isCompleted = isCurrentTrack && getCurrentProgress() === 100;
              
              return (
                <div
                  key={index}
                  onClick={() => handleTrackClick(index)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all duration-200 group
                    ${isCurrentTrack 
                      ? 'bg-gradient-to-r from-stablekraft-orange/20 to-stablekraft-yellow/20 border border-stablekraft-orange/30' 
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Track Number / Play Icon */}
                    <div className="w-8 h-8 flex items-center justify-center">
                      {isCurrentTrack ? (
                        <div className="relative">
                          <svg className="w-5 h-5 text-stablekraft-orange animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                          </svg>
                          {/* Progress ring for current track */}
                          <svg className="absolute inset-0 w-5 h-5 -rotate-90" viewBox="0 0 24 24">
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-gray-600"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 10}`}
                              strokeDashoffset={`${2 * Math.PI * 10 * (1 - getCurrentProgress() / 100)}`}
                              className="text-stablekraft-orange transition-all duration-300"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      ) : (
                        <span className={`text-sm ${isCompleted ? 'text-green-400' : 'text-gray-400 group-hover:text-white'}`}>
                          {isCompleted ? '✓' : index + 1}
                        </span>
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium truncate ${
                            isCurrentTrack ? 'text-white' : 'text-gray-200 group-hover:text-white'
                          }`}>
                            {track.title}
                          </p>
                          {track.artist && (
                            <p className="text-sm text-gray-400 truncate">
                              {track.artist}
                            </p>
                          )}
                          {(track.startTime || track.endTime) && (
                            <p className="text-xs text-gray-500">
                              {track.startTime && formatTime(typeof track.startTime === 'string' ? parseFloat(track.startTime) : track.startTime)} 
                              {track.startTime && track.endTime && ' - '}
                              {track.endTime && formatTime(typeof track.endTime === 'string' ? parseFloat(track.endTime) : track.endTime)}
                            </p>
                          )}
                        </div>
                        
                        {/* Duration */}
                        {track.duration && (
                          <div className="text-sm text-gray-400 ml-4">
                            {formatTime(typeof track.duration === 'string' ? parseFloat(track.duration) : track.duration)}
                          </div>
                        )}
                      </div>

                      {/* Progress bar for current track */}
                      {isCurrentTrack && duration > 0 && (
                        <div className="mt-2">
                          <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-stablekraft-orange to-stablekraft-yellow transition-all duration-100"
                              style={{ width: `${getCurrentProgress()}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Track Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isCurrentTrack && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTrackClick(index);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                          title="Play this track"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              {currentPlayingAlbum.tracks.length} tracks • Total duration: {
                formatTime(
                  currentPlayingAlbum.tracks.reduce((total, track) => {
                    const duration = track.duration || 0;
                    return total + (typeof duration === 'string' ? parseFloat(duration) : duration);
                  }, 0)
                )
              }
            </span>
            <span>
              Currently: Track {currentTrackIndex + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueManager;
