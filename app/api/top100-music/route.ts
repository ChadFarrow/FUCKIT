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
    console.log('🎵 Fetching Top 100 V4V Music data from Podcast Index Stats...');
    
    // Fetch JSON data from the official Podcast Index V4V music stats
    const response = await fetch('https://stats.podcastindex.org/v4vmusic.json', {
      headers: {
        'User-Agent': 'FUCKIT-Music-App/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Top 100 data: ${response.status}`);
    }
    
    const jsonData = await response.json();
    
    // Parse the JSON to extract track data
    const tracks = parseTop100Json(jsonData);
    
    console.log(`✅ Successfully loaded ${tracks.length} Top 100 V4V tracks from Podcast Index`);
    
    return NextResponse.json({
      success: true,
      data: {
        tracks,
        totalTracks: tracks.length,
        lastUpdated: jsonData.timestamp ? new Date(jsonData.timestamp * 1000).toISOString() : new Date().toISOString(),
        source: 'Podcast Index V4V Music Stats (Official)',
        description: jsonData.description || 'Top V4V music tracks boosted on podcasts'
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

function parseTop100Json(jsonData: any): Top100Track[] {
  const tracks: Top100Track[] = [];
  
  try {
    const items = jsonData.items || [];
    console.log(`📊 Processing ${items.length} items from Podcast Index V4V music JSON`);
    
    for (const item of items) {
      // Extract and clean the data from JSON structure
      const rank = item.rank || 0;
      const title = item.title?.trim() || '';
      const artist = item.author?.trim() || '';
      const boosts = item.boosts?.trim() || '0';
      const artwork = item.image || '';
      
      // Convert boost string to number for sorting
      const boostNumber = parseInt(boosts.replace(/,/g, ''), 10) || 0;
      
      // Create podcast link from feedId if available
      const podcastLink = item.feedId ? 
        `https://podcastindex.org/podcast/${item.feedId}` : 
        'https://podcastindex.org';
      
      // Only add tracks that have meaningful data
      if (title && artist && rank > 0) {
        tracks.push({
          id: `v4v-${rank}`,
          position: rank,
          title: title,
          artist: artist,
          sats: boosts, // Using "boosts" as equivalent to sats
          satsNumber: boostNumber,
          artwork: artwork || `https://picsum.photos/300/300?random=${rank}`,
          podcastLink: podcastLink
        });
      }
    }
    
    console.log(`📊 Successfully parsed ${tracks.length} V4V music tracks`);
    
    // Sort by rank (should already be sorted, but ensure it)
    tracks.sort((a, b) => a.position - b.position);
    
  } catch (error) {
    console.error('❌ Error parsing Top 100 JSON:', error);
  }
  
  return tracks;
}

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour