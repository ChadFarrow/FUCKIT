import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAlbumSlug } from '@/lib/url-utils';
import { HGH_ARTWORK_URL_MAP } from '@/data/hgh-artwork-urls';
import { resolveArtworkFromPodcastIndex } from '@/lib/podcast-index-api';

// Cache the parsed data to avoid reading the file on every request
let cachedData: any = null;
let cachedMusicTracks: any = null;
let cachedHGHSongs: any = null;
let cachedProcessedAlbums: any = null; // Cache processed albums - cleared for deduplication
const PROCESSED_CACHE_VERSION = 'v2-dedup'; // Increment to invalidate cache when logic changes
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tier = searchParams.get('tier') || 'all';
    const feedId = searchParams.get('feedId');
    const filter = searchParams.get('filter') || 'all'; // albums, eps, singles, all
    
    // Use cache for better performance
    const now = Date.now();
    const shouldUseCache = cachedData && cachedMusicTracks && (now - cacheTimestamp) < CACHE_DURATION;
    
    // Early return with cached processed albums if available and no specific filtering
    // Note: Cache is invalidated when deduplication logic changes via PROCESSED_CACHE_VERSION
    if (shouldUseCache && cachedProcessedAlbums && tier === 'all' && !feedId) {
      console.log(`⚡ Fast path: Using cached processed albums (${cachedProcessedAlbums.length} albums)`);
      
      // Verify cached albums have publisher data
      const albumsWithPublishers = cachedProcessedAlbums.filter((album: any) => album.publisher && album.publisher.feedGuid);
      console.log(`📊 Fast path cache contains ${albumsWithPublishers.length} albums with publisher data`);
      
      // Apply filtering and pagination on cached data
      let filteredAlbums = cachedProcessedAlbums;
      if (filter !== 'all') {
        switch (filter) {
          case 'albums':
            filteredAlbums = cachedProcessedAlbums.filter((album: any) => album.tracks.length > 6);
            break;
          case 'eps':
            filteredAlbums = cachedProcessedAlbums.filter((album: any) => album.tracks.length > 1 && album.tracks.length <= 6);
            break;
          case 'singles':
            filteredAlbums = cachedProcessedAlbums.filter((album: any) => album.tracks.length === 1);
            break;
          case 'playlist':
            filteredAlbums = cachedProcessedAlbums.filter((album: any) => 
              album.podroll || 
              (album.tracks.length > 1 && new Set(album.tracks.map((t: any) => t.artist || album.artist)).size > 1)
            );
            break;
        }
      }
      
      const totalCount = filteredAlbums.length;
      const paginatedAlbums = limit === 0 ? filteredAlbums.slice(offset) : filteredAlbums.slice(offset, offset + limit);
      
      // Pre-compute publisher statistics for fast path too
      const publisherStats = new Map<string, { name: string; feedGuid: string; albumCount: number }>();
      
      filteredAlbums
        .filter((album: any) => {
          const artistName = album.artist && typeof album.artist === 'string' ? album.artist.toLowerCase() : '';
          return album.publisher && album.publisher.feedGuid &&
                 !artistName.includes('doerfel') && 
                 !artistName.includes('ben doerfel') && 
                 !artistName.includes('sirtj') &&
                 !artistName.includes('shredward') &&
                 !artistName.includes('tj doerfel');
        })
        .forEach((album: any) => {
          const key = album.publisher!.feedGuid;
          if (!publisherStats.has(key)) {
            publisherStats.set(key, {
              name: album.artist,
              feedGuid: album.publisher!.feedGuid,
              albumCount: 1
            });
          } else {
            publisherStats.get(key)!.albumCount++;
          }
        });

      const publisherStatsArray = Array.from(publisherStats.values()).sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      
      return NextResponse.json({
        albums: paginatedAlbums,
        totalCount,
        hasMore: limit === 0 ? false : offset + limit < totalCount,
        offset,
        limit,
        publisherStats: publisherStatsArray,
        lastUpdated: new Date(cacheTimestamp).toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
          'Content-Type': 'application/json',
          'ETag': `"${cacheTimestamp}-${totalCount}"`
        }
      });
    }
    
    if (shouldUseCache) { // Use cache when available
      console.log(`Using cached data: ${cachedData?.feeds?.length || 0} feeds, ${cachedMusicTracks?.length || 0} music tracks`);
    } else {
      const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
      const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');
      
      // Initialize empty data if parsed feeds don't exist (music-only mode)
      let parsedFeedsData = { feeds: [] };
      if (fs.existsSync(parsedFeedsPath)) {
        const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
        parsedFeedsData = JSON.parse(fileContent);
      } else {
        console.log('No parsed feeds found - using music tracks only');
      }

      if (!fs.existsSync(musicTracksPath)) {
        console.warn('Music tracks data not found at:', musicTracksPath);
        return NextResponse.json({ 
          albums: [], 
          totalCount: 0, 
          lastUpdated: new Date().toISOString(),
          error: 'Music tracks data not found' 
        }, { status: 404 });
      }

      const musicTracksContent = fs.readFileSync(musicTracksPath, 'utf-8');
      
      // HGH songs are now integrated into music-tracks.json
      let hghSongsContent = '[]';
      
      // Validate JSON before parsing
      try {
        cachedData = parsedFeedsData;
        const musicTracksParsed = JSON.parse(musicTracksContent);
        cachedHGHSongs = JSON.parse(hghSongsContent);
        
        // Extract the musicTracks array from the parsed data
        if (musicTracksParsed && musicTracksParsed.musicTracks && Array.isArray(musicTracksParsed.musicTracks)) {
          cachedMusicTracks = musicTracksParsed.musicTracks;
          console.log(`✅ Loaded ${cachedMusicTracks.length} music tracks from music-tracks.json`);
        } else {
          console.warn('Invalid music tracks data structure:', musicTracksParsed);
          cachedMusicTracks = [];
        }
        
        console.log(`✅ HGH songs now integrated into music tracks database`);
        
        cacheTimestamp = now;
        console.log('Refreshed cached data');
      } catch (parseError) {
        console.error('Failed to parse data files:', parseError);
        return NextResponse.json({ 
          albums: [], 
          totalCount: 0, 
          lastUpdated: new Date().toISOString(),
          error: 'Invalid JSON in data files' 
        }, { status: 500 });
      }
    }
    
    let parsedData = cachedData;
    
    // Validate data structure
    if (!parsedData || !Array.isArray(parsedData.feeds)) {
      console.warn('Invalid parsed feeds data structure:', parsedData);
      return NextResponse.json({ 
        albums: [], 
        totalCount: 0, 
        lastUpdated: new Date().toISOString(),
        error: 'Invalid data structure' 
      }, { status: 500 });
    }
    
    // Extract albums from parsed feeds with proper type checking and working album art
    let albums = parsedData.feeds
      .filter((feed: any) => feed.parseStatus === 'success' && feed.parsedData?.album)
      .map((feed: any) => {
        const album = feed.parsedData.album;
        
        // Ensure all string fields are properly typed
        const title = typeof album.title === 'string' ? album.title : '';
        const description = typeof album.description === 'string' ? album.description : '';
        let coverArt = typeof album.coverArt === 'string' ? album.coverArt : '';
        
        // Extract artist with improved logic - prefer album artist first, then track artists
        let artist = 'Unknown Artist';
        if (album.artist && typeof album.artist === 'string' && album.artist.trim() !== '') {
          artist = album.artist;
        } else if (album.tracks && Array.isArray(album.tracks)) {
          // Extract from track data if album artist is missing
          for (const track of album.tracks) {
            if (track.artist && track.artist.trim() !== '') {
              artist = track.artist;
              break;
            }
          }
        }
        // Fallback to album title if no artist found
        if (artist === 'Unknown Artist') {
          artist = title;
        }
        
        // Fix known incorrect artwork assignments in the data
        const artworkFixes: Record<string, string> = {
          'Rock\'n\'Roll Breakheart': 'https://rocknrollbreakheart.com/album-art.jpg',
          'Bestlegs': 'https://www.doerfelverse.com/art/bestlegs.png',
          'Satoshi Streamer': 'https://www.doerfelverse.com/art/satoshi-streamer.png',
          // Add more fixes as needed
        };
        
        // Apply artwork fix if this album has a known issue
        if (artworkFixes[title] && coverArt.includes('carol-of-the-bells')) {
          coverArt = artworkFixes[title];
          console.log(`Fixed incorrect artwork for "${title}"`);
        }
        
        // Check if this track has HGH artwork mapping
        if (HGH_ARTWORK_URL_MAP[title]) {
          coverArt = HGH_ARTWORK_URL_MAP[title];
          console.log(`Using HGH artwork mapping for "${title}": ${coverArt}`);
        }
        // Also check if the current coverArt is from homegrownhits.xyz (which are broken)
        else if (coverArt && coverArt.includes('homegrownhits.xyz/wp-content/uploads/')) {
          // Try to find a mapping for this title
          if (HGH_ARTWORK_URL_MAP[title]) {
            coverArt = HGH_ARTWORK_URL_MAP[title];
            console.log(`Replaced broken homegrownhits.xyz URL for "${title}" with: ${coverArt}`);
          } else {
            // Try to use the first track's image as fallback for broken HGH URLs
            const firstTrackWithImage = album.tracks?.find((track: any) => track.image && track.image.trim() !== '' && !track.image.includes('homegrownhits.xyz'));
            if (firstTrackWithImage) {
              coverArt = firstTrackWithImage.image;
              console.log(`Using first track image as fallback for broken HGH URL "${title}"`);
            } else {
              // Clear the broken URL to use placeholder
              coverArt = '';
              console.log(`Cleared broken homegrownhits.xyz URL for "${title}"`);
            }
          }
        }
        // Provide fallback artwork for albums with missing coverArt
        else if (!coverArt || coverArt.trim() === '') {
          // Try to use the first track's image as fallback
          const firstTrackWithImage = album.tracks?.find((track: any) => track.image && track.image.trim() !== '' && !track.image.includes('homegrownhits.xyz'));
          if (firstTrackWithImage) {
            coverArt = firstTrackWithImage.image;
            console.log(`Using first track image as fallback for "${title}": ${coverArt}`);
          } else {
            // For albums with no artwork, generate a placeholder URL based on title
            // This will be handled by the CDNImage component to show a nice placeholder
            coverArt = `/api/placeholder-image?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
            console.log(`Using placeholder artwork for "${title}"`);
          }
        }
        
        return {
          id: generateAlbumSlug(title),
          title,
          artist,
          description,
          coverArt,
          tracks: (album.tracks || []).map((track: any) => ({
            title: typeof track.title === 'string' ? track.title : '',
            duration: typeof track.duration === 'string' ? track.duration : '0:00',
            url: typeof track.url === 'string' ? track.url : '',
            trackNumber: typeof track.trackNumber === 'number' ? track.trackNumber : 0,
            subtitle: typeof track.subtitle === 'string' ? track.subtitle : '',
            summary: typeof track.summary === 'string' ? track.summary : '',
            image: typeof track.image === 'string' ? track.image : '',
            explicit: typeof track.explicit === 'boolean' ? track.explicit : false,
            keywords: Array.isArray(track.keywords) ? track.keywords.filter((k: any) => typeof k === 'string') : []
          })),
          podroll: album.podroll || null,
          publisher: album.publisher || null,
          funding: album.funding || null,
          feedId: typeof feed.id === 'string' ? feed.id : '',
          feedUrl: typeof feed.originalUrl === 'string' ? feed.originalUrl : '',
          lastUpdated: typeof feed.lastParsed === 'string' ? feed.lastParsed : new Date().toISOString()
        };
      });

    // Apply filtering by tier if specified
    if (tier !== 'all') {
      try {
        const feedsResponse = await fetch(`${request.headers.get('origin') || 'http://localhost:3000'}/api/feeds`);
        if (feedsResponse.ok) {
          const feedsConfig = await feedsResponse.json();
          const tierFeedIds = new Set(
            feedsConfig[tier]?.map((feed: any) => feed.id) || []
          );
          albums = albums.filter((album: any) => tierFeedIds.has(album.feedId));
        }
      } catch (error) {
        console.warn('Failed to load feeds configuration for tier filtering:', error);
      }
    }

    // Apply feed ID filtering if specified
    if (feedId) {
      albums = albums.filter((album: any) => album.feedId === feedId);
    }

    // Deduplicate albums with improved logic
    const albumMap = new Map<string, any>();
    albums.forEach((album: any) => {
      // Normalize the title and artist for better deduplication
      const normalizedTitle = album.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, ''); // Remove special characters
      
      const normalizedArtist = album.artist
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, ''); // Remove special characters
      
      const key = `${normalizedTitle}|${normalizedArtist}`;
      
      // If we already have this album, keep the one with better data
      if (albumMap.has(key)) {
        const existing = albumMap.get(key);
        // Keep the one with more tracks or better cover art
        if (album.tracks.length > existing.tracks.length || 
            (!existing.coverArt && album.coverArt) ||
            (album.coverArt && !album.coverArt.includes('placeholder') && existing.coverArt?.includes('placeholder'))) {
          albumMap.set(key, album);
        }
      } else {
        albumMap.set(key, album);
      }
    });
    
    // ALSO add albums from music-tracks.json that aren't in parsed feeds
    console.log('🎵 Adding albums from music-tracks.json...');
    
    // Group music tracks by feedGuid to create albums
    const musicAlbumGroups = new Map<string, any>();
    
    cachedMusicTracks.forEach((track: any) => {
      const key = track.feedGuid || 'unknown';
      if (!musicAlbumGroups.has(key)) {
        musicAlbumGroups.set(key, {
          feedGuid: track.feedGuid,
          feedTitle: track.feedTitle,
          feedImage: track.feedImage || track.image,
          feedUrl: track.feedUrl,
          tracks: []
        });
      }
      musicAlbumGroups.get(key).tracks.push(track);
    });
    
    // Load publisher feeds data to match with music tracks
    let publisherFeeds: any[] = [];
    let publisherMappings: any = {};
    try {
      const publisherFeedsPath = path.join(process.cwd(), 'data', 'publisher-feed-results.json');
      if (fs.existsSync(publisherFeedsPath)) {
        const publisherFeedsContent = fs.readFileSync(publisherFeedsPath, 'utf-8');
        publisherFeeds = JSON.parse(publisherFeedsContent);
        console.log(`✅ Loaded ${publisherFeeds.length} publisher feeds for matching`);
      }
      
      // Load manual publisher mappings for better coverage
      const publisherMappingsPath = path.join(process.cwd(), 'data', 'publisher-mappings-manual.json');
      if (fs.existsSync(publisherMappingsPath)) {
        publisherMappings = JSON.parse(fs.readFileSync(publisherMappingsPath, 'utf-8'));
        console.log(`✅ Loaded manual publisher mappings`);
      }
    } catch (error) {
      console.warn('Failed to load publisher data:', error);
    }
    
    // Convert music track groups to album format
    const musicAlbums = Array.from(musicAlbumGroups.values()).map((group: any) => {
      // Skip if this feed URL is already in parsed feeds (to avoid duplicates)
      const isDuplicate = albums.some((album: any) => album.feedUrl === group.feedUrl);
      if (isDuplicate) return null;
      
      // Create album from music track group
      const firstTrack = group.tracks[0];
      const albumTitle = group.feedTitle || 'Unknown Album';
      
      // Manual mapping for known collaborative albums and complex cases
      const artistMappings: Record<string, string> = {
        'Everything Is Lit': 'Fletcher and Blaney',
        'Stay Awhile': 'Able and the Wolf',
        'The HeyCitizen Experience': 'HeyCitizen',
        "HeyCitizen's Lo-Fi Hip-Hop Beats to Study and Relax to": 'HeyCitizen',
        'Music From The Doerfel-Verse': 'Various Artists',
        'Homegrown Hits Vol. I': 'Various Artists',
        'CityBeach': 'SirTJ The Wrathful',
        'Kurtisdrums': 'SirTJ The Wrathful',
        'So Far Away': 'SirTJ The Wrathful',
        'Nostalgic': 'SirTJ The Wrathful',
        // Additional mappings from RSS feeds
        'Millennium': 'The Trusted',
        'Mine Enemy': 'Hurling Pixels', 
        'Money Maker': 'Two Weeks In Nashville',
        'Mixed': 'Mixed',
        'Mrs Valentine': 'Mrs Valentine',
        'My Love': 'Hurling Pixels',
        'More of Their Lies': 'More of Their Lies',
        'My Crutch - Live from Bands at Bitcoin': 'My Crutch'
      };
      
      // Extract artist from track data with smarter detection
      let artist = artistMappings[albumTitle] || 'Unknown Artist';
      
      // If no manual mapping, try to find a track artist that's different from the album title
      if (!artistMappings[albumTitle]) {
        for (const track of group.tracks) {
          if (track.artist && track.artist.trim() !== '' && track.artist !== albumTitle) {
            artist = track.artist;
            break;
          }
        }
      }
      
      // If no different artist found, look for patterns in album title that suggest artist name
      if (artist === 'Unknown Artist') {
        // Check for " - " pattern (Artist - Album)
        if (albumTitle.includes(' - ')) {
          const parts = albumTitle.split(' - ');
          if (parts.length >= 2) {
            artist = parts[0].trim();
          }
        }
        // Check for "feat." pattern
        else if (albumTitle.includes(' feat.') || albumTitle.includes(' featuring ')) {
          const featMatch = albumTitle.match(/^(.+?)\s+(?:feat\.|featuring)\s+(.+)$/i);
          if (featMatch) {
            artist = featMatch[1].trim();
          }
        }
        // Use any track artist even if it matches album title (better than "Unknown Artist")
        else {
          for (const track of group.tracks) {
            if (track.artist && track.artist.trim() !== '') {
              artist = track.artist;
              break;
            }
          }
        }
      }
      
      // Final fallback - avoid showing identical artist and album names
      if (artist === 'Unknown Artist') {
        // Check if this is likely a single track vs full album
        const trackCount = group.tracks.length;
        const isSingle = trackCount === 1;
        const hasCompilationKeywords = albumTitle.toLowerCase().includes('various') || 
                                      albumTitle.toLowerCase().includes('compilation') ||
                                      albumTitle.toLowerCase().includes('collection') ||
                                      albumTitle.toLowerCase().includes('sampler');
        
        if (isSingle && !hasCompilationKeywords) {
          // For single tracks, use the album title as artist (self-titled)
          artist = albumTitle;
        } else if (hasCompilationKeywords) {
          // Only use "Various Artists" for actual compilation albums
          artist = 'Various Artists';
        } else {
          // For albums with multiple tracks, try to extract artist from title
          if (albumTitle.includes(' - ')) {
            // Try "Artist - Album" format
            const parts = albumTitle.split(' - ');
            artist = parts[0].trim();
          } else if (!albumTitle.includes(' ')) {
            // Single word - likely self-titled
            artist = albumTitle;
          } else {
            // Multi-word album - use as is rather than "Various Artists"
            artist = albumTitle;
          }
        }
      }
      
      // Debug log for albums with potential duplicates
      if (['Tinderbox', 'Fight!', 'it can be erased', 'Everything Is Lit', 'Kurtisdrums', 'Live From the Other Side', 'Music From The Doerfel-Verse'].includes(albumTitle)) {
        const originalTracks = group.tracks.length;
        const deduplicatedTracks = group.tracks.filter((track: any, index: number, array: any[]) => {
          const title = track.title || 'Untitled';
          
          // Find all tracks with the same title
          const sameTitle = array.filter(t => (t.title || 'Untitled') === title);
          
          // If only one track with this title, keep it
          if (sameTitle.length === 1) return true;
          
          // If multiple tracks with same title, prefer the one with a URL
          const withUrl = sameTitle.find(t => t.enclosureUrl && t.enclosureUrl.trim() !== '');
          if (withUrl) {
            return track === withUrl;
          }
          
          // If none have URLs, keep the first occurrence
          return array.findIndex(t => (t.title || 'Untitled') === title) === index;
        });
        console.log(`🎵 DEBUG ${albumTitle}: ${originalTracks} original tracks → ${deduplicatedTracks.length} deduplicated tracks`);
        if (originalTracks !== deduplicatedTracks.length) {
          console.log(`🔄 Removed ${originalTracks - deduplicatedTracks.length} duplicate tracks from "${albumTitle}"`);
        }
      }
      
      // Try to find matching publisher feed for this album/artist
      let publisher = null;
      
      // First check manual publisher mappings
      const albumGuid = group.feedGuid || group.feedUrl?.split('/').pop();
      for (const [publisherGuid, publisherData] of Object.entries(publisherMappings)) {
        if ((publisherData as any).albumGuids?.includes(albumGuid)) {
          publisher = {
            feedGuid: publisherGuid,
            feedUrl: (publisherData as any).feedUrl,
            title: (publisherData as any).name,
            artistImage: null
          };
          console.log(`📍 Matched "${albumTitle}" to publisher "${(publisherData as any).name}" via manual mapping`);
          break;
        }
      }
      
      // If no manual match, try existing matching logic
      if (!publisher && publisherFeeds.length > 0) {
        // Try to match by artist name (most reliable for Wavlake structure)
        const matchByArtist = publisherFeeds.find((pubFeed: any) => {
          const pubTitle = pubFeed.title?.replace('<![CDATA[', '').replace(']]>', '') || '';
          // Exact match first
          if (pubTitle.toLowerCase() === artist.toLowerCase()) {
            console.log(`🎭 Matched "${albumTitle}" to publisher "${pubTitle}" (exact match)`);
            return true;
          }
          // Partial match
          if (pubTitle.toLowerCase().includes(artist.toLowerCase()) || 
              artist.toLowerCase().includes(pubTitle.toLowerCase())) {
            console.log(`🎭 Matched "${albumTitle}" to publisher "${pubTitle}" (partial match)`);
            return true;
          }
          return false;
        });
        
        if (matchByArtist) {
          // Extract the artist GUID from the publisher feed URL
          const artistGuid = matchByArtist.feed.originalUrl.split('/').pop() || '';
          
          publisher = {
            feedGuid: artistGuid,
            feedUrl: matchByArtist.feed.originalUrl,
            title: matchByArtist.title?.replace('<![CDATA[', '').replace(']]>', '') || artist,
            artistImage: matchByArtist.itunesImage || null
          };
          console.log(`🎭 Matched "${albumTitle}" to publisher "${publisher.title}" (${artistGuid})`);
        } else {
          // Try to match by checking if any track came from a discoveredFrom feed that might be related
          const firstTrack = group.tracks[0];
          if (firstTrack.feedUrl) {
            // Extract the album GUID from the track's feed URL  
            const albumGuid = firstTrack.feedUrl.split('/').pop();
            
            // Check if any publisher feed "discovered" this album
            const matchByDiscovery = publisherFeeds.find((pubFeed: any) => 
              pubFeed.discoveredFrom && pubFeed.discoveredFrom.includes(albumGuid)
            );
            
            if (matchByDiscovery) {
              const artistGuid = matchByDiscovery.feed.originalUrl.split('/').pop() || '';
              
              publisher = {
                feedGuid: artistGuid,
                feedUrl: matchByDiscovery.feed.originalUrl,
                title: matchByDiscovery.title?.replace('<![CDATA[', '').replace(']]>', '') || artist,
                artistImage: matchByDiscovery.itunesImage || null
              };
              console.log(`🔗 Matched "${albumTitle}" to publisher "${publisher.title}" by discovery link`);
            }
          }
        }
      }
      
      return {
        id: generateAlbumSlug(albumTitle),
        title: albumTitle,
        artist: artist,
        description: firstTrack.description || '',
        coverArt: group.feedImage || firstTrack.image || `/api/placeholder-image?title=${encodeURIComponent(albumTitle)}&artist=${encodeURIComponent(artist)}`,
        tracks: group.tracks
          // Deduplicate tracks by title (prioritize tracks with URLs)
          .filter((track: any, index: number, array: any[]) => {
            const title = track.title || 'Untitled';
            
            // Find all tracks with the same title
            const sameTitle = array.filter(t => (t.title || 'Untitled') === title);
            
            // If only one track with this title, keep it
            if (sameTitle.length === 1) return true;
            
            // If multiple tracks with same title, prefer the one with a URL
            const withUrl = sameTitle.find(t => t.enclosureUrl && t.enclosureUrl.trim() !== '');
            if (withUrl) {
              return track === withUrl;
            }
            
            // If none have URLs, keep the first occurrence
            return array.findIndex(t => (t.title || 'Untitled') === title) === index;
          })
          .map((track: any, index: number) => {
          // Remove OP3.dev tracking wrapper from URLs
          let cleanUrl = track.enclosureUrl || '';
          if (cleanUrl.includes('op3.dev/')) {
            // Extract the original URL from OP3.dev wrapper
            const urlMatch = cleanUrl.match(/https:\/\/op3\.dev\/[^\/]+\/(https?:\/\/.+)/);
            if (urlMatch) {
              cleanUrl = urlMatch[1];
              console.log(`🚫 Removed OP3.dev tracking from URL: ${cleanUrl}`);
            }
          }
          
          return {
            title: track.title || 'Untitled',
            duration: track.duration ? Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : '0:00',
            url: cleanUrl,
            trackNumber: index + 1,
            subtitle: '',
            summary: track.description || '',
            image: track.image || group.feedImage || '',
            explicit: track.explicit || false,
            keywords: []
          };
        }),
        podroll: null,
        publisher: publisher, // Now includes publisher info when matched
        funding: firstTrack.value ? { 
          type: 'lightning', 
          destinations: firstTrack.value.destinations || [] 
        } : null,
        feedId: group.feedGuid || 'music-' + generateAlbumSlug(albumTitle),
        feedUrl: group.feedUrl || '',
        lastUpdated: new Date(firstTrack.datePublished * 1000 || Date.now()).toISOString()
      };
    }).filter((album: any) => album !== null); // Remove null entries (duplicates)
    
    console.log(`✅ Added ${musicAlbums.length} albums from music tracks`);
    
    // Merge with existing albums
    albums = [...albums, ...musicAlbums];
    
    // Re-run deduplication on the combined albums list
    const finalAlbumMap = new Map<string, any>();
    albums.forEach((album: any) => {
      // Normalize the title and artist for better deduplication
      const normalizedTitle = album.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, ''); // Remove special characters
      
      const normalizedArtist = album.artist
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, ''); // Remove special characters
      
      const key = `${normalizedTitle}|${normalizedArtist}`;
      
      // If we already have this album, keep the one with better data
      if (finalAlbumMap.has(key)) {
        const existing = finalAlbumMap.get(key);
        // Keep the one with more tracks or better cover art
        if (album.tracks.length > existing.tracks.length || 
            (!existing.coverArt && album.coverArt) ||
            (album.coverArt && !album.coverArt.includes('placeholder') && existing.coverArt?.includes('placeholder'))) {
          finalAlbumMap.set(key, album);
        }
      } else {
        finalAlbumMap.set(key, album);
      }
    });
    
    const uniqueAlbums = Array.from(finalAlbumMap.values());
    
    // Sort albums by type: Albums first (7+ tracks), then EPs (2-6 tracks), then Singles (1 track)
    // Each group sorted alphabetically by title
    const sortedUniqueAlbums = [
      ...uniqueAlbums.filter(album => album.tracks.length > 6)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
      ...uniqueAlbums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
      ...uniqueAlbums.filter(album => album.tracks.length === 1)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
    ];
    
    // Cache the processed and sorted albums for future fast access
    if (tier === 'all' && !feedId) {
      cachedProcessedAlbums = sortedUniqueAlbums;
      console.log(`💾 Cached ${sortedUniqueAlbums.length} processed albums for fast access`);
    }
    
    // Apply filtering by type (albums, eps, singles)
    let filteredAlbums = sortedUniqueAlbums;
    if (filter !== 'all') {
      switch (filter) {
        case 'albums':
          filteredAlbums = sortedUniqueAlbums.filter(album => album.tracks.length > 6);
          break;
        case 'eps':
          filteredAlbums = sortedUniqueAlbums.filter(album => album.tracks.length > 1 && album.tracks.length <= 6);
          break;
        case 'singles':
          filteredAlbums = sortedUniqueAlbums.filter(album => album.tracks.length === 1);
          break;
        case 'playlist':
          // Show only playlists - albums with podroll data or multiple artists
          filteredAlbums = sortedUniqueAlbums.filter(album => 
            album.podroll || 
            (album.tracks.length > 1 && new Set(album.tracks.map((t: any) => t.artist || album.artist)).size > 1)
          );
          break;
        default:
          filteredAlbums = sortedUniqueAlbums;
      }
    }
    
    const totalCount = filteredAlbums.length;
    
    // Apply pagination (limit=0 means return all) - albums are already sorted
    const paginatedAlbums = limit === 0 ? filteredAlbums.slice(offset) : filteredAlbums.slice(offset, offset + limit);

    // Pre-compute publisher statistics for the sidebar
    const publisherStats = new Map<string, { name: string; feedGuid: string; albumCount: number }>();
    
    // Only include non-Doerfel family artists
    filteredAlbums
      .filter(album => {
        const artistName = album.artist && typeof album.artist === 'string' ? album.artist.toLowerCase() : '';
        return album.publisher && album.publisher.feedGuid &&
               !artistName.includes('doerfel') && 
               !artistName.includes('ben doerfel') && 
               !artistName.includes('sirtj') &&
               !artistName.includes('shredward') &&
               !artistName.includes('tj doerfel');
      })
      .forEach(album => {
        const key = album.publisher!.feedGuid;
        if (!publisherStats.has(key)) {
          publisherStats.set(key, {
            name: album.artist,
            feedGuid: album.publisher!.feedGuid,
            albumCount: 1
          });
        } else {
          publisherStats.get(key)!.albumCount++;
        }
      });

    const publisherStatsArray = Array.from(publisherStats.values()).sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    console.log(`✅ Albums API: Returning ${paginatedAlbums.length}/${totalCount} albums with ${publisherStatsArray.length} publisher feeds (tier: ${tier}, filter: ${filter}, offset: ${offset}, limit: ${limit})`);
    
    return NextResponse.json({
      albums: paginatedAlbums,
      totalCount,
      hasMore: limit === 0 ? false : offset + limit < totalCount,
      offset,
      limit,
      publisherStats: publisherStatsArray,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=180, s-maxage=180, stale-while-revalidate=300', // Faster cache with stale-while-revalidate
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'ETag': `"${cacheTimestamp}-${totalCount}"` // Add ETag for better caching
      }
    });

  } catch (error) {
    console.error('Error in albums API:', error);
    return NextResponse.json({ 
      albums: [], 
      totalCount: 0, 
      lastUpdated: new Date().toISOString(),
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 