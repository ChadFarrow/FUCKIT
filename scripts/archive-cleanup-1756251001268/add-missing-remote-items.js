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

// Map feed GUIDs to their RSS feed URLs (based on existing data patterns)
const feedGuidToUrlMap = {
  "95e5f9d8-35e3-51f5-a269-ba1df36b4bd8": "https://www.wavlake.com/feed/95e5f9d8-35e3-51f5-a269-ba1df36b4bd8",
  "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8": "https://www.wavlake.com/feed/5a95f9d8-35e3-51f5-a269-ba1df36b4bd8",
  "7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93": "https://www.wavlake.com/feed/7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93",
  "d13eab76-a4c4-5e4b-a0fb-25ed1386bc51": "https://www.wavlake.com/feed/d13eab76-a4c4-5e4b-a0fb-25ed1386bc51"
};

async function fetchRSSFeed(feedUrl, maxRetries = 3) {
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

function parseRSSForTrack(xmlText, targetItemGuid) {
  try {
    // Simple XML parsing to find the specific item
    const itemRegex = new RegExp(`<item[^>]*>.*?<guid[^>]*>${targetItemGuid}[^<]*</guid>.*?</item>`, 'gs');
    const itemMatch = xmlText.match(itemRegex);
    
    if (!itemMatch) {
      return null;
    }
    
    const itemXml = itemMatch[0];
    
    // Extract basic metadata
    const titleMatch = itemXml.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const artistMatch = itemXml.match(/<itunes:author[^>]*>([^<]+)<\/itunes:author>/);
    const artist = artistMatch ? artistMatch[1].trim() : '';
    
    const durationMatch = itemXml.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/);
    const duration = durationMatch ? durationMatch[1].trim() : '';
    
    const audioUrlMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="audio\/[^"]*"[^>]*>/);
    const audioUrl = audioUrlMatch ? audioUrlMatch[1].trim() : '';
    
    const imageUrlMatch = itemXml.match(/<itunes:image[^>]*href="([^"]+)"[^>]*>/);
    const imageUrl = imageUrlMatch ? imageUrlMatch[1].trim() : '';
    
    const pubDateMatch = itemXml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
    
    return {
      title,
      artist,
      duration,
      audioUrl,
      imageUrl,
      pubDate
    };
    
  } catch (error) {
    console.log(`  ❌ Error parsing RSS: ${error.message}`);
    return null;
  }
}

async function addMissingRemoteItems() {
  try {
    console.log('🔍 Adding missing podcast:remoteItem tracks to database...\n');
    
    // Read existing database
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📊 Current database size: ${musicTracks.length} tracks`);
    console.log(`🎯 Adding ${missingRemoteItems.length} missing tracks\n`);
    
    const addedTracks = [];
    const failedTracks = [];
    
    // Process each missing remote item
    for (let i = 0; i < missingRemoteItems.length; i++) {
      const { feedGuid, itemGuid } = missingRemoteItems[i];
      console.log(`📦 Processing ${i + 1}/${missingRemoteItems.length}: ${itemGuid}`);
      
      try {
        // Get feed URL
        const feedUrl = feedGuidToUrlMap[feedGuid];
        if (!feedUrl) {
          console.log(`  ❌ No feed URL mapping found for feedGuid: ${feedGuid}`);
          failedTracks.push({ feedGuid, itemGuid, error: 'No feed URL mapping' });
          continue;
        }
        
        // Fetch RSS feed
        const xmlText = await fetchRSSFeed(feedUrl);
        
        // Parse for specific track
        const trackData = parseRSSForTrack(xmlText, itemGuid);
        
        if (!trackData) {
          console.log(`  ❌ Track not found in RSS feed`);
          failedTracks.push({ feedGuid, itemGuid, error: 'Track not found in RSS' });
          continue;
        }
        
        // Create new track entry
        const newTrack = {
          title: trackData.title || 'Unknown Title',
          artist: trackData.artist || 'Unknown Artist',
          feedArtist: trackData.artist || 'Unknown Artist',
          duration: trackData.duration || '',
          audioUrl: trackData.audioUrl || '',
          imageUrl: trackData.imageUrl || '',
          artworkUrl: trackData.imageUrl || '',
          pubDate: trackData.pubDate || '',
          itemGuid: { _: itemGuid, isPermaLink: "false" },
          feedGuid: feedGuid,
          feedUrl: feedUrl,
          publisher: trackData.artist || 'Unknown Artist', // Use artist as publisher fallback
          source: 'podcast:remoteItem',
          addedDate: new Date().toISOString()
        };
        
        // Add to database
        musicTracks.push(newTrack);
        addedTracks.push(newTrack);
        
        console.log(`  ✅ Added: "${trackData.title}" by ${trackData.artist}`);
        
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
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-adding-missing-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      totalMissing: missingRemoteItems.length,
      added: addedTracks.length,
      failed: failedTracks.length,
      addedTracks: addedTracks.map(track => ({
        title: track.title,
        artist: track.artist,
        itemGuid: track.itemGuid._,
        feedGuid: track.feedGuid
      })),
      failedTracks: failedTracks
    };
    
    const reportPath = path.join(__dirname, '..', 'data', 'missing-remote-items-addition-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\n📊 ADDITION SUMMARY:');
    console.log(`✅ Successfully added: ${addedTracks.length}`);
    console.log(`❌ Failed to add: ${failedTracks.length}`);
    console.log(`📊 New database size: ${musicTracks.length} tracks`);
    console.log(`💾 Database saved to: ${musicTracksPath}`);
    console.log(`📋 Backup created: ${backupPath}`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    if (addedTracks.length > 0) {
      console.log('\n🎵 ADDED TRACKS:');
      addedTracks.forEach((track, index) => {
        console.log(`  ${index + 1}. "${track.title}" by ${track.artist}`);
        console.log(`     Item GUID: ${track.itemGuid._}`);
        console.log(`     Feed GUID: ${track.feedGuid}`);
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
    console.error('❌ Error adding missing remote items:', error);
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

addMissingRemoteItems();
