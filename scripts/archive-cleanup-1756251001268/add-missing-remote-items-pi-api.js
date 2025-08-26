const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Podcast Index API credentials
const PI_API_KEY = "CM9M48BRFRTRMUCAWV82";
const PI_API_SECRET = "WbB4Yx7zFLWbUvCYccb8YsKVeN5Zd2SgS4tEQjet";
const PI_API_BASE = "https://api.podcastindex.org/api/1.0";

function generatePIAuthHeaders() {
  const now = Math.floor(Date.now() / 1000);
  const authString = PI_API_KEY + PI_API_SECRET + now;
  const hash = crypto.createHash('sha1').update(authString).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT/1.0',
    'X-Auth-Key': PI_API_KEY,
    'X-Auth-Date': now.toString(),
    'Authorization': hash
  };
}

async function lookupFeedByGuid(feedGuid) {
  try {
    console.log(`  🔍 Looking up feed by GUID: ${feedGuid}`);
    
    const url = `${PI_API_BASE}/podcasts/byfeedid?id=${feedGuid}`;
    const headers = generatePIAuthHeaders();
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'true' && data.feed) {
      return data.feed;
    } else {
      console.log(`  ❌ Feed not found in Podcast Index`);
      return null;
    }
    
  } catch (error) {
    console.log(`  ❌ Error looking up feed: ${error.message}`);
    return null;
  }
}

async function lookupEpisodeByGuid(itemGuid) {
  try {
    console.log(`  🔍 Looking up episode by GUID: ${itemGuid}`);
    
    const url = `${PI_API_BASE}/episodes/byguid?guid=${itemGuid}`;
    const headers = generatePIAuthHeaders();
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'true' && data.episode) {
      return data.episode;
    } else {
      console.log(`  ❌ Episode not found in Podcast Index`);
      return null;
    }
    
  } catch (error) {
    console.log(`  ❌ Error looking up episode: ${error.message}`);
    return null;
  }
}

async function addMissingRemoteItemsViaPI() {
  try {
    console.log('🔍 Adding missing podcast:remoteItem tracks via Podcast Index API...\n');
    
    // Read existing database
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📊 Current database size: ${musicTracks.length} tracks`);
    console.log(`🎯 Looking up ${missingRemoteItems.length} missing tracks\n`);
    
    const addedTracks = [];
    const failedTracks = [];
    
    // Process each missing remote item
    for (let i = 0; i < missingRemoteItems.length; i++) {
      const { feedGuid, itemGuid } = missingRemoteItems[i];
      console.log(`📦 Processing ${i + 1}/${missingRemoteItems.length}: ${itemGuid}`);
      
      try {
        // First try to look up the episode directly
        let episode = await lookupEpisodeByGuid(itemGuid);
        let feed = null;
        
        if (!episode) {
          // If episode not found, try to look up the feed
          feed = await lookupFeedByGuid(feedGuid);
          if (feed) {
            console.log(`  ✅ Found feed: "${feed.title}"`);
          }
        } else {
          console.log(`  ✅ Found episode: "${episode.title}"`);
        }
        
        // Create track entry based on what we found
        let newTrack = null;
        
        if (episode) {
          // We found the episode directly
          newTrack = {
            title: episode.title || 'Unknown Title',
            artist: episode.author || episode.feedAuthor || 'Unknown Artist',
            feedArtist: episode.feedAuthor || episode.author || 'Unknown Artist',
            duration: episode.duration || '',
            audioUrl: episode.enclosureUrl || '',
            imageUrl: episode.image || episode.feedImage || '',
            artworkUrl: episode.image || episode.feedImage || '',
            pubDate: episode.datePublished || episode.datePublishedPretty || '',
            itemGuid: { _: itemGuid, isPermaLink: "false" },
            feedGuid: feedGuid,
            feedUrl: episode.feedUrl || '',
            publisher: episode.feedAuthor || episode.author || 'Unknown Artist',
            source: 'podcast:remoteItem (PI API)',
            addedDate: new Date().toISOString()
          };
        } else if (feed) {
          // We found the feed but not the episode
          newTrack = {
            title: `Track from ${feed.title}`,
            artist: feed.author || 'Unknown Artist',
            feedArtist: feed.author || 'Unknown Artist',
            duration: '',
            audioUrl: '',
            imageUrl: feed.image || '',
            artworkUrl: feed.image || '',
            pubDate: '',
            itemGuid: { _: itemGuid, isPermaLink: "false" },
            feedGuid: feedGuid,
            feedUrl: feed.url || '',
            publisher: feed.author || 'Unknown Artist',
            source: 'podcast:remoteItem (PI API - feed only)',
            addedDate: new Date().toISOString(),
            note: 'Episode not found in PI, added based on feed info'
          };
        }
        
        if (newTrack) {
          // Add to database
          musicTracks.push(newTrack);
          addedTracks.push(newTrack);
          
          console.log(`  ✅ Added: "${newTrack.title}" by ${newTrack.artist}`);
        } else {
          console.log(`  ❌ Could not create track entry`);
          failedTracks.push({ feedGuid, itemGuid, error: 'No episode or feed data found' });
        }
        
        // Rate limiting
        if (i < missingRemoteItems.length - 1) {
          console.log(`  ⏳ Waiting 1s before next request...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-pi-api-addition-${Date.now()}.json`);
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
        feedGuid: track.feedGuid,
        source: track.source
      })),
      failedTracks: failedTracks
    };
    
    const reportPath = path.join(__dirname, '..', 'data', 'missing-remote-items-pi-api-addition-report.json');
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
        console.log(`     Source: ${track.source}`);
        if (track.note) console.log(`     Note: ${track.note}`);
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
    console.error('❌ Error adding missing remote items via PI API:', error);
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

addMissingRemoteItemsViaPI();
