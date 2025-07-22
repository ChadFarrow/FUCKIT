'use client';

import { Podcast } from '@/types/podcast';
import { Play, Users, Calendar, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface PodcastCardProps {
  podcast: Podcast;
}

export default function PodcastCard({ podcast }: PodcastCardProps) {
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

  const getCategory = () => {
    if (podcast.categories && Object.keys(podcast.categories).length > 0) {
      return Object.values(podcast.categories)[0];
    }
    return 'General';
  };

  return (
    <div className="podcast-card group">
      <div className="relative">
        <img
          src={podcast.image || podcast.artwork || '/placeholder-podcast.jpg'}
          alt={podcast.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-podcast.jpg';
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 rounded-full p-3 hover:bg-opacity-100">
            <Play className="h-6 w-6 text-gray-800 ml-1" />
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {podcast.title}
          </h3>
          <Link
            href={podcast.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0 ml-2"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {podcast.description}
        </p>
        
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <Users className="h-4 w-4 mr-1" />
          <span>{podcast.author || podcast.ownerName || 'Unknown'}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span className="bg-gray-100 px-2 py-1 rounded-full">
            {getCategory()}
          </span>
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            <span>{formatDate(podcast.lastUpdateTime)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {podcast.episodeCount} episodes
          </span>
          <Link
            href={`/podcast/${podcast.id}`}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View Episodes →
          </Link>
        </div>
      </div>
    </div>
  );
} 