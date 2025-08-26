#!/usr/bin/env node

// Script to fetch complete Top 100 V4V music data and format for static file

async function fetchTop100Data() {
  try {
    console.log('🎵 Fetching complete Top 100 V4V music data...');
    
    const response = await fetch('https://stats.podcastindex.org/v4vmusic.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    console.log(`📊 Found ${items.length} tracks in the data`);
    
    const tracks = items.map((item, index) => ({
      rank: item.rank || (index + 1),
      title: item.title?.trim() || `Track ${index + 1}`,
      artist: item.author?.trim() || 'Unknown Artist',
      boosts: item.boosts || 0,
      artwork: item.image || `https://picsum.photos/300/300?random=${index + 1}`,
      feedId: item.feedId || 0,
      podcastLink: item.feedId ? `https://podcastindex.org/podcast/${item.feedId}` : 'https://podcastindex.org'
    }));
    
    const formattedData = {
      metadata: {
        title: data.title || "Podcasting 2.0 Top 100 (Music)",
        description: data.description || "The top 100 Value for Value music tracks by boosts received",
        source: "Podcast Index V4V Music Stats",
        lastUpdated: new Date().toISOString(),
        totalTracks: tracks.length,
        timestamp: data.timestamp
      },
      tracks: tracks
    };
    
    console.log(`✅ Processed ${tracks.length} tracks`);
    console.log('📄 Here is the formatted JSON data:');
    console.log(JSON.stringify(formattedData, null, 2));
    
  } catch (error) {
    console.error('❌ Error fetching Top 100 data:', error);
  }
}

fetchTop100Data();