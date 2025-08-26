const fs = require('fs');
const path = require('path');

const batch4 = [
  { feedGuid: "8c8f0146-5ed0-5c41-978c-ddc7478de179", itemGuid: "979671be-64a1-4de9-b001-39ef63db5f49" },
  { feedGuid: "cb7e7b12-7267-560f-88ae-9f467b44125d", itemGuid: "3281988d-df55-4bd3-95f9-dfcea4456f42" },
  { feedGuid: "b9ee4d5d-77e7-56a4-a195-397ae28a3dfe", itemGuid: "e92721f0-4291-4b50-a621-f658d875e640" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "fabc3e64-e470-4f97-bf4a-3957e481e23b" },
  { feedGuid: "3e2b4e09-4ce4-5721-95cf-06d2e9eed1d8", itemGuid: "0e9893ca-b029-4a09-a298-9c174e3d50e9" },
  { feedGuid: "244d54e6-2636-5f71-907a-8597416a3adf", itemGuid: "bcd6125c-83dc-499e-8f14-f045e334f4f5" },
  { feedGuid: "8d3a94a0-3195-52f4-9bb9-c3f5ea776e1c", itemGuid: "661bbac0-b505-4273-8fb6-2a5d6f47dcc4" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "1c8b3ce3-45b6-4f7e-b5d6-10568e3328e4" },
  { feedGuid: "d85346a6-d269-5ea2-be71-33172fb91cbb", itemGuid: "07cb01df-b6fc-4b70-9e45-16cc964e6f0e" },
  { feedGuid: "0c6afa48-18cd-50f3-b89f-27e73086d594", itemGuid: "bbee37a4-2d36-4a30-ae90-778c68540564" },
  { feedGuid: "6fb21488-518c-5646-818f-199ebe72870a", itemGuid: "d772e395-4071-4676-8567-d81c1089b99b" },
  { feedGuid: "a3bea9ac-a802-53b1-b4c8-df261bb6174a", itemGuid: "d4d7d9ed-86e5-4468-b9a9-af23a4ba560d" },
  { feedGuid: "4b52d66c-4b46-543f-abd3-e7cddecab8f1", itemGuid: "052d26ba-772d-43b3-82f7-18cc4b2e030d" },
  { feedGuid: "08a772ef-2fbc-5ecb-933f-025276502d1c", itemGuid: "16da033d-20dd-4d43-a20d-21c165287ef2" },
  { feedGuid: "a71b097b-4cf0-5e74-b6a9-1271373bb396", itemGuid: "a45376c3-c8b3-4173-80c4-4cdfa266e0db" },
  { feedGuid: "6e1b0838-4eff-5dd9-aa16-7b2481d077f9", itemGuid: "c0aaeff8-5a26-49cf-8dad-2b6909e4aed1" },
  { feedGuid: "e88e5602-7105-5c7c-8b27-54513aac0ce8", itemGuid: "ccc1470c-ad85-4ae8-bf3a-10d7db63c402" },
  { feedGuid: "e3bdb8c7-2966-5735-9d6a-45fd8c5c9ff6", itemGuid: "ca6cbf4b-71a0-4639-9fb7-f6daf5307696" },
  { feedGuid: "33049c93-e6d6-5377-a581-6db5a7cd0fd6", itemGuid: "d0ba026d-4ea5-52b2-82ed-e0ec8677a6c5" },
  { feedGuid: "f7d933c8-032a-52e5-9598-e34d833a3e8e", itemGuid: "64dc3bca-a8d2-47f8-9a74-fee2066d969a" }
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

addBatch(batch4, 'Batch 4');
