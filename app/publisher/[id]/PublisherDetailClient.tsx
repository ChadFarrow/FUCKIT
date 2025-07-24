'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play } from 'lucide-react';
import { RSSParser, RSSAlbum, RSSPublisherItem } from '@/lib/rss-parser';
import { getAlbumArtworkUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, getPublisherInfo } from '@/lib/url-utils';

interface PublisherDetailClientProps {
  publisherId: string;
}

type FilterType = 'all' | 'albums' | 'eps' | 'singles';

export default function PublisherDetailClient({ publisherId }: PublisherDetailClientProps) {
  console.log('🎯 PublisherDetailClient component loaded with publisherId:', publisherId);
  
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [publisherItems, setPublisherItems] = useState<RSSPublisherItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publisherInfo, setPublisherInfo] = useState<{ title?: string; description?: string; artist?: string; coverArt?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [albumsLoading, setAlbumsLoading] = useState(false);

  useEffect(() => {
    console.log('🎯 PublisherDetailClient useEffect triggered');
    
    const loadPublisher = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`🏢 Loading publisher: ${publisherId}`);
        
        // Try to find the feed URL for this publisher
        const publisherInfo = getPublisherInfo(publisherId);
        
        if (!publisherInfo) {
          console.error(`❌ Publisher not found: ${publisherId}`);
          setError('Publisher feed not found');
          return;
        }
        
        const feedUrl = publisherInfo.feedUrl;
        console.log(`🏢 Publisher info found:`, publisherInfo);
        console.log(`🏢 Loading publisher feed: ${feedUrl}`);

        // Load publisher feed info for artist details and image (fast)
        console.log(`🏢 Loading publisher feed info...`);
        
        let publisherFeedInfo = null;
        
        // Special handling for IROH aggregated feed
        if (feedUrl === 'iroh-aggregated') {
          console.log(`🎵 Loading IROH artist info from main feed...`);
          publisherFeedInfo = await RSSParser.parsePublisherFeedInfo('https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a');
        } else {
          publisherFeedInfo = await RSSParser.parsePublisherFeedInfo(feedUrl);
        }
        
        console.log(`🏢 Publisher feed info:`, publisherFeedInfo);
        
        // Set publisher info immediately so page shows content
        if (publisherFeedInfo) {
          setPublisherInfo({
            title: publisherFeedInfo.artist || publisherFeedInfo.title || `Artist: ${publisherId}`,
            description: publisherFeedInfo.description || 'Independent artist and music creator',
            artist: publisherFeedInfo.artist,
            coverArt: publisherFeedInfo.coverArt
          });
        } else {
          // Fallback to basic info for IROH or other artists
          const artistName = publisherId === '8a9c2e54' || publisherId === 'iroh' ? 'IROH' : publisherId;
          setPublisherInfo({
            title: artistName,
            description: 'Independent artist and music creator',
            artist: artistName
          });
        }
        
        // Stop loading state early so page shows content
        setIsLoading(false);
        
        // Load publisher items and albums in background
        setAlbumsLoading(true);
        
        try {
          // Load publisher items (skip for IROH aggregated since it's not a real feed)
          if (feedUrl !== 'iroh-aggregated') {
            console.log(`🏢 Loading publisher items...`);
            const items = await RSSParser.parsePublisherFeed(feedUrl);
            console.log(`🏢 Publisher items:`, items);
            setPublisherItems(items);
          }

          // Load all albums from the publisher feed
          console.log(`🏢 Loading publisher albums...`);
          const allAlbums = await RSSParser.parsePublisherFeedAlbums(feedUrl);
          console.log(`🏢 Publisher albums:`, allAlbums);
          setAlbums(allAlbums);
          
        } catch (albumError) {
          console.error(`❌ Error loading publisher albums:`, albumError);
          // Don't set error here - we still have publisher info
        } finally {
          setAlbumsLoading(false);
        }
        
      } catch (error) {
        console.error(`❌ Error loading publisher:`, error);
        setError(error instanceof Error ? error.message : 'Failed to load publisher');
        setIsLoading(false);
        setAlbumsLoading(false);
      }
    };

    loadPublisher();
  }, [publisherId]);

  // Sort albums: Pin "Stay Awhile" first, then "Bloodshot Lies", then by artist/title
  const sortAlbums = (albums: RSSAlbum[]) => {
    return albums.sort((a, b) => {
      // Check if either album is "Stay Awhile" (case-insensitive)
      const aIsStayAwhile = a.title.toLowerCase().includes('stay awhile');
      const bIsStayAwhile = b.title.toLowerCase().includes('stay awhile');
      
      if (aIsStayAwhile && !bIsStayAwhile) return -1; // a comes first
      if (!aIsStayAwhile && bIsStayAwhile) return 1; // b comes first
      
      // Check if either album is "Bloodshot Lies" (case-insensitive)
      const aIsBloodshot = a.title.toLowerCase().includes('bloodshot lie');
      const bIsBloodshot = b.title.toLowerCase().includes('bloodshot lie');
      
      if (aIsBloodshot && !bIsBloodshot) return -1; // a comes first
      if (!aIsBloodshot && bIsBloodshot) return 1; // b comes first
      
      // For all other albums, sort by artist then title
      const artistCompare = a.artist.toLowerCase().localeCompare(b.artist.toLowerCase());
      if (artistCompare !== 0) return artistCompare;
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });
  };

  // Sort EPs and Singles
  const sortEpsAndSingles = (albums: RSSAlbum[]) => {
    return albums.sort((a, b) => {
      // First sort by type: EPs (2-6 tracks) before Singles (1 track)
      const aIsSingle = a.tracks.length === 1;
      const bIsSingle = b.tracks.length === 1;
      
      if (aIsSingle && !bIsSingle) return 1; // b (EP) comes first
      if (!aIsSingle && bIsSingle) return -1; // a (EP) comes first
      
      // Then sort by artist
      const artistCompare = a.artist.toLowerCase().localeCompare(b.artist.toLowerCase());
      if (artistCompare !== 0) return artistCompare;
      
      // Finally sort by title
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });
  };

  // Separate albums from EPs/singles (6 tracks or less)
  const albumsWithMultipleTracks = sortAlbums(albums.filter(album => album.tracks.length > 6));
  const epsAndSingles = sortEpsAndSingles(albums.filter(album => album.tracks.length <= 6));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading publisher...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Error Loading Publisher</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div className="flex items-center space-x-4">
            {publisherInfo?.coverArt && (
              <div className="w-16 h-16 rounded-lg overflow-hidden">
                <Image 
                  src={getAlbumArtworkUrl(publisherInfo.coverArt, 'medium')} 
                  alt={publisherInfo.title || 'Artist'}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{publisherInfo?.title || publisherId}</h1>
              {publisherInfo?.description && (
                <p className="text-gray-400 mt-2">{publisherInfo.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {albums.length > 0 ? (
          <div>
            {/* Filter Header */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">
                {albumsLoading ? 'Loading Albums...' : `${albums.length} Albums`}
              </h2>
              {activeFilter !== 'all' && (
                <button
                  onClick={() => setActiveFilter('all')}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Show all
                </button>
              )}
            </div>

            {/* Albums Grid */}
            {albumsWithMultipleTracks.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6">Albums</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {albumsWithMultipleTracks.map((album, index) => (
                    <Link 
                      key={index}
                      href={generateAlbumUrl(album.title)}
                      className="bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden group hover:bg-black/30 transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50 block cursor-pointer"
                    >
                      {/* Album Cover */}
                      <div className="relative aspect-square">
                        {album.coverArt ? (
                          <Image 
                            src={getAlbumArtworkUrl(album.coverArt, 'medium')} 
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
                        
                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                          <div className="bg-white/80 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg">
                            <Play className="w-6 h-6" />
                          </div>
                        </div>
                        
                        {/* Track Count Badge */}
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                          {album.tracks.length} tracks
                        </div>
                      </div>
                      
                      {/* Album Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors truncate">
                          {album.title}
                        </h3>
                        <p className="text-gray-400 text-sm mb-2 truncate">{album.artist}</p>
                        
                        {/* Album Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(album.releaseDate).getFullYear()}</span>
                          {album.explicit && (
                            <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                              E
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {/* EPs and Singles Grid */}
            {epsAndSingles.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">EPs and Singles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {epsAndSingles.map((album, index) => (
                    <Link 
                      key={`single-${index}`}
                      href={generateAlbumUrl(album.title)}
                      className="bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden group hover:bg-black/30 transition-all duration-300 border border-gray-700/50 hover:border-gray-600/50 block cursor-pointer"
                    >
                      {/* Album Cover */}
                      <div className="relative aspect-square">
                        {album.coverArt ? (
                          <Image 
                            src={getAlbumArtworkUrl(album.coverArt, 'medium')} 
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
                        
                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                          <div className="bg-white/80 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg">
                            <Play className="w-6 h-6" />
                          </div>
                        </div>
                        
                        {/* Track Count Badge */}
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                          {album.tracks.length} tracks
                        </div>
                      </div>
                      
                      {/* Album Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors truncate">
                          {album.title}
                        </h3>
                        <p className="text-gray-400 text-sm mb-2 truncate">{album.artist}</p>
                        
                        {/* Album Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(album.releaseDate).getFullYear()}</span>
                          {album.explicit && (
                            <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                              E
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
            <p className="text-gray-400">This publisher doesn't have any albums available.</p>
          </div>
        )}
      </div>
    </div>
  );
}