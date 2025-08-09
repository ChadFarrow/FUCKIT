const fs = require('fs');

// Load the HGH resolved songs
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));

async function getExactTimestamps() {
  console.log('🔍 Getting Exact Timestamps for Unresolved Tracks');
  console.log('=' .repeat(60));
  
  // Find all unresolved tracks
  const placeholders = hghSongs.filter(track => track.title.startsWith('Track '));
  const unknownFeeds = hghSongs.filter(track => track.title === 'Unknown Feed');
  const unresolved = [...placeholders, ...unknownFeeds];
  
  console.log(`📊 Analyzing ${unresolved.length} unresolved tracks`);
  console.log('');
  
  // Fetch the HGH RSS feed
  const response = await fetch('https://feed.homegrownhits.xyz/feed.xml');
  const xml = await response.text();
  
  // Parse episodes
  const episodeRegex = /<item>(.*?)<\/item>/gs;
  const episodes = xml.match(episodeRegex) || [];
  
  console.log(`📡 Found ${episodes.length} episodes in feed\n`);
  
  // Process each episode to extract exact timestamps
  const trackTimestamps = new Map();
  
  episodes.forEach((episodeXml, episodeIndex) => {
    // Extract episode title
    const titleMatch = episodeXml.match(/<title>([^<]*)<\/title>/);
    const episodeTitle = titleMatch ? titleMatch[1] : `Episode ${episodeIndex + 1}`;
    
    // Extract episode number
    const episodeNumMatch = episodeTitle.match(/HGH #(\d+)/);
    const episodeNum = episodeNumMatch ? episodeNumMatch[1] : (episodeIndex + 1).toString();
    
    // Extract publication date
    const pubDateMatch = episodeXml.match(/<pubDate>([^<]*)<\/pubDate>/);
    const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : null;
    
    // Look for podcast:value blocks with timestamps
    const valueBlockRegex = /<podcast:value[^>]*>.*?<podcast:valueTimeSplit[^>]*startTime="(\d+)"[^>]*duration="(\d+)"[^>]*>.*?<podcast:remoteItem[^>]*feedGuid="([^"]*)"[^>]*itemGuid="([^"]*)"[^>]*\/>/gs;
    
    let match;
    while ((match = valueBlockRegex.exec(episodeXml)) !== null) {
      const startTime = parseInt(match[1]);
      const duration = parseInt(match[2]);
      const feedGuid = match[3];
      const itemGuid = match[4];
      
      const key = `${feedGuid}|${itemGuid}`;
      
      // Convert seconds to timestamp format
      const hours = Math.floor(startTime / 3600);
      const minutes = Math.floor((startTime % 3600) / 60);
      const seconds = startTime % 60;
      
      const timestamp = hours > 0 
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      const endTime = startTime + duration;
      const endHours = Math.floor(endTime / 3600);
      const endMinutes = Math.floor((endTime % 3600) / 60);
      const endSeconds = endTime % 60;
      
      const endTimestamp = endHours > 0
        ? `${endHours}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`
        : `${endMinutes}:${endSeconds.toString().padStart(2, '0')}`;
      
      trackTimestamps.set(key, {
        episodeNum,
        episodeTitle,
        pubDate: pubDate ? pubDate.toLocaleDateString() : 'Unknown',
        startTime: timestamp,
        endTime: endTimestamp,
        duration: duration,
        startSeconds: startTime
      });
    }
    
    // Also check for simpler remoteItem entries without value blocks
    const remoteItemRegex = /<podcast:remoteItem[^>]*feedGuid="([^"]*)"[^>]*itemGuid="([^"]*)"[^>]*\/>/g;
    const remoteItems = [...episodeXml.matchAll(remoteItemRegex)];
    
    remoteItems.forEach((item, index) => {
      const feedGuid = item[1];
      const itemGuid = item[2];
      const key = `${feedGuid}|${itemGuid}`;
      
      // If we don't have timestamp data from value blocks, estimate based on position
      if (!trackTimestamps.has(key)) {
        // Estimate 3 minutes per track
        const estimatedStart = index * 180;
        const hours = Math.floor(estimatedStart / 3600);
        const minutes = Math.floor((estimatedStart % 3600) / 60);
        const seconds = estimatedStart % 60;
        
        const timestamp = hours > 0 
          ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          : `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        trackTimestamps.set(key, {
          episodeNum,
          episodeTitle,
          pubDate: pubDate ? pubDate.toLocaleDateString() : 'Unknown',
          startTime: timestamp,
          endTime: 'estimated',
          duration: 180,
          startSeconds: estimatedStart,
          estimated: true
        });
      }
    });
  });
  
  // Now output the unresolved tracks with their exact timestamps
  console.log('⏰ UNRESOLVED TRACKS WITH EXACT TIMESTAMPS:');
  console.log('=' .repeat(60));
  
  // Sort unresolved tracks by episode number and timestamp
  const unresolvedWithTimestamps = unresolved.map(track => {
    const key = `${track.feedGuid}|${track.itemGuid}`;
    const timestamp = trackTimestamps.get(key);
    return {
      ...track,
      timestamp
    };
  }).filter(t => t.timestamp).sort((a, b) => {
    // Sort by episode number (descending) then by start time
    const epA = parseInt(a.timestamp.episodeNum);
    const epB = parseInt(b.timestamp.episodeNum);
    if (epA !== epB) return epB - epA;
    return a.timestamp.startSeconds - b.timestamp.startSeconds;
  });
  
  let currentEpisode = null;
  unresolvedWithTimestamps.forEach(track => {
    const ts = track.timestamp;
    
    if (currentEpisode !== ts.episodeNum) {
      currentEpisode = ts.episodeNum;
      console.log(`\n📻 HGH #${ts.episodeNum} - "${ts.episodeTitle}"`);
      console.log(`   Date: ${ts.pubDate}`);
      console.log('   ---');
    }
    
    const timeInfo = ts.estimated 
      ? `⏱️ ~${ts.startTime} (estimated)`
      : `⏱️ ${ts.startTime} - ${ts.endTime} (${ts.duration}s)`;
    
    console.log(`   ${timeInfo}`);
    console.log(`      Title: ${track.title}`);
    console.log(`      Feed: ${track.feedGuid.substring(0, 8)}...`);
    console.log(`      Item: ${track.itemGuid.substring(0, 20)}...`);
  });
  
  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('=' .repeat(60));
  
  const withExactTime = unresolvedWithTimestamps.filter(t => !t.timestamp.estimated).length;
  const withEstimatedTime = unresolvedWithTimestamps.filter(t => t.timestamp.estimated).length;
  
  console.log(`Tracks with exact timestamps: ${withExactTime}`);
  console.log(`Tracks with estimated timestamps: ${withEstimatedTime}`);
  console.log(`Total unresolved tracks with timing: ${unresolvedWithTimestamps.length}`);
  console.log(`\nNote: Exact timestamps come from podcast:valueTimeSplit blocks in the RSS feed`);
}

getExactTimestamps().catch(console.error);