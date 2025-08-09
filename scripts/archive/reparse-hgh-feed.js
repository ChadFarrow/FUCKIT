const fs = require('fs');

// Simple XML parser for podcast:remoteItem elements
function parseRemoteItems(xmlContent) {
  const remoteItemPattern = /<podcast:remoteItem[^>]*feedGuid="([^"]*)"[^>]*itemGuid="([^"]*)"[^>]*\/>/g;
  const items = [];
  let match;
  let index = 1;

  while ((match = remoteItemPattern.exec(xmlContent)) !== null) {
    const feedGuid = match[1];
    const itemGuid = match[2];
    
    if (feedGuid && itemGuid) {
      items.push({
        feedGuid,
        itemGuid,
        title: `Track ${index}`,
        artist: 'Homegrown Hits Artist',
        feedUrl: `https://podcast-index-lookup/${feedGuid}`,
        feedTitle: 'Various Artists',
        duration: 180
      });
      index++;
    }
  }

  return items;
}

async function main() {
  console.log('🔄 Re-parsing HGH RSS feed to restore full dataset...');
  
  try {
    // Fetch the RSS feed
    const response = await fetch('https://feed.homegrownhits.xyz/feed.xml');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }
    
    const xmlContent = await response.text();
    console.log(`📄 Downloaded RSS feed (${xmlContent.length} characters)`);
    
    // Parse remote items
    const remoteItems = parseRemoteItems(xmlContent);
    console.log(`🎵 Parsed ${remoteItems.length} remote items`);
    
    // Load current resolved tracks to preserve any resolution we've already done
    let currentTracks = [];
    if (fs.existsSync('./data/hgh-resolved-songs.json')) {
      try {
        currentTracks = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
        console.log(`📚 Found ${currentTracks.length} previously resolved tracks`);
      } catch (error) {
        console.log('⚠️ Could not read current tracks, starting fresh');
      }
    }
    
    // Create a map of resolved tracks by feedGuid+itemGuid
    const resolvedMap = new Map();
    currentTracks.forEach(track => {
      const key = `${track.feedGuid}:${track.itemGuid}`;
      resolvedMap.set(key, track);
    });
    
    // Merge: use resolved data where available, placeholder where not
    const mergedTracks = remoteItems.map((item, index) => {
      const key = `${item.feedGuid}:${item.itemGuid}`;
      const resolved = resolvedMap.get(key);
      
      if (resolved) {
        console.log(`✅ Keeping resolved: "${resolved.title}"`);
        return resolved;
      } else {
        return {
          ...item,
          title: `Track ${index + 1}`
        };
      }
    });
    
    // Save the full dataset
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(mergedTracks, null, 2));
    
    console.log('✅ Restoration complete!');
    console.log(`📊 Total tracks: ${mergedTracks.length}`);
    console.log(`🎵 Resolved tracks: ${mergedTracks.filter(t => !t.title.startsWith('Track ')).length}`);
    console.log(`📝 Need resolution: ${mergedTracks.filter(t => t.title.startsWith('Track ')).length}`);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

main();