import { NextRequest, NextResponse } from 'next/server';

interface Top100Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  sats: string;
  satsNumber: number;
  artwork: string;
  podcastLink: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🎵 Fetching Top 100 V4V Music data from GitHub...');
    
    // Fetch the HTML from the GitHub repository
    const response = await fetch('https://raw.githubusercontent.com/Podcastindex-org/top100_music/main/daily_top100_example.html', {
      headers: {
        'User-Agent': 'FUCKIT-Music-App/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Top 100 data: ${response.status}`);
    }
    
    const htmlContent = await response.text();
    
    // Parse the HTML to extract track data
    const tracks = parseTop100Html(htmlContent);
    
    console.log(`✅ Successfully parsed ${tracks.length} Top 100 tracks`);
    
    return NextResponse.json({
      success: true,
      data: {
        tracks,
        totalTracks: tracks.length,
        lastUpdated: new Date().toISOString(),
        source: 'GitHub: Podcastindex-org/top100_music'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching Top 100 data:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        tracks: [],
        totalTracks: 0
      }
    }, { status: 500 });
  }
}

function parseTop100Html(html: string): Top100Track[] {
  const tracks: Top100Track[] = [];
  
  try {
    // Use regex to parse the HTML structure
    // Look for list items with the complete structure
    const listItemRegex = /<li>\s*<img[^>]+src="([^"]+)"[^>]*>\s*<div class="details">\s*<a class="title" href="([^"]+)">([^<]+)<\/a>\s*<span class="artist">([^<]+)<\/span>\s*<div class="sats mobile">[\s\S]*?([0-9,]+)[\s\S]*?<\/div>/g;
    
    let position = 1;
    let match;
    
    while ((match = listItemRegex.exec(html)) !== null) {
      const [, artwork, podcastLink, title, artist, satsString] = match;
      
      // Clean up the extracted data
      const cleanTitle = title.trim();
      const cleanArtist = artist.trim();
      const cleanSats = satsString.trim();
      const satsNumber = parseInt(cleanSats.replace(/,/g, ''), 10) || 0;
      
      // Only add tracks that have meaningful data
      if (cleanTitle && cleanArtist && satsNumber > 0) {
        tracks.push({
          id: `top100-${position}`,
          position,
          title: cleanTitle,
          artist: cleanArtist,
          sats: cleanSats,
          satsNumber,
          artwork: artwork || `https://picsum.photos/300/300?random=${position}`,
          podcastLink: podcastLink || 'https://podcastindex.org'
        });
        position++;
      }
    }
    
    console.log(`📊 Parsed ${tracks.length} tracks from Top 100 HTML`);
    
    // Sort by sats descending to ensure proper ranking
    tracks.sort((a, b) => b.satsNumber - a.satsNumber);
    
    // Update positions after sorting
    tracks.forEach((track, index) => {
      track.position = index + 1;
      track.id = `top100-${track.position}`;
    });
    
  } catch (error) {
    console.error('Error parsing Top 100 HTML:', error);
  }
  
  return tracks;
}

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour