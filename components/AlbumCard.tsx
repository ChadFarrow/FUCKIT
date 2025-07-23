'use client';

import Image from 'next/image';
import Link from 'next/link';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl } from '@/lib/url-utils';

interface AlbumCardProps {
  album: RSSAlbum;
  index: number;
  currentPlayingAlbum: string | null;
  isPlaying: boolean;
  onPlay: (album: RSSAlbum, e: React.MouseEvent) => void;
}

export default function AlbumCard({ 
  album, 
  index, 
  currentPlayingAlbum, 
  isPlaying, 
  onPlay 
}: AlbumCardProps) {
  const isEpOrSingle = album.tracks.length <= 6;
  
  return (
    <Link 
      href={generateAlbumUrl(album.title)}
      className="bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden group hover:bg-black/30 transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50 block cursor-pointer"
    >
      {/* Album Cover */}
      <div className="relative aspect-square">
        <Image 
          src={getAlbumArtworkUrl(album.coverArt || '', 'medium')} 
          alt={album.title}
          width={300}
          height={300}
          className="w-full h-full object-cover"
          loading={index < 8 ? undefined : "lazy"}
          priority={index < 8} // Only prioritize first 8 images
          onError={(e) => {
            // Fallback to placeholder on error
            const target = e.target as HTMLImageElement;
            target.src = getPlaceholderImageUrl('medium');
          }}
        />
        
        {/* Play Button Overlay - Always Visible */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
          <button
            onClick={(e) => onPlay(album, e)}
            className="bg-white/80 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg"
          >
            {currentPlayingAlbum === album.title && isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
        </div>
        
        {/* Track Count Badge */}
        <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full ${
          isEpOrSingle ? 'bg-purple-600/80' : 'bg-black/70'
        }`}>
          {isEpOrSingle ? (
            album.tracks.length === 1 ? 'Single' : `EP - ${album.tracks.length} tracks`
          ) : (
            `${album.tracks.length} tracks`
          )}
        </div>
      </div>
      
      {/* Album Info */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors truncate">
          {album.title}
        </h3>
        <p className="text-gray-400 text-sm mb-2 truncate">{album.artist}</p>
        
        {/* Album Subtitle */}
        {album.subtitle && (
          <p className="text-gray-300 text-xs mb-2 italic truncate">{album.subtitle}</p>
        )}
        
        {/* Album Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{new Date(album.releaseDate).getFullYear()}</span>
          {album.explicit && (
            <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
              E
            </span>
          )}
        </div>
        
        {/* Funding Links */}
        {album.funding && album.funding.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {album.funding.slice(0, 2).map((funding, fundingIndex) => (
              <button
                key={fundingIndex}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(funding.url, '_blank', 'noopener,noreferrer');
                }}
                className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-white px-2 py-1 rounded text-xs transition-all cursor-pointer"
              >
                💝 {funding.message || 'Support'}
              </button>
            ))}
            {album.funding.length > 2 && (
              <span className="text-xs text-gray-500 px-2 py-1">
                +{album.funding.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}