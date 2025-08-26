const fs = require('fs');
const path = require('path');

// Parallel processing configuration
const CONCURRENT_REQUESTS = 10; // Process 10 feeds at once
const DELAY_BETWEEN_BATCHES = 1000; // 1 second between batches
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFeedExists(feedGuid) {
  try {
    const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
    const response = await fetch(feedUrl, { method: 'HEAD' });
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

async function processFeedBatch(feedBatch, batchNumber) {
  console.log(`\n🚀 Processing Batch ${batchNumber}: ${feedBatch.length} feeds`);
  
  const results = await Promise.allSettled(
    feedBatch.map(async ({ feedGuid, tracks }) => {
      try {
        console.log(`  🎵 Testing feed: ${feedGuid} (${tracks.length} tracks)`);
        
        // Test if feed exists
        const feedExists = await testFeedExists(feedGuid);
        
        if (!feedExists) {
          console.log(`    ❌ Feed not accessible`);
          
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
          
          return { success: false, feedGuid, trackCount: tracks.length, reason: 'Feed not accessible' };
        }
        
        // Fetch feed metadata
        const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
        const xmlContent = await fetchWithRetry(feedUrl);
        
        if (!xmlContent) {
          console.log(`    ❌ Failed to fetch content`);
          
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
          
          return { success: false, feedGuid, trackCount: tracks.length, reason: 'Failed to fetch content' };
        }
        
        // Parse feed metadata
        const feedMetadata = parseRSSFeed(xmlContent);
        
        if (!feedMetadata || (!feedMetadata.title && !feedMetadata.artist)) {
          console.log(`    ⚠️  No metadata found`);
          
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
          
          return { success: false, feedGuid, trackCount: tracks.length, reason: 'No metadata found' };
        }
        
        // Apply metadata to all tracks in this feed
        tracks.forEach(track => {
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
            source: 'wavlake-rss-parallel',
            metadata: feedMetadata
          });
        });
        
        console.log(`    ✅ Resolved: ${feedMetadata.title || 'Unknown'} by ${feedMetadata.artist || 'Unknown'} (${tracks.length} tracks)`);
        
        return { 
          success: true, 
          feedGuid, 
          trackCount: tracks.length, 
          metadata: feedMetadata 
        };
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `Processing error: ${error.message}`,
            reason: 'Processing exception'
          });
        });
        
        return { success: false, feedGuid, trackCount: tracks.length, reason: error.message };
      }
    })
  );
  
  // Summarize batch results
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
  
  console.log(`  📊 Batch ${batchNumber} complete: ${successful} successful, ${failed} failed`);
  
  return results;
}

async function resolveMetadataInParallel() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    const tracksToResolve = musicTracks.filter(track => 
      track.itemGuid && track.itemGuid._ && 
      track.resolutionStatus === 'pending'
    );
    
    console.log(`🚀 Starting PARALLEL metadata resolution for ${tracksToResolve.length} tracks...`);
    console.log(`⚡ Processing ${CONCURRENT_REQUESTS} feeds at once\n`);
    
    // Group tracks by feedGuid
    const feedGroups = {};
    tracksToResolve.forEach(track => {
      const feedGuid = track.feedGuid;
      if (!feedGroups[feedGuid]) {
        feedGroups[feedGuid] = [];
      }
      feedGroups[feedGuid].push(track);
    });
    
    const feedEntries = Object.entries(feedGroups).map(([feedGuid, tracks]) => ({ feedGuid, tracks }));
    console.log(`📊 Found ${feedEntries.length} unique feeds to process in parallel\n`);
    
    let totalResolvedCount = 0;
    let totalFailedCount = 0;
    let accessibleFeeds = 0;
    let inaccessibleFeeds = 0;
    
    const startTime = Date.now();
    
    // Process feeds in batches
    for (let i = 0; i < feedEntries.length; i += CONCURRENT_REQUESTS) {
      const batch = feedEntries.slice(i, i + CONCURRENT_REQUESTS);
      const batchNumber = Math.floor(i / CONCURRENT_REQUESTS) + 1;
      
      const batchResults = await processFeedBatch(batch, batchNumber);
      
      // Count results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          totalResolvedCount += result.value.trackCount;
          accessibleFeeds++;
        } else {
          const trackCount = result.status === 'fulfilled' ? result.value.trackCount : 1;
          totalFailedCount += trackCount;
          inaccessibleFeeds++;
        }
      });
      
      // Save progress after each batch
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      console.log(`  💾 Progress saved after batch ${batchNumber}`);
      
      // Delay between batches to be respectful
      if (i + CONCURRENT_REQUESTS < feedEntries.length) {
        console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Create final backup
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-parallel-resolved-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    // Final statistics
    const finalStats = {
      total: musicTracks.length,
      remoteTracks: musicTracks.filter(t => t.itemGuid && t.itemGuid._).length,
      resolved: musicTracks.filter(t => t.resolutionStatus === 'resolved').length,
      pending: musicTracks.filter(t => t.resolutionStatus === 'pending').length,
      failed: musicTracks.filter(t => t.resolutionStatus === 'failed').length
    };
    
    console.log(`\n🎯 PARALLEL Resolution Complete:`);
    console.log(`  ⏱️  Total time: ${(totalTime/1000).toFixed(1)}s`);
    console.log(`  ⚡ Processing speed: ${(feedEntries.length / (totalTime/1000)).toFixed(1)} feeds/second`);
    console.log(`  📡 Accessible feeds: ${accessibleFeeds}/${feedEntries.length}`);
    console.log(`  ❌ Inaccessible feeds: ${inaccessibleFeeds}/${feedEntries.length}`);
    console.log(`  ✅ Resolved tracks: ${totalResolvedCount}`);
    console.log(`  ❌ Failed tracks: ${totalFailedCount}`);
    console.log(`  💾 Backup created: ${backupPath}`);
    
    console.log(`\n📊 Final Database Statistics:`);
    console.log(`  Total tracks: ${finalStats.total}`);
    console.log(`  Remote item tracks: ${finalStats.remoteTracks}`);
    console.log(`  ✅ Resolved: ${finalStats.resolved}`);
    console.log(`  ⏳ Pending: ${finalStats.pending}`);
    console.log(`  ❌ Failed: ${finalStats.failed}`);
    console.log(`  📈 Success rate: ${((finalStats.resolved / finalStats.remoteTracks) * 100).toFixed(1)}%`);
    
    // Show sample resolved tracks
    const sampleResolved = musicTracks.filter(t => t.resolutionStatus === 'resolved').slice(0, 5);
    if (sampleResolved.length > 0) {
      console.log(`\n🎶 Sample Resolved Tracks:`);
      sampleResolved.forEach(track => {
        console.log(`  • ${track.title} by ${track.artist}`);
      });
    }
    
    console.log(`\n🚀 Parallel processing complete! Your tracks now have real metadata!`);
    
  } catch (error) {
    console.error('❌ Error in parallel resolution:', error.message);
  }
}

resolveMetadataInParallel();
