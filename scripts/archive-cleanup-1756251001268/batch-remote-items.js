const fs = require('fs');
const path = require('path');

// Batch 1 - Next 20 items
const batch1 = [
  { feedGuid: "d40f7804-4185-5f00-b4b4-500bc45b79fd", itemGuid: "20192b0a-bb65-4ecd-81ca-ba923932f0a6" },
  { feedGuid: "af99d1b4-e10e-503f-8321-8d748bdc76f8", itemGuid: "514b299d-935b-4424-9ab4-62eecf7ef0a7" },
  { feedGuid: "4147902c-1eed-5fab-9c08-58445007a75f", itemGuid: "0c283ce7-4e3c-4d61-867f-fc003b854e8a" },
  { feedGuid: "ad073105-34c1-5a79-838e-5cbadfb7ee47", itemGuid: "6afc3afc-e801-4ca1-a7bf-85cd3ea02034" },
  { feedGuid: "b27c1f56-dff1-5fdd-bdee-a00e50c4c3f1", itemGuid: "78a357ce-8d57-4635-a66e-1363ed789896" },
  { feedGuid: "1dc549bf-c1ef-5a30-813f-a2918d37b38d", itemGuid: "f5f51623-49f7-4c8d-ad7a-e1bafa10bab8" },
  { feedGuid: "9d340218-4da2-54b4-bd11-05d4f4cafbb7", itemGuid: "b2a1e980-f6b1-4950-bb55-6da61a4be006" },
  { feedGuid: "6c629968-1b0f-547f-9de0-4a1bc007faff", itemGuid: "beb1befc-0687-4430-8a6b-84ed4a813202" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "9ff8f18b-cc79-474c-a3e9-2948113b8bf5" },
  { feedGuid: "19835a35-b7d1-5fee-8d67-a89d996098e1", itemGuid: "042cf6f9-557a-441a-acfe-0b61b795f4ea" },
  { feedGuid: "69daacd1-1e22-574c-a296-601298837db6", itemGuid: "0d7a44ce-aeed-4275-a07c-6bc038d7c344" },
  { feedGuid: "08604071-83cc-5810-bec2-bea0f0cd0033", itemGuid: "bb9c21e4-6c98-44b9-bf0b-125d244bd013" },
  { feedGuid: "45874e17-fdfb-5693-a817-5e584da20e5b", itemGuid: "e646b30a-2007-4086-b35b-58570c33c159" },
  { feedGuid: "8e57173c-0dda-59d7-aeff-db1fb196ae77", itemGuid: "8d9ee740-55d9-4eb8-a52d-b9c090e24c60" },
  { feedGuid: "9906bb7d-2516-5945-893d-8e9897973cd3", itemGuid: "24480f65-beea-4466-924c-fa9f038c060a" },
  { feedGuid: "70b4915d-0c0b-5f7a-9980-82831d2a9ba2", itemGuid: "36fb707f-6d30-413f-a5df-61a47c207337" },
  { feedGuid: "70b4915d-0c0b-5f7a-9980-82831d2a9ba2", itemGuid: "f70e73ea-ffd3-41a6-866f-819c5b5f64c1" },
  { feedGuid: "70b4915d-0c0b-5f7a-9980-82831d2a9ba2", itemGuid: "b9471140-0674-4884-bbb5-39ce9c4a000f" },
  { feedGuid: "70b4915d-0c0b-5f7a-9980-82831d2a9ba2", itemGuid: "08a0bc1e-cd7b-4da7-acfc-d90e49a114b5" },
  { feedGuid: "3958ec40-6c16-59d8-9e4c-0273304e658a", itemGuid: "4210a086-d2b3-4d22-a1aa-39aa509caf89" }
];

async function addBatch(remoteItems, batchName) {
  try {
    console.log(`🔍 Processing ${batchName}...`);
    
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    const missingItems = [];
    let existingCount = 0;
    
    for (const item of remoteItems) {
      const exists = musicTracks.find(track => 
        track.itemGuid && track.itemGuid._ === item.itemGuid
      );
      
      if (exists) {
        existingCount++;
      } else {
        missingItems.push(item);
      }
    }
    
    console.log(`📊 ${batchName}: ${existingCount} existing, ${missingItems.length} missing`);
    
    if (missingItems.length === 0) {
      console.log(`✅ ${batchName}: All items already exist!`);
      return 0;
    }
    
    for (const item of missingItems) {
      const newTrack = {
        feedGuid: item.feedGuid,
        itemGuid: { _: item.itemGuid },
        title: `Track ${item.itemGuid.substring(0, 8)}`,
        artist: 'Unknown Artist',
        source: `podcast:remoteItem (${batchName})`,
        addedDate: new Date().toISOString()
      };
      
      musicTracks.push(newTrack);
    }
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    console.log(`✅ ${batchName}: Added ${missingItems.length} tracks. Total: ${musicTracks.length}`);
    
    return missingItems.length;
    
  } catch (error) {
    console.error(`❌ Error in ${batchName}:`, error.message);
    return 0;
  }
}

async function processBatches() {
  console.log('🚀 Starting batch processing...\n');
  
  const totalAdded = await addBatch(batch1, 'Batch 1');
  
  console.log(`\n🎯 Summary: Added ${totalAdded} new tracks`);
}

processBatches();
