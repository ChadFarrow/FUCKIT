'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getTrackArtworkUrl, getPlaceholderImageUrl } from '@/lib/cdn-utils';
import { generateAlbumUrl, generatePublisherSlug } from '@/lib/url-utils';
import { RSSParser } from '@/lib/rss-parser';

interface AlbumDetailClientProps {
  albumTitle: string;
  initialAlbum: RSSAlbum | null;
}

export default function AlbumDetailClient({ albumTitle, initialAlbum }: AlbumDetailClientProps) {
  const [album, setAlbum] = useState<RSSAlbum | null>(initialAlbum);
  const [isLoading, setIsLoading] = useState(!initialAlbum);
  const [error, setError] = useState<string | null>(null);
  const [podrollAlbums, setPodrollAlbums] = useState<RSSAlbum[]>([]);
  
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Update Media Session API for iOS lock screen controls
  const updateMediaSession = (track: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: album?.artist || 'Unknown Artist',
        album: album?.title || 'Unknown Album',
        artwork: [
          { src: album?.coverArt || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    }
  };

  const formatDuration = (duration: string): string => {
    if (!duration) return '0:00';
    
    // If already formatted with colon, return as is
    if (duration.includes(':')) return duration;
    
    // If it's just seconds, convert to MM:SS format
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Try to parse other formats and ensure colon format
    return duration;
  };

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio player functions
  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // iOS requires user gesture protection
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Audio playback failed:', error);
      // Handle iOS autoplay rejection silently
    }
  };

  const playTrack = async (index: number) => {
    if (!album || !album.tracks[index] || !album.tracks[index].url || !audioRef.current) return;
    
    try {
      setCurrentTrackIndex(index);
      audioRef.current.src = album.tracks[index].url;
      await audioRef.current.play();
      setIsPlaying(true);
      // Update Media Session for lock screen controls
      updateMediaSession(album.tracks[index]);
    } catch (error) {
      console.error('Audio playback failed:', error);
      setIsPlaying(false);
    }
  };

  const playAlbum = async () => {
    if (album && album.tracks.length > 0) {
      await playTrack(0);
    }
  };

  const nextTrack = async () => {
    if (album && currentTrackIndex < album.tracks.length - 1) {
      await playTrack(currentTrackIndex + 1);
    }
  };

  const prevTrack = async () => {
    if (album && currentTrackIndex > 0) {
      await playTrack(currentTrackIndex - 1);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    // Don't await here to avoid blocking the event handler
    nextTrack();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Load album data if not provided initially
  useEffect(() => {
    if (!initialAlbum) {
      const loadAlbum = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Smart feed selection based on album title
          const decodedAlbumTitle = decodeURIComponent(albumTitle);
          let feedUrls: string[] = [];
          
          // Map album titles to their specific feeds
          const titleToFeedMap: { [key: string]: string } = {
            'into the doerfel-verse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
            'into the doerfelverse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
            'music from the doerfel-verse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
            'music from the doerfelverse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
            'bloodshot lies': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
            'bloodshot lies album': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
            'wrath of banjo': 'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
            'beware of banjo': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/07/Beware-of-Banjo.xml',
            'ben doerfel': 'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
            '18 sundays': 'https://www.doerfelverse.com/feeds/18sundays.xml',
            'alandace': 'https://www.doerfelverse.com/feeds/alandace.xml',
            'autumn': 'https://www.doerfelverse.com/feeds/autumn.xml',
            'christ exalted': 'https://www.doerfelverse.com/feeds/christ-exalted.xml',
            'come back to me': 'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
            'dead time live 2016': 'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
            'dfb v1': 'https://www.doerfelverse.com/feeds/dfbv1.xml',
            'dfb v2': 'https://www.doerfelverse.com/feeds/dfbv2.xml',
            'disco swag': 'https://www.doerfelverse.com/feeds/disco-swag.xml',
            'doerfels pubfeed': 'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
            'first married christmas': 'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
            'generation gap': 'https://www.doerfelverse.com/feeds/generation-gap.xml',
            'heartbreak': 'https://www.doerfelverse.com/feeds/heartbreak.xml',
            'merry christmix': 'https://www.doerfelverse.com/feeds/merry-christmix.xml',
            'middle season let go': 'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
            'phatty the grasshopper': 'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
            'possible': 'https://www.doerfelverse.com/feeds/possible.xml',
            'pour over': 'https://www.doerfelverse.com/feeds/pour-over.xml',
            'psalm 54': 'https://www.doerfelverse.com/feeds/psalm-54.xml',
            'sensitive guy': 'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
            'they dont know': 'https://www.doerfelverse.com/feeds/they-dont-know.xml',
            'think ep': 'https://www.doerfelverse.com/feeds/think-ep.xml',
            'underwater single': 'https://www.doerfelverse.com/feeds/underwater-single.xml',
            'unsound existence': 'https://www.doerfelverse.com/feeds/unsound-existence.xml',
            'you are my world': 'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
            'you feel like home': 'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
            'your chance': 'https://www.doerfelverse.com/feeds/your-chance.xml',
            'nostalgic': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
            'citybeach': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
            'kurtisdrums v1': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
            'ring that bell': 'https://www.thisisjdog.com/media/ring-that-bell.xml',
            'tinderbox': 'https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1',
            'nate johnivan': 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
            'empty passenger seat': 'https://www.wavlake.com/feed/95ea253a-4058-402c-8503-204f6d3f1494',
            'joe martin': 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
            'stay awhile': 'https://ableandthewolf.com/static/media/feed.xml',
            'now i feel it': 'https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now i feel it.xml',
            'they ride': 'https://wavlake.com/feed/music/997060e3-9dc1-4cd8-b3c1-3ae06d54bb03',
            'more': 'https://wavlake.com/feed/music/b54b9a19-b6ed-46c1-806c-7e82f7550edc'
          };
          
          // Convert URL slug back to title format (e.g., "stay-awhile" -> "stay awhile")
          const convertSlugToTitle = (slug: string): string => {
            return slug.replace(/-/g, ' ');
          };
          
          // Try to find a specific feed first
          const titleFromSlug = convertSlugToTitle(decodedAlbumTitle);
          const normalizedTitle = titleFromSlug.toLowerCase();
          const specificFeed = titleToFeedMap[normalizedTitle];
          
          console.log(`🔍 Album lookup: "${decodedAlbumTitle}" → "${titleFromSlug}" → "${normalizedTitle}"`);
          console.log(`📋 Specific feed found:`, specificFeed);
          
          if (specificFeed) {
            feedUrls = [specificFeed];
          } else {
            // Load all feeds to find the album
            feedUrls = [
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
              'https://www.sirtjthewrathful.com/wp-content/uploads/2023/07/Beware-of-Banjo.xml',
              
              // TJ Doerfel projects
              'https://www.thisisjdog.com/media/ring-that-bell.xml',
              
              // External artists
              'https://ableandthewolf.com/static/media/feed.xml',
              'https://static.staticsave.com/mspfiles/deathdreams.xml',
              'https://static.staticsave.com/mspfiles/waytogo.xml',
              'https://feed.falsefinish.club/Vance%20Latta/Vance%20Latta%20-%20Love%20In%20Its%20Purest%20Form/love%20in%20its%20purest%20form.xml',
              'https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now i feel it.xml',
              'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml',
              'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml',
              
              // Wavlake feeds - Nate Johnivan collection
              'https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1',
              'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
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
              
              // Joe Martin (Wavlake) - Complete collection
              'https://www.wavlake.com/feed/95ea253a-4058-402c-8503-204f6d3f1494',
              'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
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
          }
          
          // Parse feeds - RSSParser will handle proxy internally
          const albumsData = await RSSParser.parseMultipleFeeds(feedUrls);
          
          console.log(`📚 Found ${albumsData.length} albums in feeds`);
          console.log(`🔍 Looking for: "${decodedAlbumTitle}"`);
          
          // Debug: Log all found albums
          albumsData.forEach((album, index) => {
            console.log(`📋 Album ${index + 1}: "${album.title}" by ${album.artist}`);
          });
          
          // Check if Generation Gap is in the results
          const hasGenerationGap = albumsData.find(a => a.title.toLowerCase().includes('generation'));
          if (hasGenerationGap) {
            console.log(`✅ Found Generation Gap-like album: "${hasGenerationGap.title}"`);
          } else {
            console.log(`❌ No Generation Gap found in results`);
          }
          
          // Find the matching album with more flexible matching
          const foundAlbum = albumsData.find(a => {
            const albumTitleLower = a.title.toLowerCase();
            const searchTitleLower = decodedAlbumTitle.toLowerCase();
            
            // Special case for "Stay Awhile" - it's its own album from Able and the Wolf
            if (searchTitleLower.includes('stay awhile') && albumTitleLower.includes('stay awhile')) {
              console.log(`🎯 Special match: "Stay Awhile" -> "${a.title}"`);
              return true;
            }
            
            // Exact match
            if (a.title === decodedAlbumTitle || a.title === albumTitle) {
              return true;
            }
            
            // Case-insensitive match
            if (albumTitleLower === searchTitleLower) {
              return true;
            }
            
            // Contains match (search title contains album title or vice versa)
            if (albumTitleLower.includes(searchTitleLower) || searchTitleLower.includes(albumTitleLower)) {
              return true;
            }
            
            // Normalized match (remove special characters)
            const normalizedAlbum = albumTitleLower.replace(/[^a-z0-9]/g, '');
            const normalizedSearch = searchTitleLower.replace(/[^a-z0-9]/g, '');
            if (normalizedAlbum === normalizedSearch) {
              return true;
            }
            
            // Partial normalized match
            if (normalizedAlbum.includes(normalizedSearch) || normalizedSearch.includes(normalizedAlbum)) {
              return true;
            }
            
            return false;
          });
          
          if (foundAlbum) {
            // Custom track ordering for concept albums
            let processedAlbum = { ...foundAlbum };
            
            // Fix track order for "They Ride" by IROH (concept album)
            if (foundAlbum.title.toLowerCase() === 'they ride' && foundAlbum.artist.toLowerCase() === 'iroh') {
              console.log('🎵 Applying custom track order for "They Ride" concept album');
              
              // Define the correct track order from YouTube Music (using exact RSS feed titles)
              const correctTrackOrder = [
                '-',
                'Heaven Knows', 
                '....',
                'The Fever',
                '.',
                'In Exile',
                '-.--',
                'The Seed Man',
                '.-.',
                'Renfield',
                '..',
                'They Ride',
                '-..',
                'Pedal Down ( feat. Rob Montgomery )',
                '. ( The Last Transmission? )'
              ];
              
              // Sort tracks by the correct order with better matching
              processedAlbum.tracks = foundAlbum.tracks.sort((a, b) => {
                const aTitle = a.title.toLowerCase().trim();
                const bTitle = b.title.toLowerCase().trim();
                
                const aIndex = correctTrackOrder.findIndex(title => {
                  const correctTitle = title.toLowerCase().trim();
                  return aTitle === correctTitle || 
                         aTitle.includes(correctTitle) || 
                         correctTitle.includes(aTitle) ||
                         aTitle.replace(/[^a-z0-9]/g, '') === correctTitle.replace(/[^a-z0-9]/g, '');
                });
                
                const bIndex = correctTrackOrder.findIndex(title => {
                  const correctTitle = title.toLowerCase().trim();
                  return bTitle === correctTitle || 
                         bTitle.includes(correctTitle) || 
                         correctTitle.includes(bTitle) ||
                         bTitle.replace(/[^a-z0-9]/g, '') === correctTitle.replace(/[^a-z0-9]/g, '');
                });
                
                console.log(`🔍 Track sorting: "${a.title}" -> index ${aIndex}, "${b.title}" -> index ${bIndex}`);
                
                // If both found, sort by index
                if (aIndex !== -1 && bIndex !== -1) {
                  return aIndex - bIndex;
                }
                // If only one found, prioritize it
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                // If neither found, keep original order
                return 0;
              });
              
              console.log('✅ Track order corrected for "They Ride"');
            }
            
            setAlbum(processedAlbum);
            // Load PodRoll albums if they exist
            if (foundAlbum.podroll && foundAlbum.podroll.length > 0) {
              loadPodrollAlbums(foundAlbum.podroll);
            }
            // Load Publisher feed albums if publisher exists
            if (foundAlbum.publisher && foundAlbum.publisher.feedUrl) {
              loadPublisherAlbums(foundAlbum.publisher.feedUrl);
            }
          } else {
            setError('Album not found');
          }
        } catch (err) {
          console.error('Error loading album:', err);
          setError('Error loading album data');
        } finally {
          setIsLoading(false);
        }
      };

      loadAlbum();
    } else {
      // Load PodRoll albums if they exist
      if (initialAlbum.podroll && initialAlbum.podroll.length > 0) {
        loadPodrollAlbums(initialAlbum.podroll);
      }
      // Load Publisher feed albums if publisher exists
      if (initialAlbum.publisher && initialAlbum.publisher.feedUrl) {
        loadPublisherAlbums(initialAlbum.publisher.feedUrl);
      }
    }
  }, [albumTitle, initialAlbum]);

  const loadPodrollAlbums = async (podrollItems: { url: string; title?: string; description?: string }[]) => {
    try {
      const podrollUrls = podrollItems.map(item => item.url);
      const podrollAlbumsData = await RSSParser.parseMultipleFeeds(podrollUrls);
      setPodrollAlbums(podrollAlbumsData);
    } catch (err) {
      console.error('Error loading PodRoll albums:', err);
    }
  };

  const loadPublisherAlbums = async (publisherFeedUrl: string) => {
    try {
      console.log(`🏢 Loading albums from publisher feed: ${publisherFeedUrl}`);
      const publisherAlbumsData = await RSSParser.parsePublisherFeedAlbums(publisherFeedUrl);
      
      // Add publisher albums to podroll albums (they're displayed in the same section)
      setPodrollAlbums(prevAlbums => {
        // Combine and deduplicate based on title+artist
        const combined = [...prevAlbums];
        const existingKeys = new Set(prevAlbums.map(album => `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`));
        
        publisherAlbumsData.forEach(album => {
          const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
          if (!existingKeys.has(key)) {
            combined.push(album);
            existingKeys.add(key);
          }
        });
        
        console.log(`🎶 Added ${publisherAlbumsData.length} albums from publisher, total recommendations: ${combined.length}`);
        return combined;
      });
    } catch (err) {
      console.error('Error loading Publisher albums:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold">Loading Album...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{error || 'Album Not Found'}</h1>
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
        background: album?.coverArt 
          ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('${album.coverArt}') center/cover fixed`
          : 'linear-gradient(to br, rgb(17, 24, 39), rgb(31, 41, 55), rgb(17, 24, 39))'
      }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
      />

      <div className="container mx-auto px-6 py-8 pb-32">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Albums
        </Link>

        {/* Album Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-shrink-0 relative group">
            <Image 
              src={getAlbumArtworkUrl(album.coverArt || '', 'large')} 
              alt={album.title}
              width={320}
              height={320}
              className="rounded-lg object-cover shadow-2xl"
              onError={(e) => {
                // Fallback to placeholder on error
                const target = e.target as HTMLImageElement;
                target.src = getPlaceholderImageUrl('large');
              }}
            />
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
              <button
                onClick={playAlbum}
                className="bg-white/80 hover:bg-white text-black rounded-full p-4 transform hover:scale-110 transition-all duration-200 shadow-lg"
              >
                {isPlaying && currentTrackIndex === 0 ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
            <p className="text-xl text-gray-400 mb-4">{album.artist}</p>
            
            {album.subtitle && (
              <p className="text-lg text-gray-300 mb-4 italic">{album.subtitle}</p>
            )}
            
            {(album.summary || album.description) && (
              <p className="text-gray-300 mb-6">{album.summary || album.description}</p>
            )}
            
            <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
              <span>{new Date(album.releaseDate).getFullYear()}</span>
              <span>{album.tracks.length} tracks</span>
              {album.explicit && <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">EXPLICIT</span>}
            </div>

            {/* Publisher Information */}
            {album.publisher && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>More from this artist:</span>
                  <Link
                    href={`/publisher/${generatePublisherSlug({ feedGuid: album.publisher.feedGuid })}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Discography
                  </Link>
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded">PC 2.0</span>
                </div>
              </div>
            )}

            {/* Funding Information */}
            {album.funding && album.funding.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-white">Support This Artist</h3>
                <div className="flex flex-wrap gap-3">
                  {album.funding.map((funding, index) => (
                    <a
                      key={index}
                      href={funding.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      💝 {funding.message || 'Support'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          <div className="space-y-2">
            {album.tracks.map((track, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-3 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
                  currentTrackIndex === index ? 'bg-white/20' : ''
                }`}
                onClick={() => playTrack(index)}
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    {track.image ? (
                      <Image 
                        src={track.image} 
                        alt={track.title}
                        width={48}
                        height={48}
                        className="rounded object-cover"
                        onError={(e) => {
                          // Fallback to track number on error
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={`text-gray-400 text-sm w-8 text-center ${track.image ? 'hidden' : ''}`}>
                      {track.trackNumber || index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{track.title}</p>
                    {track.subtitle && (
                      <p className="text-sm text-gray-400 italic">{track.subtitle}</p>
                    )}
                    <p className="text-sm text-gray-400">{album.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {track.explicit && (
                    <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                      E
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    {formatDuration(track.duration)}
                  </span>
                  <button 
                    className="text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTrack(index);
                    }}
                  >
                    {currentTrackIndex === index && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PodRoll and Publisher Recommendations */}
        {podrollAlbums.length > 0 && (
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">You Might Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {podrollAlbums.map((podrollAlbum, index) => (
                <Link
                  key={index}
                  href={generateAlbumUrl(podrollAlbum.title)}
                  className="group block"
                >
                  <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all duration-200 hover:scale-105">
                    <div className="aspect-square relative mb-3">
                      <Image 
                        src={getAlbumArtworkUrl(podrollAlbum.coverArt || '', 'thumbnail')} 
                        alt={podrollAlbum.title}
                        width={150}
                        height={150}
                        className="w-full h-full object-cover rounded-md"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          const target = e.target as HTMLImageElement;
                          target.src = getPlaceholderImageUrl('thumbnail');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-md transition-all duration-200 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {podrollAlbum.title}
                    </h3>
                    <p className="text-gray-400 text-xs">
                      {podrollAlbum.artist}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Audio Player Bar */}
      {album.tracks.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-gray-700 p-4">
          <div className="container mx-auto flex items-center gap-4">
            {/* Current Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Image 
                src={getAlbumArtworkUrl(album.coverArt || '', 'thumbnail')} 
                alt={album.title}
                width={48}
                height={48}
                className="rounded object-cover"
                onError={(e) => {
                  // Fallback to placeholder on error
                  const target = e.target as HTMLImageElement;
                  target.src = getPlaceholderImageUrl('thumbnail');
                }}
              />
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {album.tracks[currentTrackIndex]?.title || 'No track selected'}
                </p>
                <p className="text-sm text-gray-400 truncate">{album.artist}</p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-4">
              <button 
                onClick={prevTrack}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={currentTrackIndex === 0}
              >
                <SkipBack className="h-5 w-5" />
              </button>
              
              <button 
                onClick={togglePlay}
                className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              
              <button 
                onClick={nextTrack}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={currentTrackIndex === album.tracks.length - 1}
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 