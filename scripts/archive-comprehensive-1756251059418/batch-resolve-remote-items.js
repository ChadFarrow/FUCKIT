#!/usr/bin/env node

const { resolveRemoteItem } = require('./resolve-remote-item');
const fs = require('fs');
const path = require('path');

// Save resolved data to database
async function saveToDatabase(trackData) {
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  
  try {
    // Load current database
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Check if track already exists by itemGuid
    const existingIndex = db.musicTracks.findIndex(t => t.itemGuid === trackData.itemGuid);
    
    if (existingIndex >= 0) {
      // Update existing
      db.musicTracks[existingIndex] = {
        ...db.musicTracks[existingIndex],
        ...trackData,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new
      db.musicTracks.push({
        id: `track-${db.musicTracks.length + 1}`,
        ...trackData,
        addedAt: new Date().toISOString()
      });
    }
    
    // Update metadata
    db.metadata.totalTracks = db.musicTracks.length;
    db.metadata.lastUpdated = new Date().toISOString();
    
    // Save database
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to save to database:', error.message);
  }
}

// Remote items to process
const remoteItems = [
  { feedGuid: "6fc2ad98-d4a8-5d70-9c68-62e9efc1209c", itemGuid: "aad6e3b1-6589-4e22-b8ca-521f3d888263" },
  { feedGuid: "dea01a9d-a024-5b13-84aa-b157304cd3bc", itemGuid: "52007112-2772-42f9-957a-a93eaeedb222" },
  { feedGuid: "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4", itemGuid: "d79f242f-0651-4b12-be79-c2bac234cfde" },
  { feedGuid: "3058af0c-1807-5732-9a08-9114675ef7d6", itemGuid: "c51ecaa4-f237-4707-9c62-2de611820e4b" },
  { feedGuid: "011c3a82-d716-54f7-9738-3d5fcacf65be", itemGuid: "c2ba80cc-add9-42ad-9a8f-b490436826ae" },
  { feedGuid: "0ab5bc9d-c9fb-52f4-8b8c-64be5edf322f", itemGuid: "7bc23b30-5d37-4e03-8256-543b7bf17ba8" },
  { feedGuid: "187f22db-79cb-5ac4-aa60-54e424e3915e", itemGuid: "83b608cb-fbb8-4cc4-895e-bd1cf2b08ae3" },
  { feedGuid: "265706d5-d6a1-5e96-b4c8-5db454844254", itemGuid: "fe6b1845-6b98-425d-aa07-9531474939de" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "7c823adf-1e53-4df1-98c0-979da81ec916" },
  { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "f9683d28-70df-4112-95c4-490c0383c3c9" },
  { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "d60032f3-ce45-45c4-81fc-26ff0394a248" },
  { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "a12d4410-03e0-44fd-bc8b-890760541a93" }
];

// Add delay to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processBatch() {
  console.log(`🚀 Processing ${remoteItems.length} remote items...\n`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Track feeds we've seen to add delays for rate limiting
  const feedsSeen = new Set();
  
  for (let i = 0; i < remoteItems.length; i++) {
    const item = remoteItems[i];
    console.log(`\n[${i + 1}/${remoteItems.length}] Processing item...`);
    console.log(`  Feed GUID: ${item.feedGuid}`);
    console.log(`  Item GUID: ${item.itemGuid}`);
    
    // Add delay if we've seen this feed before (to avoid rate limiting)
    if (feedsSeen.has(item.feedGuid)) {
      console.log('  ⏳ Waiting 2 seconds to avoid rate limiting...');
      await delay(2000);
    }
    feedsSeen.add(item.feedGuid);
    
    try {
      const trackData = await resolveRemoteItem(item.feedGuid, item.itemGuid);
      
      if (trackData) {
        // Save to database
        await saveToDatabase(trackData);
        
        results.successful.push({
          ...item,
          title: trackData.title,
          artist: trackData.artist,
          album: trackData.album
        });
        console.log(`  ✅ Success: "${trackData.title}" by ${trackData.artist}`);
      } else {
        results.failed.push(item);
        console.log(`  ❌ Failed to resolve`);
      }
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // Small delay between all requests
    if (i < remoteItems.length - 1) {
      await delay(500);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 BATCH PROCESSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(50));
  
  if (results.successful.length > 0) {
    console.log('\n✅ Successfully resolved tracks:');
    results.successful.forEach(track => {
      console.log(`  • "${track.title}" by ${track.artist} (${track.album})`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed items:');
    results.failed.forEach(item => {
      console.log(`  • Feed: ${item.feedGuid}, Item: ${item.itemGuid}`);
      if (item.error) console.log(`    Error: ${item.error}`);
    });
  }
}

// Run the batch processing
processBatch().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});