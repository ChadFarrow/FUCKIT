const fs = require('fs');
const path = require('path');

const batch3 = [
  { feedGuid: "69daacd1-1e22-574c-a296-601298837db6", itemGuid: "6cc25ad8-89f9-4646-9af9-9d6261c96c69" },
  { feedGuid: "04e812f9-1993-5aa1-9ab5-a9cf0cd81e82", itemGuid: "b383d516-6cd9-4853-b447-2c9181260189" },
  { feedGuid: "07e882cc-690e-544f-bccb-799730b4f3a9", itemGuid: "a01f64a3-025a-5f95-8bf7-7a99f7a65bc4" },
  { feedGuid: "4a156167-aea1-5bc3-9e7d-504477127f79", itemGuid: "3220a090-0355-4848-847a-450654f1de9f" },
  { feedGuid: "bcb53b0b-d88e-5e01-9e9d-dfeeae52e2c9", itemGuid: "b52979f8-2944-49ff-8453-da88d330f2f9" },
  { feedGuid: "7153bbb0-b8c4-521f-80c0-cef62d8ef67b", itemGuid: "405be9f7-684f-54b8-9035-009111f1933f" },
  { feedGuid: "dc8cc849-6db6-5780-a890-a54aa7d9ef81", itemGuid: "ebbd280e-6b3d-4ae0-9b70-fe03e3074c55" },
  { feedGuid: "ce61bb1f-b3ec-5f91-a238-ed870d678774", itemGuid: "c97211f3-ff4a-4107-b5e4-235e90255037" },
  { feedGuid: "bcea62c2-aeaa-5ff6-b18c-c8af1d1fef86", itemGuid: "e3887e9d-5cbe-42c6-a52e-e0c3a423dcc5" },
  { feedGuid: "1583ba4e-9b78-5393-924e-282b8e66c38b", itemGuid: "2aa3a264-cd1d-4325-b3ff-4438f588583b" },
  { feedGuid: "dbe0f59f-36c5-551b-a36f-7b5534c3eddd", itemGuid: "73c8436a-9419-4b51-87ce-6201670f1368" },
  { feedGuid: "ca8c1e63-1e3a-5e7c-9cc8-ef9291f67255", itemGuid: "de3f36bc-3270-5dba-94e0-fc9160d6b609" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "2155dfff-142f-4138-9607-65e8321bda85" },
  { feedGuid: "b5ef0e32-6ab6-54a5-9ebd-aeddc5481e3c", itemGuid: "950ca9f4-514d-4dfe-b52e-f1f7eb9267f9" },
  { feedGuid: "0fdef0d2-79ad-5977-95eb-8a966c75f1b0", itemGuid: "3ddbc84f-c000-458a-9d36-05fdb2f7ead2" },
  { feedGuid: "ff1e9aec-b8d3-5ba4-a550-0fd545d637b7", itemGuid: "6f43e508-3191-4574-87a6-37f4d9405617" },
  { feedGuid: "64043b90-b101-5b47-9266-35a5bb6003c2", itemGuid: "bfe6601d-006e-40fd-916f-6693f03ca84e" },
  { feedGuid: "7891de21-7e3f-5d3c-b0d3-fcafd4537777", itemGuid: "693daffc-3b45-44ab-a5f2-6c2246d1c8c8" },
  { feedGuid: "52786c48-86b4-5fd9-b4fe-7b44dcc3e4ba", itemGuid: "13468078-1a54-4b0e-92bc-2faea2999ae7" },
  { feedGuid: "4568fe70-686b-58d6-9de9-ef4a9c05c373", itemGuid: "6188230d-15b5-4763-ab18-d6d30642d16e" }
];

async function addBatch(remoteItems, batchName) {
  try {
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
    
    if (missingItems.length > 0) {
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      console.log(`✅ ${batchName}: Added ${missingItems.length} tracks. Total: ${musicTracks.length}`);
    }
    
    return missingItems.length;
    
  } catch (error) {
    console.error(`❌ Error in ${batchName}:`, error.message);
    return 0;
  }
}

addBatch(batch3, 'Batch 3');
