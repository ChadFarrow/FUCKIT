const fs = require('fs');
const path = require('path');

// Conservative rate limiting
const DELAY_BETWEEN_REQUESTS = 250;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFeedExists(feedGuid) {
  try {
    const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
    const response = await fetch(feedUrl, { method: 'HEAD' }); // Just check headers
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      } else {
        return null;
      }
    } catch (error) {
      if (attempt === retries) {
        return null;
      }
      await delay(RETRY_DELAY);
    }
  }
  return null;
}

function parseRSSFeed(xmlContent) {
  try {
    const titleMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    const artistMatch = xmlContent.match(/<itunes:author[^>]*>([^<]+)<\/itunes:author>/i);
    const albumMatch = xmlContent.match(/<itunes:subtitle[^>]*>([^<]+)<\/itunes:subtitle>/i);
    const durationMatch = xmlContent.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i);
    const artworkMatch = xmlContent.match(/<itunes:image[^>]*href="([^"]+)"/i);
    const audioMatch = xmlContent.match(/<enclosure[^>]*url="([^"]+\.(?:mp3|wav|m4a|ogg))"/i);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      artist: artistMatch ? artistMatch[1].trim() : null,
      album: albumMatch ? albumMatch[1].trim() : null,
      duration: durationMatch ? durationMatch[1].trim() : null,
      artworkUrl: artworkMatch ? artworkMatch[1].trim() : null,
      audioUrl: audioMatch ? audioMatch[1].trim() : null
    };
  } catch (error) {
    return null;
  }
}

async function resolveMetadataIntelligently() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    const tracksToResolve = musicTracks.filter(track => 
      track.itemGuid && track.itemGuid._ && 
      track.resolutionStatus === 'pending'
    );
    
    console.log(`🔍 Starting INTELLIGENT metadata resolution for ${tracksToResolve.length} tracks...`);
    
    // Group tracks by feedGuid
    const feedGroups = {};
    tracksToResolve.forEach(track => {
      const feedGuid = track.feedGuid;
      if (!feedGroups[feedGuid]) {
        feedGroups[feedGuid] = [];
      }
      feedGroups[feedGuid].push(track);
    });
    
    console.log(`📊 Found ${Object.keys(feedGroups).length} unique feeds to test\n`);
    
    let resolvedCount = 0;
    let failedCount = 0;
    let accessibleFeeds = 0;
    let inaccessibleFeeds = 0;
    
    const startTime = Date.now();
    
    for (const [feedGuid, tracks] of Object.entries(feedGroups)) {
      console.log(`🎵 Testing feed: ${feedGuid} (${tracks.length} tracks)`);
      
      // First, test if the feed exists
      const feedExists = await testFeedExists(feedGuid);
      
      if (!feedExists) {
        console.log(`  ❌ Feed not accessible, marking ${tracks.length} tracks as failed`);
        inaccessibleFeeds++;
        
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `Feed not accessible: https://wavlake.com/feed/music/${feedGuid}`,
            reason: 'Feed does not exist or is inaccessible'
          });
        });
        failedCount += tracks.length;
        continue;
      }
      
      console.log(`  ✅ Feed accessible, fetching metadata...`);
      accessibleFeeds++;
      
      // Fetch feed metadata
      const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
      const xmlContent = await fetchWithRetry(feedUrl);
      
      if (!xmlContent) {
        console.log(`  ❌ Failed to fetch feed content`);
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `Failed to fetch feed content: ${feedUrl}`,
            reason: 'Network error or parsing failure'
          });
        });
        failedCount += tracks.length;
        continue;
      }
      
      // Parse feed metadata
      const feedMetadata = parseRSSFeed(xmlContent);
      
      if (!feedMetadata || (!feedMetadata.title && !feedMetadata.artist)) {
        console.log(`  ⚠️  No metadata found in feed`);
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `No metadata found in feed: ${feedUrl}`,
            reason: 'Empty or invalid feed content'
          });
        });
        failedCount += tracks.length;
        continue;
      }
      
      // Apply metadata to all tracks in this feed
      for (const track of tracks) {
        if (feedMetadata.title) track.title = feedMetadata.title;
        if (feedMetadata.artist) track.artist = feedMetadata.artist;
        if (feedMetadata.album) track.album = feedMetadata.album;
        if (feedMetadata.duration) track.duration = feedMetadata.duration;
        if (feedMetadata.artworkUrl) track.artworkUrl = feedMetadata.artworkUrl;
        if (feedMetadata.audioUrl) track.audioUrl = feedMetadata.audioUrl;
        
        track.resolutionStatus = 'resolved';
        track.lastModified = new Date().toISOString();
        track.modificationHistory.push({
          date: new Date().toISOString(),
          action: 'metadata-resolved',
          description: `Resolved from Wavlake RSS feed: ${feedUrl}`,
          source: 'wavlake-rss',
          metadata: feedMetadata
        });
        
        resolvedCount++;
        console.log(`  ✅ Resolved: ${feedMetadata.title || 'Unknown'} by ${feedMetadata.artist || 'Unknown'}`);
      }
      
      // Rate limiting
      await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    const totalTime = Date.now() - startTime;
    
    // Save updated database
    console.log(`\n💾 Saving updated database...`);
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-intelligent-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    // Final statistics
    const finalStats = {
      total: musicTracks.length,
      remoteTracks: musicTracks.filter(t => t.itemGuid && t.itemGuid._).length,
      resolved: musicTracks.filter(t => t.resolutionStatus === 'resolved').length,
      pending: musicTracks.filter(t => t.resolutionStatus === 'pending').length,
      failed: musicTracks.filter(t => t.resolutionStatus === 'failed').length
    };
    
    console.log(`\n🎯 INTELLIGENT Resolution Complete:`);
    console.log(`  ⏱️  Total time: ${(totalTime/1000).toFixed(1)}s`);
    console.log(`  📡 Accessible feeds: ${accessibleFeeds}/${Object.keys(feedGroups).length}`);
    console.log(`  ❌ Inaccessible feeds: ${inaccessibleFeeds}/${Object.keys(feedGroups).length}`);
    console.log(`  ✅ Resolved tracks: ${resolvedCount}`);
    console.log(`  ❌ Failed tracks: ${failedCount}`);
    console.log(`  💾 Backup created: ${backupPath}`);
    
    console.log(`\n📊 Final Database Statistics:`);
    console.log(`  Total tracks: ${finalStats.total}`);
    console.log(`  Remote item tracks: ${finalStats.remoteTracks}`);
    console.log(`  ✅ Resolved: ${finalStats.resolved}`);
    console.log(`  ⏳ Pending: ${finalStats.pending}`);
    console.log(`  ❌ Failed: ${finalStats.failed}`);
    console.log(`  📈 Success rate: ${((finalStats.resolved / finalStats.remoteTracks) * 100).toFixed(1)}%`);
    
    // Show sample resolved track
    const sampleResolved = musicTracks.find(t => t.resolutionStatus === 'resolved');
    if (sampleResolved) {
      console.log(`\n📝 Sample Resolved Track:`);
      console.log(`  Title: ${sampleResolved.title}`);
      console.log(`  Artist: ${sampleResolved.artist}`);
      console.log(`  Album: ${sampleResolved.album || 'N/A'}`);
      console.log(`  Duration: ${sampleResolved.duration || 'N/A'}`);
      console.log(`  Artwork: ${sampleResolved.artworkUrl ? 'Yes' : 'No'}`);
      console.log(`  Audio: ${sampleResolved.audioUrl ? 'Yes' : 'No'}`);
    }
    
    console.log(`\n💡 Note: Many podcast:remoteItem references point to feeds that no longer exist.`);
    console.log(`This is normal - only ${((accessibleFeeds / Object.keys(feedGroups).length) * 100).toFixed(1)}% of feeds were accessible.`);
    
  } catch (error) {
    console.error('❌ Error in intelligent resolution:', error.message);
  }
}

resolveMetadataIntelligently();
