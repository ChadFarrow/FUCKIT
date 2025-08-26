const fs = require('fs');
const path = require('path');

const batch11 = [
  { feedGuid: "5888ede6-1656-43cb-9c4a-50c05abcc2a0", itemGuid: "31cb107e-e699-4821-a1a0-91f8ecb9b413" },
  { feedGuid: "2528b894-9203-5c0e-890b-9ae1e3edab52", itemGuid: "dcabe88b-dd41-4aae-b481-6f368e68ccf0" },
  { feedGuid: "57203632-2003-55d2-b710-c699db963f18", itemGuid: "ce8fe9e8-7ed5-476e-b0d7-45af9715954c" },
  { feedGuid: "beeeef0b-51e9-52ac-b8d7-9ed54d5be3b0", itemGuid: "8ed4bcfe-a4f9-42a7-9529-d30c3d634656" },
  { feedGuid: "938fb611-602e-5b30-b49a-38840410d0e0", itemGuid: "35fd636c-2d89-4b62-ad5a-dbf8bef3e377" },
  { feedGuid: "94bc4847-e2e8-55d9-9a47-3a720a367a0e", itemGuid: "957d0dfb-9bde-4c39-b063-2f6bc1db197b" },
  { feedGuid: "141b86d8-76bc-581a-adf1-2f836a4dde91", itemGuid: "612c68ca-d87a-4ed8-9fb0-e1f101ae5dbb" },
  { feedGuid: "d6d051f1-16e4-5131-a2f5-c89570a37f8e", itemGuid: "c2265c79-4c24-40e2-867e-8c773332bf32" },
  { feedGuid: "75078ec0-e0ab-5873-ad66-3908a0eebf30", itemGuid: "5f365d87-f277-4ba3-9b71-b4dd55423ff8" },
  { feedGuid: "0ee92047-b48d-5a45-80a5-f8c385a942d5", itemGuid: "e144e64d-8567-4402-a0f3-bcd57c6d5289" },
  { feedGuid: "c59cad2b-1733-5806-83ad-3c53bbda4630", itemGuid: "04cead49-6aab-46ca-af7e-01c51c3bddbf" },
  { feedGuid: "6725424d-08a9-5fc2-a352-b8b2dd09a323", itemGuid: "f486b2ff-97ca-4ffa-b6da-97ed4d8baae8" },
  { feedGuid: "3074902b-b2dc-5877-bfc3-30f5df0fbe6a", itemGuid: "c59c7ffe-3847-4d55-ac27-5a1c1fbe6140" },
  { feedGuid: "2734aa78-6f70-5c26-8592-e49a3306913e", itemGuid: "15bd4aa2-a9b1-41d5-a26f-84b7665d0034" },
  { feedGuid: "65af69db-7dcf-5c95-bf27-7526a6dbce35", itemGuid: "9aba1fe8-b050-43ad-ae56-7d37b66348a2" },
  { feedGuid: "60e9fcee-0285-5ba9-870f-7e4c381ef846", itemGuid: "4554be73-db5e-40b1-aa1f-ff34fe39f1bf" },
  { feedGuid: "99a14604-f38b-5e9d-8679-9314d1207cd4", itemGuid: "6dbd199a-524c-41c4-a016-201a46cee93a" },
  { feedGuid: "6782774c-17e1-5f60-821f-93a9d5296da7", itemGuid: "7c3ff17b-5950-4be9-a0e8-fdce4ca30402" },
  { feedGuid: "0e346ae4-651a-52ca-a916-512c32e23d0b", itemGuid: "32cd383d-f0c3-4b4d-8243-37816e234c81" },
  { feedGuid: "a3bea9ac-a802-53b1-b4c8-df261bb6174a", itemGuid: "d4d7d9ed-86e5-4468-b9a9-af23a4ba560d" }
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

addBatch(batch11, 'Batch 11');
