const fs = require('fs');
const path = require('path');

// Batch 2 - Next 20 items
const batch2 = [
  { feedGuid: "6f59f470-6287-56de-9cdc-3098fe3982d7", itemGuid: "d9376418-f32b-4897-9b26-d291eccb38d8" },
  { feedGuid: "30ecd74c-3754-540a-aa80-b5474fb7c965", itemGuid: "b321c3a7-06e6-4fad-b50f-24d8de949789" },
  { feedGuid: "41ba1ce2-ad44-57a2-8f58-4d790b7868cb", itemGuid: "44dab77c-bf88-40df-beac-b7fcaa1c6328" },
  { feedGuid: "91704dad-11e8-5d84-aeec-cd44fc287c23", itemGuid: "31bb2c12-b10a-57ac-b25e-c28f3502154e" },
  { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "e046f9dd-aca3-4c7a-b396-2148a90ac0f2" },
  { feedGuid: "db73ae7e-01d7-5072-a033-28eb5a5259a3", itemGuid: "2f961722-6ab6-4cdd-9cb8-245b4cf680e5" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "bbc9bfe3-3db1-400b-9ff0-613f57899614" },
  { feedGuid: "b12d3157-1fbd-5afb-b7c8-aa2a4e00ff03", itemGuid: "6da125ba-a720-5d0a-ba94-cd591607935a" },
  { feedGuid: "d0f610b5-1469-50cc-a901-a0b0545f8ff8", itemGuid: "8d6b844f-f651-5783-a8d8-c76c86575e9c" },
  { feedGuid: "b36a8ae8-3bd9-5316-b63c-79de4572642b", itemGuid: "a232997d-de35-4543-9159-7e11a7b36f92" },
  { feedGuid: "c5a0aead-4457-56da-adce-18db89fb8376", itemGuid: "dcf341a7-981b-4c46-b0b1-614c8e9dad9c" },
  { feedGuid: "041b07a8-22e4-557e-9649-9eaf849b6317", itemGuid: "ea0c7bc9-7df2-4957-a1a3-71690ff776b9" },
  { feedGuid: "eda1c36b-0b18-5d4f-8696-cd96fd692ac9", itemGuid: "8ff22524-2ad4-4d86-8a26-7fc52f0a407c" },
  { feedGuid: "360a7725-2b26-5bda-99e0-8b2c08cc5926", itemGuid: "c29f1ae2-9184-469b-a8fc-cf68b6b53361" },
  { feedGuid: "9e3cea98-d04d-5190-88b3-46ee6030d4ea", itemGuid: "e020b55d-3439-40a1-8271-ba2d59081608" },
  { feedGuid: "37844ae6-7303-53d2-a733-aed9585d253f", itemGuid: "6baa5e31-8fc4-4960-b0d0-98303d6a6ad5" },
  { feedGuid: "db90765f-31fe-5e85-b7ca-8d76d2aeb65c", itemGuid: "45cf7c65-aad5-45bb-a729-7b7ca91f8e64" },
  { feedGuid: "8a246c08-eeda-5657-b3a1-108c22430f07", itemGuid: "c04dd750-2f6a-49ce-983f-f1f0096f6ba8" },
  { feedGuid: "3b4ab0e5-ac49-5955-a3b7-f20c1704dd1d", itemGuid: "948eb8dd-429c-4259-935e-141a4661cd4d" },
  { feedGuid: "6065ec4d-ff03-5ce6-9cae-2e9fa0d49268", itemGuid: "95bb164b-424f-4a1a-93f8-70c6f809f220" }
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

addBatch(batch2, 'Batch 2');
