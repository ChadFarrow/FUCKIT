'use client';

import { useState } from 'react';
import { MusicTrackRecord } from '@/lib/music-track-schema';
import { formatTime, formatDate } from '@/lib/utils';
import { 
  Play, 
  Zap, 
  Clock, 
  Calendar, 
  Mic, 
  Radio, 
  ExternalLink,
  Copy,
  Check,
  Heart,
  Share2
} from 'lucide-react';

interface V4VMusicTrackCardProps {
  track: MusicTrackRecord;
  onPlay?: (track: MusicTrackRecord) => void;
  onViewDetails?: (track: MusicTrackRecord) => void;
  onFavorite?: (track: MusicTrackRecord) => void;
  onShare?: (track: MusicTrackRecord) => void;
  showV4VBadge?: boolean;
  compact?: boolean;
}

export default function V4VMusicTrackCard({ 
  track, 
  onPlay, 
  onViewDetails, 
  onFavorite,
  onShare,
  showV4VBadge = true,
  compact = false
}: V4VMusicTrackCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

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

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
    if (onFavorite) {
      onFavorite(track);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onShare) {
      onShare(track);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
      case 'v4v-data':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'rss-playlist':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'chapter':
        return <Clock className="w-3 h-3" />;
      case 'value-split':
        return <Zap className="w-3 h-3" />;
      case 'description':
        return <Mic className="w-3 h-3" />;
      case 'external-feed':
        return <Radio className="w-3 h-3" />;
      case 'v4v-data':
        return <Zap className="w-3 h-3" />;
      default:
        return <Radio className="w-3 h-3" />;
    }
  };

  const hasV4VData = track.valueForValue && (
    track.valueForValue.lightningAddress || 
    track.valueForValue.suggestedAmount || 
    track.valueForValue.customKey ||
    track.valueForValue.percentage
  );

  return (
    <div
      className={`group bg-white/5 backdrop-blur-sm rounded-xl border transition-all duration-200 cursor-pointer ${
        hasV4VData 
          ? 'border-green-500/30 hover:border-green-500/50 bg-gradient-to-r from-green-500/5 to-transparent' 
          : 'border-white/10 hover:border-white/20'
      } ${compact ? 'p-3' : 'p-4'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        {/* Track Image */}
        <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-lg overflow-hidden flex-shrink-0 relative`}>
          {track.image && typeof track.image === 'string' && track.image.trim() !== '' && !imageError ? (
            <img
              src={track.image}
              alt={track.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          
          {/* V4V Badge */}
          {showV4VBadge && hasV4VData && (
            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
              ⚡
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
                <Play className="w-3 h-3 text-white fill-current" />
              </button>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className={`font-semibold group-hover:text-blue-400 transition-colors truncate ${
              compact ? 'text-sm' : 'text-lg'
            }`}>
              {track.title || 'Unknown Title'}
            </h3>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${getSourceColor(track.source || 'unknown')}`}>
                {getSourceIcon(track.source || 'unknown')}
                {track.source || 'unknown'}
              </span>
              {isFavorited && (
                <Heart className="w-4 h-4 text-red-400 fill-current" />
              )}
            </div>
          </div>
          
          <p className={`text-gray-400 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>{track.artist || 'Unknown Artist'}</p>
          <p className={`text-gray-500 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>From: {track.episodeTitle || 'Unknown Episode'}</p>
          
          <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {track.episodeDate ? formatDate(track.episodeDate) : 'Unknown Date'}
            </span>
            {track.startTime && track.startTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(track.startTime)}
              </span>
            )}
            {hasV4VData && (
              <span className="flex items-center gap-1 text-green-400">
                <Zap className="w-3 h-3" />
                V4V
              </span>
            )}
          </div>

          {/* V4V Information */}
          {hasV4VData && !compact && (
            <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-green-300">Value for Value</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleFavorite}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Favorite"
                  >
                    <Heart className={`w-3 h-3 ${isFavorited ? 'text-red-400 fill-current' : 'text-gray-400'}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-1 text-xs">
                {track.valueForValue?.lightningAddress && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Lightning:</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopy(track.valueForValue!.lightningAddress!, 'lightning');
                      }}
                      className="flex items-center gap-1 text-green-300 hover:text-green-200 font-mono"
                    >
                      {track.valueForValue.lightningAddress}
                      {copiedField === 'lightning' ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
                
                {track.valueForValue?.suggestedAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Suggested:</span>
                    <span className="text-green-300 font-medium">
                      {track.valueForValue.suggestedAmount} sats
                    </span>
                  </div>
                )}
                
                {track.valueForValue?.customKey && track.valueForValue?.customValue && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{track.valueForValue.customKey}:</span>
                    <span className="text-green-300">{track.valueForValue.customValue}</span>
                  </div>
                )}
                
                {track.valueForValue?.percentage && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Share:</span>
                    <span className="text-green-300">{track.valueForValue.percentage}%</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // TODO: Integrate with Lightning wallet
                  console.log('Send Lightning payment to:', track.valueForValue?.lightningAddress);
                }}
                className="w-full mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3" />
                Send Payment
              </button>
            </div>
          )}

          {/* Tags */}
          {track.tags && track.tags.length > 0 && !compact && (
            <div className="mt-2 flex flex-wrap gap-1">
              {track.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {track.tags.length > 3 && (
                <span className="px-2 py-1 bg-white/10 text-white/50 text-xs rounded-full">
                  +{track.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 