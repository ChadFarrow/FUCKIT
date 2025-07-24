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
          
          let albumsData: RSSAlbum[] = [];
          
          // Special handling for IROH aggregated feed
          if (feedUrl === 'iroh-aggregated') {
            console.log(`🎵 Loading IROH aggregated albums from multiple feeds...`);
            const irohFeedUrls = [
              'https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a',
              'https://wavlake.com/feed/music/1c7917cc-357c-4eaf-ab54-1a7cda504976',
              'https://wavlake.com/feed/music/e1f9dfcb-ee9b-4a6d-aee7-189043917fb5',
              'https://wavlake.com/feed/music/d4f791c3-4d0c-4fbd-a543-c136ee78a9de',
              'https://wavlake.com/feed/music/51606506-66f8-4394-b6c6-cc0c1b554375',
              'https://wavlake.com/feed/music/6b7793b8-fd9d-432b-af1a-184cd41aaf9d',
              'https://wavlake.com/feed/music/0bb8c9c7-1c55-4412-a517-572a98318921',
              'https://wavlake.com/feed/music/16e46ed0-b392-4419-a937-a7815f6ca43b',
              'https://wavlake.com/feed/music/2cd1b9ea-9ef3-4a54-aa25-55295689f442',
              'https://wavlake.com/feed/music/33eeda7e-8591-4ff5-83f8-f36a879b0a09',
              'https://wavlake.com/feed/music/32a79df8-ec3e-4a14-bfcb-7a074e1974b9',
              'https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1',
              'https://wavlake.com/feed/music/997060e3-9dc1-4cd8-b3c1-3ae06d54bb03',
              'https://wavlake.com/feed/music/b54b9a19-b6ed-46c1-806c-7e82f7550edc'
            ];
            
            // Load albums from all IROH feeds
            albumsData = await RSSParser.parseMultipleFeeds(irohFeedUrls);
            console.log(`🎵 IROH aggregated albums loaded:`, albumsData.length, 'albums');
          } else {
            // Normal publisher feed loading
            albumsData = await RSSParser.parsePublisherFeedAlbums(feedUrl);
            console.log(`🏢 Publisher albums loaded:`, albumsData.length, 'albums');
          }
          
          setAlbums(albumsData);
        } catch (albumError) {
          console.error('❌ Error loading albums:', albumError);
          // Don't show error to user, just show empty album list
        } finally {
          setAlbumsLoading(false);
        }

        console.log(`✅ Publisher loaded successfully: ${publisherId}`);

      } catch (err) {
        console.error('❌ Error loading publisher:', err);
        setError('Error loading publisher data');
        setIsLoading(false);
      }
    };

    loadPublisher();
  }, [publisherId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold">Loading Publisher...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{error}</h1>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              ← Back to Albums
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white relative"
      style={{
        background: publisherInfo?.coverArt 
          ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('${publisherInfo.coverArt}') center/cover fixed`
          : 'linear-gradient(to br, rgb(17, 24, 39), rgb(31, 41, 55), rgb(17, 24, 39))'
      }}
    >
      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Albums
        </Link>

        {/* Artist Header */}
        <div className="mb-12">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 border border-gray-700/50">
            <h1 className="text-6xl font-bold mb-4 leading-tight text-white drop-shadow-lg">
              {publisherInfo?.title || publisherInfo?.artist || `Artist: ${publisherId}`}
            </h1>
            <p className="text-xl text-gray-200 mb-6 leading-relaxed max-w-3xl drop-shadow-md">
              {publisherInfo?.description}
            </p>
            
            <div className="flex items-center gap-4 text-lg">
              {(() => {
                // Separate albums from EPs/singles (6 tracks or less) like main page
                const albumsWithMultipleTracks = albums.filter(album => album.tracks.length > 6);
                const epsAndSingles = albums.filter(album => album.tracks.length <= 6);
                const eps = epsAndSingles.filter(album => album.tracks.length > 1);
                const singles = epsAndSingles.filter(album => album.tracks.length === 1);

                return (
                  <>
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                        activeFilter === 'all' 
                          ? 'bg-white/20 text-white ring-2 ring-white/30' 
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                      <span className="font-medium">{albums.length}</span>
                      <span>all</span>
                    </button>
                    {albumsWithMultipleTracks.length > 0 && (
                      <button
                        onClick={() => setActiveFilter('albums')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                          activeFilter === 'albums' 
                            ? 'bg-green-400/20 text-white ring-2 ring-green-400/50' 
                            : 'text-gray-300 hover:bg-green-400/10 hover:text-white'
                        }`}
                      >
                        <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                        <span className="font-medium">{albumsWithMultipleTracks.length}</span>
                        <span>albums</span>
                      </button>
                    )}
                    {eps.length > 0 && (
                      <button
                        onClick={() => setActiveFilter('eps')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                          activeFilter === 'eps' 
                            ? 'bg-blue-400/20 text-white ring-2 ring-blue-400/50' 
                            : 'text-gray-300 hover:bg-blue-400/10 hover:text-white'
                        }`}
                      >
                        <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                        <span className="font-medium">{eps.length}</span>
                        <span>EPs</span>
                      </button>
                    )}
                    {singles.length > 0 && (
                      <button
                        onClick={() => setActiveFilter('singles')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                          activeFilter === 'singles' 
                            ? 'bg-purple-400/20 text-white ring-2 ring-purple-400/50' 
                            : 'text-gray-300 hover:bg-purple-400/10 hover:text-white'
                        }`}
                      >
                        <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
                        <span className="font-medium">{singles.length}</span>
                        <span>singles</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Albums Grid */}
        {albumsLoading ? (
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Discography</h2>
            </div>
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-gray-400">Loading albums...</p>
            </div>
          </div>
        ) : albums.length > 0 ? (
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {activeFilter === 'all' ? 'Discography' : 
                 activeFilter === 'albums' ? 'Albums' :
                 activeFilter === 'eps' ? 'EPs' :
                 'Singles'}
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
            {(() => {
              // Separate albums from EPs/singles (6 tracks or less)
              const albumsWithMultipleTracks = albums.filter(album => album.tracks.length > 6);
              const epsAndSingles = albums.filter(album => album.tracks.length <= 6);
              
              // Sort albums: Pin "Stay Awhile" first, then "Bloodshot Lies", then by artist/title
              albumsWithMultipleTracks.sort((a, b) => {
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
              
              epsAndSingles.sort((a, b) => {
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

              return (
                <>
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
                </>
              );
            })()}
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