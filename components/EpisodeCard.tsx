'use client';

import { Episode } from '@/types/podcast';
import { Play, Clock, Calendar, ExternalLink, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EpisodeCardProps {
  episode: Episode;
}

export default function EpisodeCard({ episode }: EpisodeCardProps) {
  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="episode-card">
      <div className="flex gap-4">
        {/* Episode Image */}
        <div className="flex-shrink-0">
          <img
            src={episode.image || episode.feedImage || '/placeholder-episode.jpg'}
            alt={episode.title}
            className="w-20 h-20 object-cover rounded-lg"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-episode.jpg';
            }}
          />
        </div>
        
        {/* Episode Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 pr-4">
              {episode.title}
            </h3>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {episode.enclosureUrl && (
                <a
                  href={episode.enclosureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary-600 transition-colors"
                  title="Download episode"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
              <a
                href={episode.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary-600 transition-colors"
                title="View episode page"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {episode.description}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                <span>{formatDate(episode.datePublished)}</span>
              </div>
              {episode.duration > 0 && (
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{formatDuration(episode.duration)}</span>
                </div>
              )}
              {episode.enclosureLength > 0 && (
                <span>{formatFileSize(episode.enclosureLength)}</span>
              )}
            </div>
            
            {episode.enclosureUrl && (
              <button className="btn-primary text-xs py-1 px-3">
                <Play className="h-3 w-3 mr-1" />
                Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 