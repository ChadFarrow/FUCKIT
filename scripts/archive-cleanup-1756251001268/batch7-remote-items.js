const fs = require('fs');
const path = require('path');

const batch7 = [
  { feedGuid: "0ab712d1-906c-5871-95d5-ebd61c197656", itemGuid: "674828fa-fdd7-426a-af5c-7a5fdb3cc611" },
  { feedGuid: "27aaf1a2-183c-5a05-ab67-c2cafee57e8f", itemGuid: "312eada9-14fe-492d-aa2a-3660d4d62f79" },
  { feedGuid: "7b1e83e1-6dde-5d3b-a360-f937f6a559ca", itemGuid: "0f1d2068-61d7-5947-8fae-dd4ffa08f077" },
  { feedGuid: "28f99d56-e130-5f41-8703-92498ce065c9", itemGuid: "9183596e-2c2d-4457-aae4-d507d7a1592d" },
  { feedGuid: "85f752c0-51a3-5c7b-a0a1-122467501970", itemGuid: "bf526de1-e608-4574-8ff8-703a21a5b11b" },
  { feedGuid: "57de72ad-fb6d-5c59-8dab-ee3036ac2eca", itemGuid: "51a182e2-6503-4220-b0ff-05df252bf0ef" },
  { feedGuid: "d00c6009-bc6f-5366-a2b0-2b47a6495d2f", itemGuid: "f4397a4a-4cab-50ac-b385-e2e2f4fbf3c2" },
  { feedGuid: "7196a738-2282-568a-a9be-be23f8bdb293", itemGuid: "d41b3afd-73e4-4a66-a84d-b3539cb167e1" },
  { feedGuid: "03682fbc-b8e7-505e-b5d2-8cb0f32ff2cf", itemGuid: "9d4389c6-5e6d-5f45-bbd7-d49e43f6414b" },
  { feedGuid: "bed86ef6-6524-5d8e-9374-6305ac0f15c6", itemGuid: "1c9473cb-f31a-575f-83f7-37e8d8051fca" },
  { feedGuid: "72924f59-8f37-5e20-aa4e-640f18881ff9", itemGuid: "25022951-243e-4505-ad61-961c01ad0073" },
  { feedGuid: "4736741a-99d4-5e66-966b-8e694be1eedf", itemGuid: "7770ec72-4ab6-5102-8ded-ef0db4a29144" },
  { feedGuid: "40bc6954-954f-5534-837e-d7ec0a08fa9e", itemGuid: "247fee83-7077-4a39-9ef2-124f51042396" },
  { feedGuid: "47768d25-74d9-5ba4-82db-aeaa7f50e29c", itemGuid: "b1d3af49-e178-4153-94ab-8427e69429e4" },
  { feedGuid: "4e8787a3-3374-55ca-890d-dcd0cf92b324", itemGuid: "7b0dac74-f975-4c67-9c2e-da6d1f84e6c6" },
  { feedGuid: "03caca07-e5ea-5394-a7bb-5cb27e4b209c", itemGuid: "ea5bc656-463c-470b-9d75-48c2dfcd4bf2" },
  { feedGuid: "bcd811d1-9fda-51d9-b2a6-9337f0131b66", itemGuid: "2bccb27e-ee8e-4741-a460-e06e33dc3296" },
  { feedGuid: "3aea8c54-1f96-5917-9f49-d72b2941547c", itemGuid: "30c518e7-db7b-4d8f-869d-fa54db9a319e" },
  { feedGuid: "2154ae08-182b-5dfe-a9e2-147730f3dafb", itemGuid: "a0c55da8-f7b8-44ef-9343-66e5e93ffc1b" },
  { feedGuid: "b0c1dc73-7bf6-579a-86c6-86ecfe731554", itemGuid: "f52cbd51-3bd0-433f-9c9b-a9d640b7b487" }
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

addBatch(batch7, 'Batch 7');
