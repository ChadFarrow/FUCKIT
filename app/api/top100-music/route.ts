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
  audioUrl?: string;
  feedUrl?: string;
  itemGuid?: string;
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
    const tracks = await parseTop100Json(jsonData);
    
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

async function parseTop100Json(jsonData: any): Promise<Top100Track[]> {
  const tracks: Top100Track[] = [];
  
  try {
    const items = jsonData.items || [];
    console.log(`📊 Processing ${items.length} items from Podcast Index V4V music JSON`);
    
    for (const item of items) {
      // Extract and clean the data from JSON structure
      const rank = item.rank || 0;
      const title = item.title?.trim() || '';
      const artist = item.author?.trim() || '';
      const boosts = item.boosts || 0; // Keep as number instead of string
      const artwork = item.image || '';
      const feedUrl = item.feedUrl || '';
      const itemGuid = item.itemGuid || '';
      
      // Create podcast link from feedId if available
      const podcastLink = item.feedId ? 
        `https://podcastindex.org/podcast/${item.feedId}` : 
        'https://podcastindex.org';
      
      // Resolve audio URL from feed if possible
      let audioUrl = '';
      if (feedUrl && title && artist) {
        try {
          audioUrl = await resolveAudioFromFeed(feedUrl, title, artist, itemGuid);
        } catch (error) {
          console.log(`⚠️ Could not resolve audio for "${title}" by ${artist}: ${error.message}`);
        }
      }
      
      // Add ALL tracks, even if some fields are missing (to get closer to 100)
      if (title || artist) { // More permissive filter
        tracks.push({
          id: `v4v-${rank || tracks.length + 1}`,
          position: rank || tracks.length + 1,
          title: title || `Unknown Track ${tracks.length + 1}`,
          artist: artist || 'Unknown Artist',
          sats: boosts.toLocaleString(), // Format for display
          satsNumber: boosts,
          artwork: artwork || `https://picsum.photos/300/300?random=${rank || tracks.length + 1}`,
          podcastLink: podcastLink,
          audioUrl: audioUrl,
          feedUrl: feedUrl,
          itemGuid: itemGuid
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

// Function to resolve audio URL from RSS feed
async function resolveAudioFromFeed(feedUrl: string, title: string, artist: string, itemGuid?: string): Promise<string> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Top100-Audio-Resolver/1.0'
      },
      // Short timeout to avoid blocking the main request
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Feed request failed: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Look for the specific item by title, artist, or GUID
    const items = xmlText.split('<item>');
    
    for (const item of items) {
      const itemTitle = extractXmlValue(item, 'title');
      const itemAuthor = extractXmlValue(item, 'itunes:author') || extractXmlValue(item, 'author');
      const itemGuidValue = extractXmlValue(item, 'guid');
      
      // Match by GUID first (most reliable), then by title and artist
      const isMatch = (itemGuid && itemGuidValue === itemGuid) || 
                     (itemTitle?.toLowerCase().includes(title.toLowerCase()) && 
                      itemAuthor?.toLowerCase().includes(artist.toLowerCase()));
      
      if (isMatch) {
        // Extract enclosure URL (audio file)
        const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]+)"/i);
        if (enclosureMatch) {
          return enclosureMatch[1];
        }
        
        // Fallback: look for media:content
        const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"/i);
        if (mediaMatch) {
          return mediaMatch[1];
        }
      }
    }
    
    throw new Error('Audio URL not found in feed');
    
  } catch (error) {
    throw new Error(`Feed resolution failed: ${error.message}`);
  }
}

// Helper function to extract XML values
function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour