const fs = require('fs');

// Load the HGH resolved songs
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));

// Load the original HGH RSS feed to get episode context
async function analyzeUnresolvedTracks() {
  console.log('🔍 Analyzing Unresolved HGH Tracks');
  console.log('=' .repeat(60));
  
  // Find all unresolved tracks (placeholders and Unknown Feed)
  const placeholders = hghSongs.filter(track => track.title.startsWith('Track '));
  const unknownFeeds = hghSongs.filter(track => track.title === 'Unknown Feed');
  
  console.log(`📊 Found ${placeholders.length} placeholder tracks`);
  console.log(`📊 Found ${unknownFeeds.length} unknown feed tracks`);
  console.log('');
  
  // Fetch the original HGH RSS feed to get episode info
  console.log('📡 Fetching HGH RSS feed for episode context...');
  const response = await fetch('https://feed.homegrownhits.xyz/feed.xml');
  const xml = await response.text();
  
  // Parse episodes from the RSS
  const episodeRegex = /<item>(.*?)<\/item>/gs;
  const episodes = xml.match(episodeRegex) || [];
  
  console.log(`✅ Found ${episodes.length} episodes in HGH feed\n`);
  
  // Build a map of which tracks are in which episodes
  const trackToEpisode = new Map();
  
  episodes.forEach((episodeXml, episodeIndex) => {
    // Extract episode title
    const titleMatch = episodeXml.match(/<title>([^<]*)<\/title>/);
    const episodeTitle = titleMatch ? titleMatch[1] : `Episode ${episodeIndex + 1}`;
    
    // Extract publication date
    const pubDateMatch = episodeXml.match(/<pubDate>([^<]*)<\/pubDate>/);
    const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toLocaleDateString() : 'Unknown date';
    
    // Extract episode number from title (usually "HGH #97" format)
    const episodeNumMatch = episodeTitle.match(/HGH #(\d+)/);
    const episodeNum = episodeNumMatch ? episodeNumMatch[1] : (episodeIndex + 1).toString();
    
    // Find all remote items in this episode
    const remoteItemRegex = /<podcast:remoteItem[^>]*feedGuid="([^"]*)"[^>]*itemGuid="([^"]*)"[^>]*(?:medium="music")?[^>]*\/>/g;
    let match;
    let trackIndex = 0;
    
    while ((match = remoteItemRegex.exec(episodeXml)) !== null) {
      const feedGuid = match[1];
      const itemGuid = match[2];
      trackIndex++;
      
      // Calculate approximate timestamp (assuming 3 minutes per track average)
      const minutes = (trackIndex - 1) * 3;
      const timestamp = `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}:00`;
      
      trackToEpisode.set(`${feedGuid}|${itemGuid}`, {
        episodeNum,
        episodeTitle,
        pubDate,
        trackPosition: trackIndex,
        timestamp
      });
    }
  });
  
  // Now analyze unresolved tracks
  console.log('🚫 PLACEHOLDER TRACKS (Still showing "Track X"):');
  console.log('-' .repeat(60));
  
  placeholders.forEach(track => {
    const key = `${track.feedGuid}|${track.itemGuid}`;
    const episodeInfo = trackToEpisode.get(key);
    
    if (episodeInfo) {
      console.log(`\n📍 ${track.title}`);
      console.log(`   Episode: HGH #${episodeInfo.episodeNum} - "${episodeInfo.episodeTitle}"`);
      console.log(`   Date: ${episodeInfo.pubDate}`);
      console.log(`   Position: Track ${episodeInfo.trackPosition} in episode`);
      console.log(`   Estimated timestamp: ${episodeInfo.timestamp}`);
      console.log(`   Feed GUID: ${track.feedGuid}`);
      console.log(`   Item GUID: ${track.itemGuid}`);
    } else {
      console.log(`\n📍 ${track.title}`);
      console.log(`   ⚠️ Not found in current RSS feed (may be from older episode)`);
      console.log(`   Feed GUID: ${track.feedGuid}`);
      console.log(`   Item GUID: ${track.itemGuid}`);
    }
  });
  
  console.log('\n\n❌ UNKNOWN FEED TRACKS (Corrupted or unavailable):');
  console.log('-' .repeat(60));
  
  unknownFeeds.forEach(track => {
    const key = `${track.feedGuid}|${track.itemGuid}`;
    const episodeInfo = trackToEpisode.get(key);
    
    if (episodeInfo) {
      console.log(`\n📍 Unknown Feed`);
      console.log(`   Episode: HGH #${episodeInfo.episodeNum} - "${episodeInfo.episodeTitle}"`);
      console.log(`   Date: ${episodeInfo.pubDate}`);
      console.log(`   Position: Track ${episodeInfo.trackPosition} in episode`);
      console.log(`   Estimated timestamp: ${episodeInfo.timestamp}`);
      console.log(`   Feed GUID: ${track.feedGuid}`);
      console.log(`   Item GUID: ${track.itemGuid}`);
    } else {
      console.log(`\n📍 Unknown Feed`);
      console.log(`   ⚠️ Not found in current RSS feed`);
      console.log(`   Feed GUID: ${track.feedGuid}`);
      console.log(`   Item GUID: ${track.itemGuid}`);
    }
  });
  
  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('=' .repeat(60));
  
  // Count by episode
  const episodeCounts = new Map();
  [...placeholders, ...unknownFeeds].forEach(track => {
    const key = `${track.feedGuid}|${track.itemGuid}`;
    const episodeInfo = trackToEpisode.get(key);
    if (episodeInfo) {
      const epKey = `HGH #${episodeInfo.episodeNum}`;
      episodeCounts.set(epKey, (episodeCounts.get(epKey) || 0) + 1);
    }
  });
  
  console.log('Unresolved tracks by episode:');
  [...episodeCounts.entries()]
    .sort((a, b) => {
      const numA = parseInt(a[0].match(/#(\d+)/)?.[1] || '0');
      const numB = parseInt(b[0].match(/#(\d+)/)?.[1] || '0');
      return numB - numA;
    })
    .forEach(([episode, count]) => {
      console.log(`  ${episode}: ${count} unresolved tracks`);
    });
  
  const notInFeed = [...placeholders, ...unknownFeeds].filter(track => {
    const key = `${track.feedGuid}|${track.itemGuid}`;
    return !trackToEpisode.has(key);
  }).length;
  
  if (notInFeed > 0) {
    console.log(`  Not in current feed: ${notInFeed} tracks`);
  }
  
  console.log(`\nTotal unresolved: ${placeholders.length + unknownFeeds.length} tracks`);
}

analyzeUnresolvedTracks().catch(console.error);