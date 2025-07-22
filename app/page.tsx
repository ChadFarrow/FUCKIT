'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlbumsData();
  }, []);

  const loadAlbumsData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Starting to load album data...');
      
      // List of RSS feed URLs - you can add more feeds here
      const feedUrls = [
        'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml'
        // Add more feed URLs here
      ];
      
      console.log('Feed URLs:', feedUrls);
      
      const albumsData = await RSSParser.parseMultipleFeeds(feedUrls);
      
      console.log('Albums data received:', albumsData);
      
      if (albumsData && albumsData.length > 0) {
        setAlbums(albumsData);
        console.log('Successfully set', albumsData.length, 'albums');
      } else {
        console.log('No album data received');
        setError('Failed to load any album data from RSS feeds');
      }
    } catch (err) {
      console.error('Error loading albums:', err);
      setError(`Error loading album data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header 
        className="border-b backdrop-blur-sm bg-black/30"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
              <Image 
                src="/logo.webp" 
                alt="VALUE Logo" 
                width={40} 
                height={40}
                className="object-cover"
              />
            </div>
            <h1 className="text-4xl font-bold">Into the ValueVerse</h1>
          </div>
          <p className="text-gray-400 text-lg mb-4">
            A collection of albums and music from The Doerfels fanbase and beyond.
          </p>
          <div className="flex items-center gap-2 text-sm">
            {isLoading ? (
              <>
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                <span className="text-yellow-400">Loading RSS feed...</span>
              </>
            ) : error ? (
              <>
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span className="text-red-400">{error}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-green-400">{albums.length} album{albums.length !== 1 ? 's' : ''} loaded successfully</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Albums</h2>
            <p className="text-gray-400">{error}</p>
            <button 
              onClick={loadAlbumsData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : albums.length > 0 ? (
          <div className="max-w-7xl mx-auto">
            {/* Albums Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map((album, index) => (
                <div 
                  key={index}
                  className="bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden group hover:bg-black/30 transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50"
                >
                  {/* Album Cover */}
                  <div className="relative aspect-square">
                    {album.coverArt ? (
                      <Image 
                        src={album.coverArt} 
                        alt={album.title}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
                        <span className="text-white text-lg font-bold text-center px-4">
                          {album.title}
                        </span>
                      </div>
                    )}
                    
                    {/* Overlay with Play Button */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                      <a 
                        href={`/album/${encodeURIComponent(album.title)}`}
                        className="bg-white/90 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </a>
                    </div>
                    
                    {/* Track Count Badge */}
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                      {album.tracks.length} tracks
                    </div>
                  </div>
                  
                  {/* Album Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors truncate">
                      <a href={`/album/${encodeURIComponent(album.title)}`}>
                        {album.title}
                      </a>
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
                          <a
                            key={fundingIndex}
                            href={funding.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-white px-2 py-1 rounded text-xs transition-all"
                          >
                            💝 {funding.message || 'Support'}
                          </a>
                        ))}
                        {album.funding.length > 2 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{album.funding.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
            <p className="text-gray-400">Unable to load any album information from the RSS feeds.</p>
          </div>
        )}
      </div>
    </div>
  );
}