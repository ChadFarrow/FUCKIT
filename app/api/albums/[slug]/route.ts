import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAlbumSlug } from '@/lib/url-utils';
import { HGH_ARTWORK_URL_MAP } from '@/data/hgh-artwork-urls';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    console.log(`🔍 Album API: Looking for slug "${slug}"`);
    
    // Use the same data source as the main albums API - music tracks
    const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    
    if (!fs.existsSync(musicTracksPath)) {
      console.warn('Music tracks data not found at:', musicTracksPath);
      return NextResponse.json({ 
        album: null, 
        error: 'Music tracks data not found' 
      }, { status: 404 });
    }

    // Read and parse the music tracks file
    let musicTracksData;
    try {
      console.log('📖 Reading music tracks file...');
      const fileContent = fs.readFileSync(musicTracksPath, 'utf-8');
      console.log(`📊 File size: ${Math.round(fileContent.length / 1024)}KB`);
      
      const musicTracksParsed = JSON.parse(fileContent);
      
      // Extract the musicTracks array from the parsed data
      if (musicTracksParsed && musicTracksParsed.musicTracks && Array.isArray(musicTracksParsed.musicTracks)) {
        musicTracksData = musicTracksParsed.musicTracks;
        console.log(`✅ Successfully loaded ${musicTracksData.length} music tracks`);
      } else {
        console.warn('Invalid music tracks data structure:', musicTracksParsed);
        return NextResponse.json({ 
          album: null, 
          error: 'Invalid music tracks data structure' 
        }, { status: 500 });
      }
    } catch (parseError) {
      console.error('❌ Failed to parse music-tracks.json:', parseError);
      return NextResponse.json({ 
        album: null, 
        error: 'Invalid JSON in music tracks data' 
      }, { status: 500 });
    }
    
    // Normalize the slug for searching
    const searchSlug = slug.toLowerCase();
    const decodedSlug = decodeURIComponent(searchSlug);
    const titleFromSlug = decodedSlug.replace(/-/g, ' ');
    
    console.log(`🔍 Searching for album with slug: "${slug}" -> normalized: "${searchSlug}" -> title: "${titleFromSlug}"`);
    
    // Group music tracks by feedGuid to create albums (same logic as main albums API)
    const musicAlbumGroups = new Map<string, any>();
    
    musicTracksData.forEach((track: any) => {
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
    
    // Convert music track groups to album format and search
    let foundAlbum = null;
    
    // Convert Map to array and iterate (compatible with TypeScript build)
    const albumGroups = Array.from(musicAlbumGroups.values());
    const potentialMatches = [];
    
    for (const group of albumGroups) {
      const albumTitle = group.feedTitle || 'Unknown Album';
      
      // Extract artist from track data - find first track with valid artist different from album title
      let albumArtist = 'Unknown Artist';
      for (const track of group.tracks) {
        if (track.artist && track.artist.trim() !== '' && track.artist !== albumTitle) {
          albumArtist = track.artist;
          break;
        }
      }
      // Fallback to first track's artist if no better option found
      if (albumArtist === 'Unknown Artist' && group.tracks[0]?.artist) {
        albumArtist = group.tracks[0].artist;
      }
      
      if (!albumTitle) continue;
      
      // Generate various matching patterns
      const albumTitleLower = albumTitle.toLowerCase();
      const albumSlug = generateAlbumSlug(albumTitle);
      const normalizedAlbumTitle = albumTitleLower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const normalizedSearchTitle = titleFromSlug.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const fullyNormalizedAlbum = albumTitleLower.replace(/[^a-z0-9]/g, '');
      const fullyNormalizedSearch = searchSlug.replace(/[^a-z0-9]/g, '');
      
      // Try various matching strategies
      const matches = [
        // Exact slug match
        albumSlug === searchSlug,
        albumSlug === decodedSlug,
        
        // Exact title match
        albumTitleLower === searchSlug,
        albumTitleLower === decodedSlug,
        albumTitleLower === titleFromSlug,
        albumTitle === decodedSlug,
        albumTitle === titleFromSlug,
        
        // Normalized matches
        normalizedAlbumTitle === normalizedSearchTitle,
        fullyNormalizedAlbum === fullyNormalizedSearch,
        
        // Hyphen-aware matching
        albumTitleLower.replace(/-/g, ' ') === titleFromSlug,
        albumTitleLower.replace(/\s/g, '-') === searchSlug,
        
        // Contains match (for longer search terms)
        searchSlug.length > 5 && albumTitleLower.includes(searchSlug),
        titleFromSlug.length > 5 && albumTitleLower.includes(titleFromSlug)
      ];
      
      if (matches.some(match => match)) {
        console.log(`✅ Found matching album: "${albumTitle}" by ${albumArtist} (${group.tracks.length} tracks)`);
        
        // Debug log for albums with potential duplicates
        if (['Tinderbox', 'Fight!', 'it can be erased', 'deathdreams', 'Everything Is Lit', 'Kurtisdrums', 'Live From the Other Side', 'Music From The Doerfel-Verse'].includes(albumTitle)) {
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
          console.log(`🎵 DEBUG [${slug}] ${albumTitle}: ${originalTracks} original tracks → ${deduplicatedTracks.length} deduplicated tracks`);
          if (originalTracks !== deduplicatedTracks.length) {
            console.log(`🔄 [${slug}] Removed ${originalTracks - deduplicatedTracks.length} duplicate tracks from "${albumTitle}"`);
          }
        }
        
        // Store as potential match instead of immediately selecting
        potentialMatches.push({
          group,
          albumTitle,
          albumArtist,
          trackCount: group.tracks.length
        });
      }
    }
    
    // Select the best match from potential matches
    if (potentialMatches.length > 0) {
      // Sort by track count descending to prefer albums with more tracks
      potentialMatches.sort((a, b) => b.trackCount - a.trackCount);
      
      if (potentialMatches.length > 1) {
        console.log(`🔍 Found ${potentialMatches.length} matching albums for "${slug}"`);
        potentialMatches.forEach((match, index) => {
          console.log(`  ${index + 1}. "${match.albumTitle}" by ${match.albumArtist} (${match.trackCount} tracks)`);
        });
        console.log(`✅ Selected album with most tracks: "${potentialMatches[0].albumTitle}" (${potentialMatches[0].trackCount} tracks)`);
      }
      
      const selectedMatch = potentialMatches[0];
      const group = selectedMatch.group;
      const albumTitle = selectedMatch.albumTitle;
      const albumArtist = selectedMatch.albumArtist;
      const firstTrack = group.tracks[0];
      
      // Process the album data with proper type checking for music track format
      foundAlbum = {
        id: generateAlbumSlug(albumTitle),
        title: albumTitle,
        artist: albumArtist,
        description: firstTrack.description || '',
        summary: firstTrack.description || '',
        subtitle: '',
        coverArt: group.feedImage || firstTrack.image || '',
        releaseDate: new Date(firstTrack.datePublished * 1000 || Date.now()).toISOString(),
        explicit: firstTrack.explicit || false,
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
        publisher: null, // Could be enhanced with publisher matching logic
        funding: firstTrack.value ? { 
          type: 'lightning', 
          destinations: firstTrack.value.destinations || [] 
        } : null,
        feedId: group.feedGuid || generateAlbumSlug(albumTitle),
        feedUrl: group.feedUrl || '',
        lastUpdated: new Date(firstTrack.datePublished * 1000 || Date.now()).toISOString()
      };
      
      // Custom track ordering for concept albums (e.g., "They Ride" by IROH)
      if (foundAlbum.title.toLowerCase() === 'they ride' && foundAlbum.artist.toLowerCase() === 'iroh') {
        console.log('🎵 Applying custom track order for "They Ride" concept album');
        
        const correctTrackOrder = [
          '-', 'Heaven Knows', '....', 'The Fever', '.', 'In Exile', '-.--', 'The Seed Man',
          '-.-.', 'Renfield', '..', 'They Ride', '-..', 'Pedal Down ( feat. Rob Montgomery )',
          '. ( The Last Transmission? )'
        ];
        
        foundAlbum.tracks = foundAlbum.tracks.sort((a: any, b: any) => {
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
          
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return 0;
        });
      }
    }
    
    if (!foundAlbum) {
      console.log(`❌ No album found for slug: "${slug}"`);
      return NextResponse.json({ 
        album: null, 
        error: 'Album not found' 
      }, { status: 404 });
    }
    
    console.log(`✅ Album API: Returning album "${foundAlbum.title}" by ${foundAlbum.artist}`);
    
    return NextResponse.json({
      album: foundAlbum,
      lastUpdated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Force refresh for artwork fix
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'ETag': `"${Date.now()}-${foundAlbum.id}"` // Add ETag for better caching
      }
    });

  } catch (error) {
    console.error('Error in album lookup API:', error);
    return NextResponse.json({ 
      album: null, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}