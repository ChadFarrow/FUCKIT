import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAlbumSlug } from '@/lib/url-utils';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    console.log(`🔍 Album API: Looking for slug "${slug}"`);
    
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.warn('Parsed feeds data not found at:', parsedFeedsPath);
      return NextResponse.json({ 
        album: null, 
        error: 'Parsed feeds data not found' 
      }, { status: 404 });
    }

    // Read and parse the file synchronously but with error handling
    let parsedData;
    try {
      console.log('📖 Reading parsed feeds file...');
      const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
      console.log(`📊 File size: ${Math.round(fileContent.length / 1024)}KB`);
      
      parsedData = JSON.parse(fileContent);
      console.log('✅ Successfully parsed JSON');
    } catch (parseError) {
      console.error('❌ Failed to parse parsed-feeds.json:', parseError);
      return NextResponse.json({ 
        album: null, 
        error: 'Invalid JSON in parsed feeds data' 
      }, { status: 500 });
    }
    
    // Validate data structure
    if (!parsedData || !Array.isArray(parsedData.feeds)) {
      console.warn('Invalid parsed feeds data structure:', parsedData);
      return NextResponse.json({ 
        album: null, 
        error: 'Invalid data structure' 
      }, { status: 500 });
    }
    
    // Normalize the slug for searching
    const searchSlug = slug.toLowerCase();
    const decodedSlug = decodeURIComponent(searchSlug);
    const titleFromSlug = decodedSlug.replace(/-/g, ' ');
    
    console.log(`🔍 Searching for album with slug: "${slug}" -> normalized: "${searchSlug}" -> title: "${titleFromSlug}"`);
    
    // Find the specific album by searching through all feeds
    let foundAlbum = null;
    
    for (const feed of parsedData.feeds) {
      if (feed.parseStatus !== 'success' || !feed.parsedData?.album) {
        continue;
      }
      
      const album = feed.parsedData.album;
      const albumTitle = typeof album.title === 'string' ? album.title : '';
      const albumArtist = typeof album.artist === 'string' ? album.artist : '';
      
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
        console.log(`✅ Found matching album: "${albumTitle}" by ${albumArtist}`);
        
        // Process the album data with proper type checking
        foundAlbum = {
          id: generateAlbumSlug(albumTitle),
          title: albumTitle,
          artist: albumArtist,
          description: typeof album.description === 'string' ? album.description : '',
          summary: typeof album.summary === 'string' ? album.summary : '',
          subtitle: typeof album.subtitle === 'string' ? album.subtitle : '',
          coverArt: typeof album.coverArt === 'string' ? album.coverArt : '',
          releaseDate: typeof album.releaseDate === 'string' ? album.releaseDate : '',
          explicit: typeof album.explicit === 'boolean' ? album.explicit : false,
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
        
        break;
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