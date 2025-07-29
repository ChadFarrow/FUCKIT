'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Music, Disc, Calendar, Clock, ExternalLink } from 'lucide-react';
import { RSSAlbum, RSSPublisherItem } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, getPublisherInfo } from '@/lib/url-utils';
import ControlsBar, { FilterType, ViewType, SortType } from '@/components/ControlsBar';
import CDNImage from '@/components/CDNImage';
import { useAudio } from '@/contexts/AudioContext';
import { toast } from '@/components/Toast';

interface PublisherDetailClientProps {
  publisherId: string;
  initialData?: {
    publisherInfo: any;
    publisherItems: any[];
    feedId: string;
  } | null;
}


export default function PublisherDetailClient({ publisherId, initialData }: PublisherDetailClientProps) {
  console.log('🎯 PublisherDetailClient component loaded with publisherId:', publisherId);
  
  const [isLoading, setIsLoading] = useState(!initialData);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [publisherItems, setPublisherItems] = useState<RSSPublisherItem[]>(initialData?.publisherItems || []);
  const [error, setError] = useState<string | null>(null);
  const [publisherInfo, setPublisherInfo] = useState<{ title?: string; description?: string; artist?: string; coverArt?: string; avatarArt?: string } | null>(
    initialData?.publisherInfo ? {
      title: initialData.publisherInfo.artist || initialData.publisherInfo.title,
      description: initialData.publisherInfo.description,
      artist: initialData.publisherInfo.artist,
      coverArt: initialData.publisherInfo.coverArt,
      avatarArt: initialData.publisherInfo.avatarArt || initialData.publisherInfo.coverArt
    } : null
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [sortType, setSortType] = useState<SortType>('name');
  
  // Global audio context for shuffle functionality
  const { shuffleAllTracks } = useAudio();
  
  // Shuffle functionality for publisher albums
  const handleShuffle = async () => {
    try {
      console.log('🎲 Shuffle button clicked - starting shuffle for publisher albums');
      const success = await shuffleAllTracks();
      if (success) {
        toast.success('🎲 Shuffle started!');
      } else {
        toast.error('Failed to start shuffle');
      }
    } catch (error) {
      console.error('Error starting shuffle:', error);
      toast.error('Error starting shuffle');
    }
  };

  // Fetch albums from individual feed URLs when publisher items have empty titles
  const fetchPublisherAlbums = async () => {
    if (!initialData?.publisherItems) {
      setAlbumsLoading(false);
      return;
    }

    try {
      console.log(`🔍 Fetching album data for ${initialData.publisherItems.length} publisher items`);
      
      // Fetch albums data to find matches by feedGuid
      const response = await fetch('/api/albums');
      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }
      
      const albumsData = await response.json();
      const allAlbums = albumsData.albums || [];
      
      // Match publisher items to actual albums by feedGuid or feedUrl
      const matchedAlbums: RSSAlbum[] = [];
      
      if (initialData.publisherItems.length > 0) {
        // Try to match by publisher items first
        for (const item of initialData.publisherItems) {
          // Try to find matching album by feedGuid
          const matchingAlbum = allAlbums.find((album: RSSAlbum) => 
            album.feedGuid === item.feedGuid || 
            album.feedUrl === item.feedUrl ||
            album.id === item.feedGuid
          );
          
          if (matchingAlbum) {
            console.log(`✅ Found matching album: ${matchingAlbum.title}`);
            matchedAlbums.push(matchingAlbum);
          } else {
            console.log(`❌ No matching album found for feedGuid: ${item.feedGuid}`);
          }
        }
      } else if (initialData.publisherInfo?.artist) {
        // If no publisher items, try to find albums by artist name
        console.log(`🎭 No publisher items, searching by artist: ${initialData.publisherInfo.artist}`);
        const artistAlbums = allAlbums.filter((album: RSSAlbum) => 
          album.artist && album.artist.toLowerCase().includes(initialData.publisherInfo.artist.toLowerCase())
        );
        console.log(`🎵 Found ${artistAlbums.length} albums by artist search`);
        matchedAlbums.push(...artistAlbums);
      } else {
        // Last resort: search by publisherId in album IDs or artist names
        console.log(`🔍 Fallback search by publisherId: ${publisherId}`);
        const fallbackAlbums = allAlbums.filter((album: RSSAlbum) => 
          album.id.toLowerCase().includes(publisherId.toLowerCase()) ||
          (album.artist && album.artist.toLowerCase().includes(publisherId.toLowerCase()))
        );
        console.log(`🎵 Found ${fallbackAlbums.length} albums by fallback search`);
        matchedAlbums.push(...fallbackAlbums);
      }
      
      console.log(`🎵 Found ${matchedAlbums.length} matching albums out of ${initialData.publisherItems.length} items`);
      setAlbums(matchedAlbums);
      
    } catch (error) {
      console.error('Error fetching publisher albums:', error);
      setError('Failed to load publisher albums');
    } finally {
      setAlbumsLoading(false);
    }
  };

  useEffect(() => {
    console.log('🎯 PublisherDetailClient useEffect triggered');
    
    // If we have initial data, use it and convert publisher items to albums
    if (initialData) {
      console.log('📋 Using initial data for publisher');
      
      // Convert publisher items to album format for display
      if (initialData.publisherItems && initialData.publisherItems.length > 0) {
        // Filter out items with empty or missing titles, as they won't render properly
        const validItems = initialData.publisherItems.filter((item: any) => 
          item.title && item.title.trim() !== ''
        );
        
        if (validItems.length > 0) {
          const albumsFromItems = validItems.map((item: any) => ({
            id: item.id || `album-${Math.random()}`,
            title: item.title,
            artist: item.artist,
            description: item.description,
            coverArt: item.coverArt,
            tracks: Array(item.trackCount).fill(null).map((_, i) => ({
              id: `track-${i}`,
              title: `${item.title} - Track ${i + 1}`,
              duration: '0:00',
              url: item.link
            })),
            releaseDate: item.releaseDate,
            link: item.link,
            feedUrl: item.link
          }));
          
          console.log(`🏢 Setting ${albumsFromItems.length} albums from initial data (filtered from ${initialData.publisherItems.length} items)`);
          setAlbums(albumsFromItems);
        } else {
          console.log(`⚠️ No valid albums found - all ${initialData.publisherItems.length} items have empty titles`);
          // For publishers with empty titles, we need to fetch the actual album data
          setAlbumsLoading(true);
          await fetchPublisherAlbums();
        }
      } else {
        console.log('⚠️ No publisher items found');
        setAlbumsLoading(true);
        await fetchPublisherAlbums();
      }
      
      // Set loading to false since we have data
      setIsLoading(false);
      return;
    }
    
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
        
        // Set publisher info immediately using the known publisher data
        setPublisherInfo({
          title: publisherInfo.name || `Artist: ${publisherId}`,
          description: 'Independent artist and music creator',
          artist: publisherInfo.name,
          coverArt: undefined, // Will be set from publisher feed data if available
          avatarArt: undefined // Will be set from latest remote item if available
        });
        
        // Stop loading immediately since we have publisher info
        setIsLoading(false);

        // Load publisher feed data to get the publisher's own image and items
        console.log(`🏢 Loading publisher feed data...`);
        
        try {
          // Load parsed feeds data directly to get publisher feed information
          const parsedFeedsResponse = await fetch('/api/parsed-feeds');
          
          if (parsedFeedsResponse.ok) {
            const parsedFeedsData = await parsedFeedsResponse.json();
            const feeds = parsedFeedsData.feeds || [];
            
            // Find the publisher feed for this publisher
            const publisherFeed = feeds.find((feed: any) => {
              if (feed.type === 'publisher') {
                // Check if this feed matches our publisher
                if (feed.originalUrl === feedUrl) return true;
                if (feed.id && feed.id.includes(publisherId)) return true;
                if (feed.parsedData?.publisherInfo?.artist === publisherInfo.name) return true;
                return false;
              }
              return false;
            });
            
            console.log(`🏢 Found publisher feed:`, publisherFeed);
            
            // Extract publisher info from the feed data
            if (publisherFeed?.parsedData?.publisherInfo) {
              const feedInfo = publisherFeed.parsedData.publisherInfo;
              console.log(`🏢 Publisher feed info:`, feedInfo);
              
              // Find the last remote item's artwork for avatar
              let lastItemAvatarArt = null;
              if (feedInfo.remoteItems && feedInfo.remoteItems.length > 0) {
                const lastItem = feedInfo.remoteItems[feedInfo.remoteItems.length - 1]; // Last item
                console.log(`🎨 Last remote item:`, lastItem);
                
                // Find the corresponding album in our parsed data
                console.log(`🔍 Looking for feed with URL: "${lastItem.feedUrl}" or GUID: "${lastItem.feedGuid}"`);
                console.log(`🔍 Available feeds:`, feeds.map((f: any) => ({ id: f.id, url: f.originalUrl, guid: f.parsedData?.album?.feedGuid })));
                
                const matchingFeed = feeds.find((feed: any) => {
                  const urlMatch = feed.originalUrl === lastItem.feedUrl;
                  const guidMatch = feed.parsedData?.album?.feedGuid === lastItem.feedGuid;
                  console.log(`🔍 Checking feed ${feed.id}: urlMatch=${urlMatch} (${feed.originalUrl} vs ${lastItem.feedUrl}), guidMatch=${guidMatch} (${feed.parsedData?.album?.feedGuid} vs ${lastItem.feedGuid})`);
                  return urlMatch || guidMatch;
                });
                
                if (matchingFeed?.parsedData?.album?.coverArt) {
                  lastItemAvatarArt = matchingFeed.parsedData.album.coverArt;
                  console.log(`🎨 Found last item artwork:`, lastItemAvatarArt);
                }
              }
              
              setPublisherInfo({
                title: feedInfo.artist || feedInfo.title || publisherInfo.name || `Artist: ${publisherId}`,
                description: feedInfo.description || 'Independent artist and music creator',
                artist: feedInfo.artist || publisherInfo.name,
                coverArt: feedInfo.coverArt, // This is the publisher's main image for background
                avatarArt: lastItemAvatarArt || feedInfo.coverArt // Use last item's art for avatar, fallback to publisher art
              });
            }
            
            // Extract publisher items from the feed data
            if (publisherFeed?.parsedData?.publisherItems) {
              const items = publisherFeed.parsedData.publisherItems;
              console.log(`🏢 Found ${items.length} publisher items`);
              
              // Convert publisher items to album format for display
              const albumsFromItems = items.map((item: any) => ({
                id: item.id || `album-${Math.random()}`,
                title: item.title,
                artist: item.artist,
                description: item.description,
                coverArt: item.coverArt,
                tracks: Array(item.trackCount).fill(null).map((_, i) => ({
                  id: `track-${i}`,
                  title: `${item.title} - Track ${i + 1}`,
                  duration: '0:00',
                  url: item.link
                })),
                releaseDate: item.releaseDate,
                link: item.link,
                feedUrl: item.link
              }));
              
              console.log(`🏢 Setting ${albumsFromItems.length} albums from publisher items`);
              setAlbums(albumsFromItems);
              setPublisherItems(items);
            }
          }
        } catch (feedError) {
          console.error(`❌ Error loading publisher feed data:`, feedError);
          // Continue with album-based fallback
        }

        // Load pre-parsed album data to get publisher info as fallback
        console.log(`🏢 Loading publisher info from pre-parsed data...`);
        
        // Load pre-parsed album data to get publisher info
        const response = await fetch('/api/albums');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const allAlbums = data.albums || [];
        
        // Find albums from this publisher
        const publisherAlbums = allAlbums.filter((album: any) => {
          if (!album.publisher) return false;
          
          // Check if this album belongs to the publisher
          if (album.publisher.feedUrl === feedUrl) return true;
          if (album.publisher.feedGuid && album.publisher.feedGuid.includes(publisherId)) return true;
          
          return false;
        });
        
        console.log(`🏢 Found ${publisherAlbums.length} albums for publisher`);
        
        // If we don't have publisher feed info, extract from albums as fallback
        if (publisherAlbums.length > 0) {
          // Sort albums by date (newest first) to get the most recent release
          const sortedAlbums = [...publisherAlbums].sort((a, b) => {
            const dateA = new Date(a.pubDate || a.date || 0);
            const dateB = new Date(b.pubDate || b.date || 0);
            return dateB.getTime() - dateA.getTime(); // Newest first
          });
          
          const newestAlbum = sortedAlbums[0];
          const albumPublisherInfo = {
            title: newestAlbum.publisher?.title || newestAlbum.artist,
            artist: newestAlbum.artist,
            description: newestAlbum.publisher?.description || 'Independent artist and music creator',
            coverArt: newestAlbum.publisher?.coverArt || newestAlbum.coverArt
          };
          
          console.log(`🏢 Album-based publisher info:`, albumPublisherInfo);
          
          // Update with album-based info as fallback
          setPublisherInfo(prev => ({
            ...prev,
            title: albumPublisherInfo.artist || albumPublisherInfo.title || prev?.title,
            description: albumPublisherInfo.description || prev?.description,
            artist: albumPublisherInfo.artist || prev?.artist,
            coverArt: prev?.coverArt || albumPublisherInfo.coverArt, // Keep existing coverArt if we have it from publisher feed
            avatarArt: prev?.avatarArt || prev?.coverArt || albumPublisherInfo.coverArt // Keep existing avatarArt, fallback to coverArt
          }));
          
          // If we don't have albums from publisher items, use the album data
          if (!albums.length) {
            console.log(`🏢 Setting ${publisherAlbums.length} publisher albums from album data`);
            setAlbums(publisherAlbums);
          }
        }
        
        // Stop loading state early so page shows content
        setIsLoading(false);
        
        // Load publisher items and albums in background
        setAlbumsLoading(true);
        
        try {
          // For publisher items, we can use the albums data
          if (!publisherItems.length) {
            setPublisherItems(publisherAlbums.map((album: any) => ({
              title: album.title,
              description: album.description || album.summary,
              url: album.feedUrl,
              image: album.coverArt
            })));
          }
          
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
    
  }, [publisherId, initialData]);

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

  if (isLoading && !publisherInfo?.title && !publisherInfo?.artist) {
    return (
      <div className="min-h-screen text-white relative overflow-hidden">
        {/* Fallback background - use artist image or gradient */}
        {publisherInfo?.coverArt ? (
          <div className="fixed inset-0 z-0">
            <CDNImage 
              src={getAlbumArtworkUrl(publisherInfo.coverArt, 'large')} 
              alt={publisherInfo.title || 'Artist background'}
              width={1920}
              height={1080}
              className="w-full h-full object-cover"
              priority
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/70"></div>
          </div>
        ) : (
          /* Fallback gradient background */
          <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 z-0" />
        )}
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">
              Loading publisher...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-white relative overflow-hidden">
        {/* Fallback background - use artist image or gradient */}
        {publisherInfo?.coverArt ? (
          <div className="fixed inset-0 z-0">
            <CDNImage 
              src={getAlbumArtworkUrl(publisherInfo.coverArt, 'large')} 
              alt={publisherInfo.title || 'Artist background'}
              width={1920}
              height={1080}
              className="w-full h-full object-cover"
              priority
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/70"></div>
          </div>
        ) : (
          /* Fallback gradient background */
          <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 z-0" />
        )}
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
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

  // Calculate statistics
  const totalTracks = albums.reduce((sum, album) => sum + album.tracks.length, 0);
  const totalDuration = albums.reduce((sum, album) => {
    return sum + album.tracks.reduce((trackSum, track) => {
      const [minutes, seconds] = track.duration.split(':').map(Number);
      return trackSum + (minutes || 0) * 60 + (seconds || 0);
    }, 0);
  }, 0);
  const avgYear = albums.length > 0 ? Math.floor(albums.reduce((sum, album) => sum + new Date(album.releaseDate).getFullYear(), 0) / albums.length) : 0;

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Filter and sort albums
  const getFilteredAlbums = () => {
    let filtered = albums;
    
    switch (activeFilter) {
      case 'albums':
        filtered = albumsWithMultipleTracks;
        break;
      case 'eps':
        filtered = epsAndSingles.filter(album => album.tracks.length > 1);
        break;
      case 'singles':
        filtered = epsAndSingles.filter(album => album.tracks.length === 1);
        break;
      default: // 'all'
        // For &quot;All&quot;, maintain the hierarchical order: Albums, EPs, then Singles
        filtered = [...albumsWithMultipleTracks, ...epsAndSingles];
    }

    // Sort albums
    return filtered.sort((a, b) => {
      // For &quot;All&quot; filter, maintain hierarchy first, then apply sorting within each category
      if (activeFilter === 'all') {
        const aIsAlbum = a.tracks.length > 6;
        const bIsAlbum = b.tracks.length > 6;
        const aIsEP = a.tracks.length > 1 && a.tracks.length <= 6;
        const bIsEP = b.tracks.length > 1 && b.tracks.length <= 6;
        const aIsSingle = a.tracks.length === 1;
        const bIsSingle = b.tracks.length === 1;
        
        // Albums come first
        if (aIsAlbum && !bIsAlbum) return -1;
        if (!aIsAlbum && bIsAlbum) return 1;
        
        // Then EPs (if both are not albums)
        if (!aIsAlbum && !bIsAlbum) {
          if (aIsEP && bIsSingle) return -1;
          if (aIsSingle && bIsEP) return 1;
        }
        
        // Within same category, apply the selected sort
        switch (sortType) {
          case 'year':
            return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
          case 'tracks':
            return b.tracks.length - a.tracks.length;
          default: // name
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        }
      } else {
        // For specific filters, just apply the sort type
        switch (sortType) {
          case 'year':
            return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
          case 'tracks':
            return b.tracks.length - a.tracks.length;
          default: // name
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        }
      }
    });
  };

  const filteredAlbums = getFilteredAlbums();

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Enhanced Background */}
      {publisherInfo?.coverArt ? (
        <div className="fixed inset-0">
          <CDNImage 
            src={getAlbumArtworkUrl(publisherInfo.coverArt, 'large')} 
            alt={publisherInfo.title || "Publisher background"}
            width={1920}
            height={1080}
            className="w-full h-full object-cover"
            priority
          />
          {/* Gradient overlay for better readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/90"></div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-gray-900 to-black z-0" />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <div className="container mx-auto px-4 pt-8">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Hero Section */}
        <div className="container mx-auto px-4 pb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-end gap-8 mb-12">
            {/* Artist Avatar - Use latest item artwork first, then publisher artwork as fallback */}
            <div className="flex-shrink-0">
              {publisherInfo?.avatarArt ? (
                // Use latest item's artwork for avatar
                <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20">
                  <CDNImage 
                    src={getAlbumArtworkUrl(publisherInfo.avatarArt, 'large')} 
                    alt={publisherInfo.title || "Artist"}
                    width={192}
                    height={192}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : albums.length > 0 ? (
                // Fallback to newest release artwork
                (() => {
                  const sortedByDate = [...albums].sort((a, b) => {
                    const dateA = new Date(a.releaseDate || 0);
                    const dateB = new Date(b.releaseDate || 0);
                    return dateB.getTime() - dateA.getTime(); // Newest first
                  });
                  const newestAlbum = sortedByDate[0];
                  
                  return newestAlbum.coverArt ? (
                    <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20">
                      <CDNImage 
                        src={getAlbumArtworkUrl(newestAlbum.coverArt, 'large')} 
                        alt={newestAlbum.title || "Latest Release"}
                        width={192}
                        height={192}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                      <Music className="w-20 h-20 text-white/80" />
                    </div>
                  );
                })()
              ) : (
                <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                  <Music className="w-20 h-20 text-white/80" />
                </div>
              )}
            </div>

            {/* Artist Information */}
            <div className="flex-1 lg:mb-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium">
                  <Music className="w-4 h-4 inline mr-1" />
                  Artist
                </span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-black mb-4 tracking-tight">
                {publisherInfo?.title || publisherId}
              </h1>
              
              {publisherInfo?.description && (
                <p className="text-gray-300 text-lg mb-6 max-w-2xl leading-relaxed">
                  {publisherInfo.description}
                </p>
              )}

              {/* Statistics */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">{albums.length}</span>
                  <span className="text-gray-400">Releases</span>
                </div>
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-green-400" />
                  <span className="font-semibold">{totalTracks}</span>
                  <span className="text-gray-400">Tracks</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold">{formatDuration(totalDuration)}</span>
                  <span className="text-gray-400">Total Duration</span>
                </div>
                {avgYear > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    <span className="font-semibold">{avgYear}</span>
                    <span className="text-gray-400">Avg. Year</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-black/20 backdrop-blur-sm min-h-screen">
          <div className="container mx-auto px-4 py-8 pb-28">
            {albumsLoading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-6"></div>
                <p className="text-xl text-gray-400">Loading albums...</p>
              </div>
            ) : albums.length > 0 ? (
              <>
                {/* Controls Bar */}
                <ControlsBar
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  sortType={sortType}
                  onSortChange={setSortType}
                  viewType={viewType}
                  onViewChange={setViewType}
                  showShuffle={true}
                  onShuffle={handleShuffle}
                  resultCount={filteredAlbums.length}
                  resultLabel={activeFilter === 'all' ? 'Releases' : 
                    activeFilter === 'albums' ? 'Albums' :
                    activeFilter === 'eps' ? 'EPs' : 'Singles'}
                  className="mb-8"
                />

                {/* Albums Display */}
                {viewType === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {filteredAlbums.map((album, index) => (
                      <Link 
                        key={`${album.title}-${index}`}
                        href={generateAlbumUrl(album.title)}
                        className="group bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl hover:scale-105"
                      >
                        <div className="relative aspect-square">
                          {album.coverArt ? (
                            <CDNImage 
                              src={getAlbumArtworkUrl(album.coverArt, 'medium')} 
                              alt={album.title}
                              width={300}
                              height={300}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                              <Music className="w-12 h-12 text-white/80" />
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                            <div className="bg-white/90 hover:bg-white text-black rounded-full p-3 transform scale-0 group-hover:scale-100 transition-all duration-200 shadow-xl">
                              <Play className="w-6 h-6" />
                            </div>
                          </div>
                          
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                            {album.tracks.length} tracks
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">
                            {album.title}
                          </h3>
                          <p className="text-gray-400 text-sm mb-3 line-clamp-1">{album.artist}</p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{new Date(album.releaseDate).getFullYear()}</span>
                            <div className="flex items-center gap-2">
                              {album.explicit && (
                                <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-xs font-bold">
                                  E
                                </span>
                              )}
                              <span className="bg-white/10 px-2 py-0.5 rounded">
                                {album.tracks.length <= 6 ? (album.tracks.length === 1 ? 'Single' : 'EP') : 'Album'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAlbums.map((album, index) => (
                      <Link 
                        key={`${album.title}-${index}`}
                        href={generateAlbumUrl(album.title)}
                        className="group flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          {album.coverArt ? (
                            <CDNImage 
                              src={getAlbumArtworkUrl(album.coverArt, 'thumbnail')} 
                              alt={album.title}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                              <Music className="w-6 h-6 text-white/80" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">
                            {album.title}
                          </h3>
                          <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>{new Date(album.releaseDate).getFullYear()}</span>
                          <span>{album.tracks.length} tracks</span>
                          <span className="px-2 py-1 bg-white/10 rounded text-xs">
                            {album.tracks.length <= 6 ? (album.tracks.length === 1 ? 'Single' : 'EP') : 'Album'}
                          </span>
                          {album.explicit && (
                            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                              E
                            </span>
                          )}
                        </div>
                        
                        <Play className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <Music className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
                <p className="text-gray-400 text-lg">This artist doesn&apos;t have any releases available yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}