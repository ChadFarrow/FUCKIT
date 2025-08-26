const fs = require('fs');
const path = require('path');

// The missing remote item GUIDs from the previous check
const missingRemoteItems = [
  { feedGuid: "95e5f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "d79f242f-0651-4b12-be79-c2bac234cfde" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "7c823adf-1e53-4df1-98c0-979da81ec916" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" },
  { feedGuid: "95e5f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "bfe9ed47-ac2a-4fc6-be19-6ab94f75c4c4" },
  { feedGuid: "95e5f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "3587c342-cd4a-481c-838c-de242e5beb0b" },
  { feedGuid: "7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93", itemGuid: "3a5a784f-642f-41ab-b552-8c710415b8c6" },
  { feedGuid: "d13eab76-a4c4-5e4b-a0fb-25ed1386bc51", itemGuid: "58cf0bcf-bf66-46a1-8759-314def6d76e5" }
];

// Map feed GUIDs to their Wavlake RSS feed URLs using the correct pattern
function getWavlakeFeedUrl(feedGuid) {
  return `https://wavlake.com/feed/music/${feedGuid}`;
}

async function fetchWavlakeFeed(feedUrl, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  🔍 Fetching: ${feedUrl} (attempt ${attempt}/${maxRetries})`);
      
      const response = await fetch(feedUrl);
      
      if (response.status === 429) {
        console.log(`  ⏳ Rate limited, waiting 5s before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      return xmlText;
      
    } catch (error) {
      console.log(`  ❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

function parseWavlakeRSSForTrack(xmlText, targetItemGuid) {
  try {
    // Wavlake RSS structure is quite simple, let's parse it line by line
    const lines = xmlText.split('\n');
    
    let currentTrack = {};
    let foundTrack = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for the specific item GUID
      if (line.includes(targetItemGuid)) {
        foundTrack = true;
        currentTrack.itemGuid = targetItemGuid;
        
        // Look backwards and forwards for metadata
        for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 10); j++) {
          const metadataLine = lines[j].trim();
          
          // Extract title (usually in CDATA)
          if (metadataLine.includes('<!\\[CDATA\\[') && metadataLine.includes('\\]\\]>')) {
            const titleMatch = metadataLine.match(/<!\\[CDATA\\[(.*?)\\]\\]>/);
            if (titleMatch) {
              currentTrack.title = titleMatch[1].trim();
            }
          }
          
          // Extract artist (usually after the title)
          if (metadataLine.includes('https://wavlake.com/') && !metadataLine.includes('feed/') && !metadataLine.includes('album/')) {
            const artistMatch = metadataLine.match(/https:\/\/wavlake\.com\/([^\/\s]+)/);
            if (artistMatch) {
              currentTrack.artist = artistMatch[1];
            }
          }
          
          // Extract duration (format: HH:MM:SS)
          if (metadataLine.match(/^\d{2}:\d{2}:\d{2}$/)) {
            currentTrack.duration = metadataLine;
          }
          
          // Extract date (format: Day, DD Mon YYYY HH:MM:SS GMT)
          if (metadataLine.match(/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/)) {
            currentTrack.pubDate = metadataLine;
          }
        }
        
        break;
      }
    }
    
    if (foundTrack) {
      return currentTrack;
    } else {
      console.log(`  ⚠️  Track not found in RSS feed`);
      return null;
    }
    
  } catch (error) {
    console.log(`  ❌ Error parsing RSS: ${error.message}`);
    return null;
  }
}

async function resolveMissingWavlakeTracks() {
  try {
    console.log('🔍 Resolving missing podcast:remoteItem tracks via Wavlake RSS feeds...\n');
    
    // Read existing database
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📊 Current database size: ${musicTracks.length} tracks`);
    console.log(`🎯 Resolving ${missingRemoteItems.length} missing tracks\n`);
    
    const resolvedTracks = [];
    const failedTracks = [];
    
    // Process each missing remote item
    for (let i = 0; i < missingRemoteItems.length; i++) {
      const { feedGuid, itemGuid } = missingRemoteItems[i];
      console.log(`📦 Processing ${i + 1}/${missingRemoteItems.length}: ${itemGuid}`);
      
      try {
        // Get Wavlake feed URL
        const feedUrl = getWavlakeFeedUrl(feedGuid);
        console.log(`  📡 Feed URL: ${feedUrl}`);
        
        // Fetch RSS feed
        const xmlText = await fetchWavlakeFeed(feedUrl);
        
        // Parse for specific track
        const trackData = parseWavlakeRSSForTrack(xmlText, itemGuid);
        
        if (!trackData) {
          console.log(`  ❌ Could not parse track data`);
          failedTracks.push({ feedGuid, itemGuid, error: 'Could not parse track data' });
          continue;
        }
        
        // Find existing placeholder track and update it
        const existingTrackIndex = musicTracks.findIndex(track => 
          track.itemGuid && track.itemGuid._ === itemGuid
        );
        
        if (existingTrackIndex !== -1) {
          // Update existing placeholder track
          const existingTrack = musicTracks[existingTrackIndex];
          
          existingTrack.title = trackData.title || existingTrack.title;
          existingTrack.artist = trackData.artist || existingTrack.artist;
          existingTrack.feedArtist = trackData.artist || existingTrack.feedArtist;
          existingTrack.duration = trackData.duration || existingTrack.duration;
          existingTrack.pubDate = trackData.pubDate || existingTrack.pubDate;
          existingTrack.feedUrl = feedUrl;
          existingTrack.source = 'podcast:remoteItem (Wavlake RSS)';
          existingTrack.resolvedDate = new Date().toISOString();
          delete existingTrack.note; // Remove the placeholder note
          
          resolvedTracks.push(existingTrack);
          console.log(`  ✅ Updated: "${trackData.title}" by ${trackData.artist}`);
        } else {
          console.log(`  ❌ Could not find existing track to update`);
          failedTracks.push({ feedGuid, itemGuid, error: 'Could not find existing track to update' });
        }
        
        // Rate limiting
        if (i < missingRemoteItems.length - 1) {
          console.log(`  ⏳ Waiting 2s before next request...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`  ❌ Error processing track: ${error.message}`);
        failedTracks.push({ feedGuid, itemGuid, error: error.message });
      }
    }
    
    // Save updated database
    console.log('\n💾 Saving updated database...');
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-wavlake-resolution-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      totalMissing: missingRemoteItems.length,
      resolved: resolvedTracks.length,
      failed: failedTracks.length,
      resolvedTracks: resolvedTracks.map(track => ({
        title: track.title,
        artist: track.artist,
        itemGuid: track.itemGuid._,
        feedGuid: track.feedGuid,
        duration: track.duration
      })),
      failedTracks: failedTracks
    };
    
    const reportPath = path.join(__dirname, '..', 'data', 'missing-wavlake-tracks-resolution-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\n📊 RESOLUTION SUMMARY:');
    console.log(`✅ Successfully resolved: ${resolvedTracks.length}`);
    console.log(`❌ Failed to resolve: ${failedTracks.length}`);
    console.log(`📊 Database size: ${musicTracks.length} tracks`);
    console.log(`💾 Database saved to: ${musicTracksPath}`);
    console.log(`📋 Backup created: ${backupPath}`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    if (resolvedTracks.length > 0) {
      console.log('\n🎵 RESOLVED TRACKS:');
      resolvedTracks.forEach((track, index) => {
        console.log(`  ${index + 1}. "${track.title}" by ${track.artist}`);
        console.log(`     Item GUID: ${track.itemGuid._}`);
        console.log(`     Feed GUID: ${track.feedGuid}`);
        console.log(`     Duration: ${track.duration || 'N/A'}`);
        console.log('');
      });
    }
    
    if (failedTracks.length > 0) {
      console.log('\n❌ FAILED TRACKS:');
      failedTracks.forEach((track, index) => {
        console.log(`  ${index + 1}. Feed: ${track.feedGuid}`);
        console.log(`     Item: ${track.itemGuid}`);
        console.log(`     Error: ${track.error}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error resolving missing Wavlake tracks:', error);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('📦 Installing node-fetch for Node.js compatibility...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    global.fetch = require('node-fetch');
  } catch (error) {
    console.error('❌ Failed to install node-fetch. Please run: npm install node-fetch@2');
    process.exit(1);
  }
}

resolveMissingWavlakeTracks();
