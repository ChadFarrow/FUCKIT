'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddRSSFeed from '@/components/AddRSSFeed';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl } from '@/lib/cdn-utils';

// Complete Doerfels RSS feed collection
const feedUrls = [
  // Main Doerfels feeds
  'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
  'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
  
  // Additional Doerfels albums and projects
  'https://www.doerfelverse.com/feeds/18sundays.xml',
  'https://www.doerfelverse.com/feeds/alandace.xml',
  'https://www.doerfelverse.com/feeds/autumn.xml',
  'https://www.doerfelverse.com/feeds/christ-exalted.xml',
  'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
  'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
  'https://www.doerfelverse.com/feeds/dfbv1.xml',
  'https://www.doerfelverse.com/feeds/dfbv2.xml',
  'https://www.doerfelverse.com/feeds/disco-swag.xml',
  'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
  'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
  'https://www.doerfelverse.com/feeds/generation-gap.xml',
  'https://www.doerfelverse.com/feeds/heartbreak.xml',
  'https://www.doerfelverse.com/feeds/merry-christmix.xml',
  'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
  'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
  'https://www.doerfelverse.com/feeds/possible.xml',
  'https://www.doerfelverse.com/feeds/pour-over.xml',
  'https://www.doerfelverse.com/feeds/psalm-54.xml',
  'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
  'https://www.doerfelverse.com/feeds/they-dont-know.xml',
  'https://www.doerfelverse.com/feeds/think-ep.xml',
  'https://www.doerfelverse.com/feeds/underwater-single.xml',
  'https://www.doerfelverse.com/feeds/unsound-existence.xml',
  'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
  'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
  'https://www.doerfelverse.com/feeds/your-chance.xml',
  
  // Ed Doerfel (Shredward) projects
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
  
  // TJ Doerfel projects
  'https://www.thisisjdog.com/media/ring-that-bell.xml',
  
  // Wavlake feeds - Nate Johnivan collection
  'https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1', // Tinderbox
  'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4', // Artist feed
  'https://wavlake.com/feed/music/e678589b-5a9f-4918-9622-34119d2eed2c',
  'https://wavlake.com/feed/music/3a152941-c914-43da-aeca-5d7c58892a7f',
  'https://wavlake.com/feed/music/a97e0586-ecda-4b79-9c38-be9a9effe05a',
  'https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3',
  'https://wavlake.com/feed/music/ce8c4910-51bf-4d5e-a0b3-338e58e5ee79',
  'https://wavlake.com/feed/music/acb43f23-cfec-4cc1-a418-4087a5378129',
  'https://wavlake.com/feed/music/d1a871a7-7e4c-4a91-b799-87dcbb6bc41d',
  'https://wavlake.com/feed/music/3294d8b5-f9f6-4241-a298-f04df818390c',
  'https://wavlake.com/feed/music/d3145292-bf71-415f-a841-7f5c9a9466e1',
  'https://wavlake.com/feed/music/91367816-33e6-4b6e-8eb7-44b2832708fd',
  'https://wavlake.com/feed/music/8c8f8133-7ef1-4b72-a641-4e1a6a44d626',
  'https://wavlake.com/feed/music/9720d58b-22a5-4047-81de-f1940fec41c7',
  'https://wavlake.com/feed/music/21536269-5192-49e7-a819-fab00f4a159e',
  'https://wavlake.com/feed/music/624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e',
  
  // White Rabbit Records - DISABLED: Domain is down (ENOTFOUND)
  // 'https://whiterabbitrecords.org/wp-content/uploads/2023/04/Empty-Passenger-Seat.xml',
  
  // Joe Martin (Wavlake) - Complete collection
  'https://www.wavlake.com/feed/95ea253a-4058-402c-8503-204f6d3f1494', // Empty Passenger Seat
  'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738', // Artist feed
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
  'https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1'
];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [customFeeds, setCustomFeeds] = useState<string[]>([]);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  useEffect(() => {
    console.log('🔄 useEffect triggered - starting to load albums');
    loadAlbumsData();
  }, []);

  const handleAddFeed = async (feedUrl: string) => {
    setIsAddingFeed(true);
    try {
      // Add to custom feeds
      const newCustomFeeds = [...customFeeds, feedUrl];
      setCustomFeeds(newCustomFeeds);
      
      // Reload with the new feed
      await loadAlbumsData(newCustomFeeds);
    } catch (err) {
      console.error('Error adding feed:', err);
      setError('Failed to add RSS feed. Please check the URL and try again.');
    } finally {
      setIsAddingFeed(false);
    }
  };

  const loadAlbumsData = async (additionalFeeds: string[] = []) => {
    try {
      console.log('🚀 loadAlbumsData called with additionalFeeds:', additionalFeeds);
      setIsLoading(true);
      setError(null);
      
      console.log('Starting to load album data...');
      
      // Combine default feeds with custom feeds
      const allFeeds = [...feedUrls, ...additionalFeeds];
      console.log('Feed URLs:', allFeeds);
      console.log('Loading', allFeeds.length, 'feeds...');
      
      // Update progress as feeds load
      setLoadingProgress(0);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Feed loading timeout after 30 seconds')), 30000);
      });
      
      // Map all feedUrls to use the backend proxy
      const proxiedFeedUrls = allFeeds.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
      console.log('🔗 Proxied URLs:', proxiedFeedUrls.slice(0, 3), '...');
      
      let albumsData: RSSAlbum[];
      try {
        const parsePromise = RSSParser.parseMultipleFeeds(proxiedFeedUrls);
        albumsData = await Promise.race([parsePromise, timeoutPromise]) as RSSAlbum[];
        console.log('📦 Albums data received:', albumsData);
      } catch (parseError) {
        console.error('❌ RSSParser.parseMultipleFeeds failed:', parseError);
        throw parseError;
      }
      
      console.log('Albums data received:', albumsData);
      
      if (albumsData && albumsData.length > 0) {
        console.log('✅ Setting albums:', albumsData.length, 'albums');
        setAlbums(albumsData);
        console.log('Successfully set', albumsData.length, 'albums');
      } else {
        console.log('❌ No album data received');
        setError('Failed to load any album data from RSS feeds');
      }
      
    } catch (err) {
      console.error('Error loading albums:', err);
      setError(`Error loading album data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 loadAlbumsData finally block - setting isLoading to false');
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
            This is a demo app I built as the "insert title" project to see what we could do with RSS feeds and music. All data here comes from RSS feeds on{' '}
            <a href="https://podcastindex.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              podcastindex.org
            </a>. This is also a demo of a site for The Doerfels that I added other music I like also and some stuff to help test. -ChadF
          </p>
          <div className="flex items-center gap-2 text-sm">
            {isLoading ? (
              <>
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                <span className="text-yellow-400">Loading {feedUrls.length + customFeeds.length} RSS feeds...</span>
              </>
            ) : error ? (
              <>
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span className="text-red-400">{error}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              </>
            )}
          </div>
                </div>
      </header>
      
      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Add RSS Feed Component */}
        <AddRSSFeed onAddFeed={handleAddFeed} isLoading={isAddingFeed} />
        
        {/* Custom Feeds Display */}
        {customFeeds.length > 0 && (
          <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-white">Custom RSS Feeds ({customFeeds.length})</h3>
            <div className="space-y-2">
              {customFeeds.map((feed, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-700/50 rounded p-2">
                  <span className="text-sm text-gray-300 truncate flex-1">{feed}</span>
                  <button
                    onClick={() => {
                      const newCustomFeeds = customFeeds.filter((_, i) => i !== index);
                      setCustomFeeds(newCustomFeeds);
                      loadAlbumsData(newCustomFeeds);
                    }}
                    className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                    title="Remove feed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Albums</h2>
            <p className="text-gray-400">{error}</p>
            <button 
              onClick={() => loadAlbumsData(customFeeds)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : albums.length > 0 ? (
          <div className="max-w-7xl mx-auto">
            {(() => {
              // Separate albums from EPs/singles (6 tracks or less)
              const albumsWithMultipleTracks = albums.filter(album => album.tracks.length > 6);
              const epsAndSingles = albums.filter(album => album.tracks.length <= 6);
              
              // Sort albums: Pin "Bloodshot Lies" first, then by artist/title
              albumsWithMultipleTracks.sort((a, b) => {
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
                  href={`/album/${encodeURIComponent(album.title)}`}
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
                    
                    {/* Play Button Overlay - Always Visible */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                      <div className="bg-white/80 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
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
                            href={`/album/${encodeURIComponent(album.title)}`}
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
                              
                              {/* Play Button Overlay - Always Visible */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                                <div className="bg-white/80 hover:bg-white text-black rounded-full p-3 transform hover:scale-110 transition-all duration-200 shadow-lg">
                                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                              
                              {/* EP/Single Badge */}
                              <div className="absolute top-2 right-2 bg-purple-600/80 text-white text-xs px-2 py-1 rounded-full">
                                {album.tracks.length === 1 ? 'Single' : `EP - ${album.tracks.length} tracks`}
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
            <p className="text-gray-400">Unable to load any album information from the RSS feeds.</p>
          </div>
        )}
      </div>
    </div>
  );
}