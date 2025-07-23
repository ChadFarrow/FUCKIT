'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddRSSFeed from '@/components/AddRSSFeed';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generatePublisherSlug } from '@/lib/url-utils';

// Environment-based RSS feed configuration
// CDN zone found: re-podtards-cdn (working correctly)
// Temporarily use original URLs for RSS feeds (CDN Pull Zone doesn't have RSS feeds yet)
const isProduction = false; // process.env.NODE_ENV === 'production';

// Clean, verified RSS feed URL mappings: [originalUrl, cdnUrl]
const feedUrlMappings = [
  // Core Doerfels feeds - verified working
  ['https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml'],
  ['https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/bloodshot-lies-album.xml'],
  ['https://www.doerfelverse.com/feeds/intothedoerfelverse.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/intothedoerfelverse.xml'],
  ['https://www.doerfelverse.com/feeds/wrath-of-banjo.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/wrath-of-banjo.xml'],
  ['https://www.doerfelverse.com/feeds/ben-doerfel.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/ben-doerfel.xml'],
  
  // Additional Doerfels albums and projects - all verified working
  ['https://www.doerfelverse.com/feeds/18sundays.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/18sundays.xml'],
  ['https://www.doerfelverse.com/feeds/alandace.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/alandace.xml'],
  ['https://www.doerfelverse.com/feeds/autumn.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/autumn.xml'],
  ['https://www.doerfelverse.com/feeds/christ-exalted.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/christ-exalted.xml'],
  ['https://www.doerfelverse.com/feeds/come-back-to-me.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/come-back-to-me.xml'],
  ['https://www.doerfelverse.com/feeds/dead-time-live-2016.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/dead-time-live-2016.xml'],
  ['https://www.doerfelverse.com/feeds/dfbv1.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/dfbv1.xml'],
  ['https://www.doerfelverse.com/feeds/dfbv2.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/dfbv2.xml'],
  ['https://www.doerfelverse.com/feeds/disco-swag.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/disco-swag.xml'],
  ['https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/doerfels-pubfeed.xml'],
  ['https://www.doerfelverse.com/feeds/first-married-christmas.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/first-married-christmas.xml'],
  ['https://www.doerfelverse.com/feeds/generation-gap.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/generation-gap.xml'],
  ['https://www.doerfelverse.com/feeds/heartbreak.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/heartbreak.xml'],
  ['https://www.doerfelverse.com/feeds/merry-christmix.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/merry-christmix.xml'],
  ['https://www.doerfelverse.com/feeds/middle-season-let-go.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/middle-season-let-go.xml'],
  ['https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/phatty-the-grasshopper.xml'],
  ['https://www.doerfelverse.com/feeds/possible.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/possible.xml'],
  ['https://www.doerfelverse.com/feeds/pour-over.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/pour-over.xml'],
  ['https://www.doerfelverse.com/feeds/psalm-54.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/psalm-54.xml'],
  ['https://www.doerfelverse.com/feeds/sensitive-guy.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/sensitive-guy.xml'],
  ['https://www.doerfelverse.com/feeds/they-dont-know.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/they-dont-know.xml'],
  ['https://www.doerfelverse.com/feeds/think-ep.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/think-ep.xml'],
  ['https://www.doerfelverse.com/feeds/underwater-single.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/underwater-single.xml'],
  ['https://www.doerfelverse.com/feeds/unsound-existence.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/unsound-existence.xml'],
  ['https://www.doerfelverse.com/feeds/you-are-my-world.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/you-are-my-world.xml'],
  ['https://www.doerfelverse.com/feeds/you-feel-like-home.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/you-feel-like-home.xml'],
  ['https://www.doerfelverse.com/feeds/your-chance.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/your-chance.xml'],
  ['https://www.doerfelverse.com/artists/opus/opus/opus.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/opus.xml'],
  
  // Ed Doerfel (Shredward) projects - verified working
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/nostalgic.xml'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/citybeach.xml'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/kurtisdrums-v1.xml'],
  
  // TJ Doerfel projects - verified working
  ['https://www.thisisjdog.com/media/ring-that-bell.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/ring-that-bell.xml'],
  
  // External artists - verified working
  ['https://ableandthewolf.com/static/media/feed.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/ableandthewolf-feed.xml'],
  ['https://static.staticsave.com/mspfiles/deathdreams.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/deathdreams.xml'],
  ['https://static.staticsave.com/mspfiles/waytogo.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/waytogo.xml'],
  ['https://feed.falsefinish.club/Vance%20Latta/Vance%20Latta%20-%20Love%20In%20Its%20Purest%20Form/love%20in%20its%20purest%20form.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/vance-latta-love-in-its-purest-form.xml'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now%20i%20feel%20it.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/c-kostra-now-i-feel-it.xml'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/mellow-cassette-pilot.xml'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml', 'https://re-podtards-cdn.b-cdn.net/feeds/mellow-cassette-radio-brigade.xml'],
  
  // Wavlake feeds - verified working
  ['https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-d677db67-0310-4813-970e-e65927c689f1.xml'],
  ['https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-artist-aa909244-7555-4b52-ad88-7233860c6fb4.xml'],
  ['https://wavlake.com/feed/music/e678589b-5a9f-4918-9622-34119d2eed2c', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-e678589b-5a9f-4918-9622-34119d2eed2c.xml'],
  ['https://wavlake.com/feed/music/3a152941-c914-43da-aeca-5d7c58892a7f', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-3a152941-c914-43da-aeca-5d7c58892a7f.xml'],
  ['https://wavlake.com/feed/music/a97e0586-ecda-4b79-9c38-be9a9effe05a', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-a97e0586-ecda-4b79-9c38-be9a9effe05a.xml'],
  ['https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-0ed13237-aca9-446f-9a03-de1a2d9331a3.xml'],
  ['https://wavlake.com/feed/music/ce8c4910-51bf-4d5e-a0b3-338e58e5ee79', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-ce8c4910-51bf-4d5e-a0b3-338e58e5ee79.xml'],
  ['https://wavlake.com/feed/music/acb43f23-cfec-4cc1-a418-4087a5378129', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-acb43f23-cfec-4cc1-a418-4087a5378129.xml'],
  ['https://wavlake.com/feed/music/d1a871a7-7e4c-4a91-b799-87dcbb6bc41d', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-d1a871a7-7e4c-4a91-b799-87dcbb6bc41d.xml'],
  ['https://wavlake.com/feed/music/3294d8b5-f9f6-4241-a298-f04df818390c', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-3294d8b5-f9f6-4241-a298-f04df818390c.xml'],
  ['https://wavlake.com/feed/music/d3145292-bf71-415f-a841-7f5c9a9466e1', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-d3145292-bf71-415f-a841-7f5c9a9466e1.xml'],
  ['https://wavlake.com/feed/music/91367816-33e6-4b6e-8eb7-44b2832708fd', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-91367816-33e6-4b6e-8eb7-44b2832708fd.xml'],
  ['https://wavlake.com/feed/music/8c8f8133-7ef1-4b72-a641-4e1a6a44d626', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-8c8f8133-7ef1-4b72-a641-4e1a6a44d626.xml'],
  ['https://wavlake.com/feed/music/9720d58b-22a5-4047-81de-f1940fec41c7', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-9720d58b-22a5-4047-81de-f1940fec41c7.xml'],
  ['https://wavlake.com/feed/music/21536269-5192-49e7-a819-fab00f4a159e', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-21536269-5192-49e7-a819-fab00f4a159e.xml'],
  ['https://wavlake.com/feed/music/624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e.xml'],
  ['https://wavlake.com/feed/music/997060e3-9dc1-4cd8-b3c1-3ae06d54bb03', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-997060e3-9dc1-4cd8-b3c1-3ae06d54bb03.xml'],
  ['https://wavlake.com/feed/music/b54b9a19-b6ed-46c1-806c-7e82f7550edc', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-b54b9a19-b6ed-46c1-806c-7e82f7550edc.xml'],
  
  // Joe Martin (Wavlake) - verified working
  ['https://www.wavlake.com/feed/95ea253a-4058-402c-8503-204f6d3f1494', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-95ea253a-4058-402c-8503-204f6d3f1494.xml'],
  ['https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-artist-18bcbf10-6701-4ffb-b255-bc057390d738.xml'],
  ['https://wavlake.com/feed/music/1c7917cc-357c-4eaf-ab54-1a7cda504976', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-1c7917cc-357c-4eaf-ab54-1a7cda504976.xml'],
  ['https://wavlake.com/feed/music/e1f9dfcb-ee9b-4a6d-aee7-189043917fb5', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-e1f9dfcb-ee9b-4a6d-aee7-189043917fb5.xml'],
  ['https://wavlake.com/feed/music/d4f791c3-4d0c-4fbd-a543-c136ee78a9de', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-d4f791c3-4d0c-4fbd-a543-c136ee78a9de.xml'],
  ['https://wavlake.com/feed/music/51606506-66f8-4394-b6c6-cc0c1b554375', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-51606506-66f8-4394-b6c6-cc0c1b554375.xml'],
  ['https://wavlake.com/feed/music/6b7793b8-fd9d-432b-af1a-184cd41aaf9d', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-6b7793b8-fd9d-432b-af1a-184cd41aaf9d.xml'],
  ['https://wavlake.com/feed/music/0bb8c9c7-1c55-4412-a517-572a98318921', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-0bb8c9c7-1c55-4412-a517-572a98318921.xml'],
  ['https://wavlake.com/feed/music/16e46ed0-b392-4419-a937-a7815f6ca43b', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-16e46ed0-b392-4419-a937-a7815f6ca43b.xml'],
  ['https://wavlake.com/feed/music/2cd1b9ea-9ef3-4a54-aa25-55295689f442', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-2cd1b9ea-9ef3-4a54-aa25-55295689f442.xml'],
  ['https://wavlake.com/feed/music/33eeda7e-8591-4ff5-83f8-f36a879b0a09', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-33eeda7e-8591-4ff5-83f8-f36a879b0a09.xml'],
  ['https://wavlake.com/feed/music/32a79df8-ec3e-4a14-bfcb-7a074e1974b9', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-32a79df8-ec3e-4a14-bfcb-7a074e1974b9.xml'],
  ['https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1', 'https://re-podtards-cdn.b-cdn.net/feeds/wavlake-06376ab5-efca-459c-9801-49ceba5fdab1.xml'],
];

// Select URLs based on environment
const feedUrls = feedUrlMappings.map(([originalUrl, cdnUrl]) => 
  isProduction ? cdnUrl : originalUrl
);

// Debug logging
console.log('🔧 Environment check:', { isProduction, NODE_ENV: process.env.NODE_ENV });
console.log('🔧 Feed URLs count:', feedUrls.length);
console.log('🔧 First few feed URLs:', feedUrls.slice(0, 3));

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<RSSAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [customFeeds, setCustomFeeds] = useState<string[]>([]);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Audio player state for main page
  const [currentPlayingAlbum, setCurrentPlayingAlbum] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasLoadedRef = useRef(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    console.log('🔄 useEffect triggered - starting to load albums');
    console.log('🔄 hasLoadedRef.current:', hasLoadedRef.current);
    console.log('🔄 isClient:', isClient);
    
    // Always try to load, regardless of hasLoadedRef
    console.log('🔄 Attempting to load albums...');
    
    // Try to load from cache first
    if (typeof window !== 'undefined') {
      const cachedAlbums = localStorage.getItem('cachedAlbums');
      const cacheTimestamp = localStorage.getItem('albumsCacheTimestamp');
      
      if (cachedAlbums && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes
        
        if (cacheValid) {
          try {
            const parsedAlbums = JSON.parse(cachedAlbums);
            console.log('📦 Loading albums from cache:', parsedAlbums.length, 'albums');
            setAlbums(parsedAlbums);
            setIsLoading(false);
            return;
          } catch (error) {
            console.warn('⚠️ Failed to parse cached albums:', error);
          }
        }
      }
    }
    
    // Add a small delay to let the UI render first
    setTimeout(() => {
      console.log('🔄 Calling loadAlbumsData after timeout');
      loadAlbumsData();
    }, 100);
  }, [isClient]); // Add isClient as dependency

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
      console.log('🚀 Current feedUrls:', feedUrls);
      console.log('🚀 isProduction value:', isProduction);
      setIsLoading(true);
      setError(null);
      
      // Remove test code and restore normal RSS feed loading
      console.log('🚀 Starting normal RSS feed loading...');
      
      console.log('Starting to load album data...');
      
      // Combine default feeds with custom feeds
      const allFeeds = [...feedUrls, ...additionalFeeds];
      
      // Add debugging to see what's happening
      console.log('🔍 About to call RSSParser.parseMultipleFeeds with:', allFeeds.length, 'feeds');
      console.log('🔍 First few feed URLs:', allFeeds.slice(0, 3));
      console.log('Feed URLs:', allFeeds);
      console.log('Loading', allFeeds.length, 'feeds...');
      
      // Update progress as feeds load
      setLoadingProgress(0);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Feed loading timeout after 30 seconds')), 30000);
      });
      
      // Pass the original URLs to RSSParser - it will handle proxy conversion internally
      console.log('🔗 Original URLs:', allFeeds.slice(0, 3), '...');
      
      let albumsData: RSSAlbum[];
      try {
        // Parse regular feeds first
        const parsePromise = RSSParser.parseMultipleFeeds(allFeeds);
        const regularAlbums = await Promise.race([parsePromise, timeoutPromise]) as RSSAlbum[];
        console.log('📦 Regular albums data received:', regularAlbums);

        // Set albums immediately for faster UI response
        if (regularAlbums && regularAlbums.length > 0) {
          setAlbums(regularAlbums);
          console.log('✅ Set initial albums:', regularAlbums.length, 'albums');
        }

        // Load publisher feeds in background (non-blocking)
        const publisherFeeds = new Set<string>();
        regularAlbums.forEach(album => {
          if (album.publisher && album.publisher.feedUrl) {
            publisherFeeds.add(album.publisher.feedUrl);
          }
        });

        console.log(`🏢 Found ${publisherFeeds.size} publisher feeds to load in background`);

        // Load publisher feeds asynchronously without blocking the UI
        if (publisherFeeds.size > 0) {
          // Don't await this - let it run in background
          RSSParser.parseMultipleFeeds(Array.from(publisherFeeds))
            .then(publisherAlbums => {
              console.log(`🎶 Loaded ${publisherAlbums.length} albums from publisher feeds`);
              
              // Combine with existing albums
              const existingAlbums = albums;
              const existingKeys = new Set(existingAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
              
              const newAlbums = publisherAlbums.filter(album => {
                const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
                return !existingKeys.has(key);
              });
              
              if (newAlbums.length > 0) {
                setAlbums(prev => [...prev, ...newAlbums]);
                console.log(`✅ Added ${newAlbums.length} new albums from publisher feeds`);
              }
            })
            .catch(error => {
              console.warn('⚠️ Failed to load publisher feeds:', error);
            });
        }

        albumsData = regularAlbums;
        console.log(`📦 Total albums after initial load: ${albumsData.length}`);
      } catch (parseError) {
        console.error('❌ Album parsing failed:', parseError);
        console.error('❌ Failed feeds:', allFeeds);
        throw parseError;
      }
      
      console.log('Albums data received:', albumsData);
      
      if (albumsData && albumsData.length > 0) {
        console.log('✅ Setting albums:', albumsData.length, 'albums');
        setAlbums(albumsData);
        console.log('Successfully set', albumsData.length, 'albums');
        
        // Cache albums in localStorage for faster subsequent loads
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('cachedAlbums', JSON.stringify(albumsData));
            localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
            console.log('💾 Cached albums in localStorage');
          } catch (error) {
            console.warn('⚠️ Failed to cache albums:', error);
          }
        }
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

  const playAlbum = (album: RSSAlbum, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the first playable track
    const firstTrack = album.tracks.find(track => track.url);
    
    if (firstTrack && firstTrack.url && audioRef.current) {
      if (currentPlayingAlbum === album.title && isPlaying) {
        // Pause current album
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Play this album
        audioRef.current.src = firstTrack.url;
        audioRef.current.play().then(() => {
          setCurrentPlayingAlbum(album.title);
          setIsPlaying(true);
        }).catch(err => {
          console.error('Error playing audio:', err);
        });
      }
    }
  };

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hidden audio element for main page playback */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentPlayingAlbum(null);
        }}
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
        style={{ display: 'none' }}
      />
      
      {/* Header */}
      <header 
        className="border-b backdrop-blur-sm bg-black/30"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-8">
            {/* Menu Button - Left */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Logo and Title - Centered */}
            <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
              <Image 
                src="/logo.webp" 
                alt="VALUE Logo" 
                width={40} 
                height={40}
                className="object-cover"
                priority
              />
            </div>
            <h1 className="text-4xl font-bold">Into the ValueVerse</h1>
          </div>
          
          {/* Description */}
          <p className="text-gray-400 text-lg mb-4 mt-6">
            This is a demo app I built as the "insert title" project to see what we could do with RSS feeds and music. All data here comes from RSS feeds on{' '}
            <a href="https://podcastindex.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              podcastindex.org
            </a>. This is also a demo of a site for The Doerfels that I added other music I like also and some stuff to help test. -ChadF
          </p>
          
          {/* Loading/Error Status */}
          {isClient && (
            <div className="flex items-center gap-2 text-sm">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  <span className="text-yellow-400">
                    Loading {albums.length > 0 ? `${albums.length} albums` : `${feedUrls.length + customFeeds.length} RSS feeds`}...
                  </span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  <span className="text-red-400">{error}</span>
                </div>
              ) : albums.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-green-400">Loaded {albums.length} albums</span>
                  <button
                    onClick={() => {
                      localStorage.removeItem('cachedAlbums');
                      localStorage.removeItem('albumsCacheTimestamp');
                      setIsLoading(true);
                      loadAlbumsData();
                    }}
                    className="ml-2 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs transition-colors"
                    title="Refresh albums"
                  >
                    🔄
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>
      
      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm transform transition-transform duration-300 z-30 border-r border-gray-700 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 pt-20">
          <h2 className="text-xl font-bold mb-6">Menu</h2>
          
          {/* Add RSS Feed Component */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Add RSS Feed</h3>
            <AddRSSFeed onAddFeed={handleAddFeed} isLoading={isAddingFeed} />
          </div>
          
          {/* Custom Feeds Display */}
          {customFeeds.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3 text-white">Custom RSS Feeds ({customFeeds.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customFeeds.map((feed, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded p-2">
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
          
          {/* Artists with Publisher Feeds */}
          {(() => {
            // Extract unique artists with publisher feeds
            const artistsWithPublishers = albums
              .filter(album => album.publisher && album.publisher.feedGuid)
              .reduce((acc, album) => {
                const key = album.publisher!.feedGuid;
                if (!acc.has(key)) {
                  acc.set(key, {
                    name: album.artist,
                    feedGuid: album.publisher!.feedGuid,
                    albumCount: 1
                  });
                } else {
                  acc.get(key)!.albumCount++;
                }
                return acc;
              }, new Map<string, { name: string; feedGuid: string; albumCount: number }>());

            const artists = Array.from(artistsWithPublishers.values()).sort((a, b) => 
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );

            return artists.length > 0 ? (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                  <span>Artists</span>
                  <span className="text-xs bg-blue-600/80 px-2 py-1 rounded">PC 2.0</span>
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {artists.map((artist) => (
                    <Link
                      key={artist.feedGuid}
                      href={`/publisher/${generatePublisherSlug({ title: artist.name, feedGuid: artist.feedGuid })}`}
                      className="flex items-center justify-between bg-gray-800/30 hover:bg-gray-800/50 rounded p-2 transition-colors group"
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1">
                        {artist.name}
                      </span>
                      <span className="text-xs text-gray-500 group-hover:text-gray-400 ml-2">
                        {artist.albumCount} albums
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
          
          {/* Feed Stats */}
          <div className="text-sm text-gray-400">
            <p>Default feeds: {feedUrls.length}</p>
            <p>Custom feeds: {customFeeds.length}</p>
            <p>Total albums: {albums.length}</p>
          </div>
        </div>
      </div>
      
      {/* Overlay to close sidebar when clicking outside */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
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
                        onClick={(e) => playAlbum(album, e)}
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
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to placeholder on error
                                  const target = e.target as HTMLImageElement;
                                  target.src = getPlaceholderImageUrl('medium');
                                }}
                              />
                              
                              {/* Play Button Overlay - Always Visible */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                                <button
                                  onClick={(e) => playAlbum(album, e)}
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