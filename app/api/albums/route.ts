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
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tier = searchParams.get('tier') || 'all';
    const feedId = searchParams.get('feedId');
    
    // Force cache refresh to fix artwork issues
    const now = Date.now();
    cacheTimestamp = 0; // Force refresh
    if (false) { // Disabled cache temporarily
      console.log(`Using cached data: ${cachedData?.feeds?.length || 0} feeds, ${cachedMusicTracks.length} music tracks`);
    } else {
      const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
      const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');
      
      if (!fs.existsSync(parsedFeedsPath)) {
        console.warn('Parsed feeds data not found at:', parsedFeedsPath);
        return NextResponse.json({ 
          albums: [], 
          totalCount: 0, 
          lastUpdated: new Date().toISOString(),
          error: 'Parsed feeds data not found' 
        }, { status: 404 });
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

      const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
      const musicTracksContent = fs.readFileSync(musicTracksPath, 'utf-8');
      
      // Load HGH resolved songs for Podcast Index lookup
      const hghSongsPath = path.join(process.cwd(), 'data', 'hgh-resolved-songs.json');
      let hghSongsContent = '[]';
      if (fs.existsSync(hghSongsPath)) {
        hghSongsContent = fs.readFileSync(hghSongsPath, 'utf-8');
      }
      
      // Validate JSON before parsing
      try {
        cachedData = JSON.parse(fileContent);
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
        
        console.log(`✅ Loaded ${cachedHGHSongs.length} HGH resolved songs from hgh-resolved-songs.json`);
        
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
        const artist = typeof album.artist === 'string' ? album.artist : '';
        const description = typeof album.description === 'string' ? album.description : '';
        let coverArt = typeof album.coverArt === 'string' ? album.coverArt : '';
        
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
        
        // Check if this is an HGH track that should use Podcast Index API resolution
        const hghTrack = cachedHGHSongs?.find((song: any) => song.title === title);
        if (hghTrack) {
          // For now, use the manual mapping as fallback while we implement async PI resolution
          if (HGH_ARTWORK_URL_MAP[title]) {
            coverArt = HGH_ARTWORK_URL_MAP[title];
            console.log(`Using HGH artwork mapping for "${title}": ${coverArt}`);
            console.log(`📝 TODO: Replace with PI API for feedGuid: ${hghTrack.feedGuid}, itemGuid: ${hghTrack.itemGuid}`);
          } else {
            console.log(`⚠️ HGH track "${title}" found but no artwork mapping - feedGuid: ${hghTrack.feedGuid}`);
          }
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
    
    const uniqueAlbums = Array.from(albumMap.values());
    const totalCount = uniqueAlbums.length;

    // Apply pagination (limit=0 means return all)
    const paginatedAlbums = limit === 0 ? uniqueAlbums.slice(offset) : uniqueAlbums.slice(offset, offset + limit);

    console.log(`✅ Albums API: Returning ${paginatedAlbums.length}/${totalCount} albums (tier: ${tier}, offset: ${offset}, limit: ${limit})`);
    
    return NextResponse.json({
      albums: paginatedAlbums,
      totalCount,
      hasMore: limit === 0 ? false : offset + limit < totalCount,
      offset,
      limit,
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