const fs = require('fs');
const path = require('path');

const batch8 = [
  { feedGuid: "c19fa2a4-10c7-5226-bb66-1122e0217153", itemGuid: "bd09ac0e-04b0-4ffb-bbe5-884be207e509" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "8a483fb2-7853-4b67-853d-1a28ae08f5d5" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "13b9faaa-357e-4626-9e83-820bcef1cd8e" },
  { feedGuid: "d577b6cd-8c41-548b-abba-60e1502a94df", itemGuid: "https://justcast.com/shows/44721/audioposts/1246521" },
  { feedGuid: "75078ec0-e0ab-5873-ad66-3908a0eebf30", itemGuid: "9b209440-401a-495f-bb4b-9561a4fb398b" },
  { feedGuid: "508bfb27-3623-513c-9eda-0b512a2abc82", itemGuid: "a9bc2c02-a90b-403f-92db-794d40d2b7ca" },
  { feedGuid: "37cbeb0e-9dd4-55cc-af32-03b48508cfff", itemGuid: "2fde3ca7-9c38-4849-8c78-a5ef6172c261" },
  { feedGuid: "88fea384-4b51-50f1-b36b-5a1810465265", itemGuid: "3e93a63e-8d48-4369-866d-b0fd13a41f86" },
  { feedGuid: "514d7a21-041e-5e5f-b7d6-71aa7c7584db", itemGuid: "fcd4be7d-4cff-471c-945f-ee07d7fbcd59" },
  { feedGuid: "94c8a0bf-f76e-5f8c-ba1d-c0c15a642271", itemGuid: "b8c2544f-88ec-4cc2-a30f-98d3e4c25aea" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "ad80c239-4a23-4eae-bd62-9433b9bf5252" },
  { feedGuid: "d6913bce-b276-5204-bdfb-3a39cfae4af8", itemGuid: "b9ae61fa-6178-5cba-9d26-bd70f94459cc" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "50bc5e8f-050f-4f23-9255-96ec361059df" },
  { feedGuid: "19835a35-b7d1-5fee-8d67-a89d996098e1", itemGuid: "9fa6d465-2d77-4033-99fb-1136bf453dcf" },
  { feedGuid: "10bce65e-0494-5cf4-b9f0-97d786f44eb1", itemGuid: "4e398065-f06c-4363-a431-9d711add49cf" },
  { feedGuid: "f1b387a7-78ba-5d76-88dd-f47b34bc3eff", itemGuid: "c881c7ac-ed36-54fb-81d3-06309bf12e23" },
  { feedGuid: "703e92f0-0bec-58fe-b54c-10231e6ae93e", itemGuid: "a476e20c-f199-48a1-8fad-fff46da6e4a2" },
  { feedGuid: "a543e50f-141d-5079-9d23-3a5b0b2ef6ba", itemGuid: "e074df5a-552b-5d01-ba44-8979cc390342" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "3dedac40-8a50-4579-bea8-c7e488adba85" },
  { feedGuid: "5598e626-2e4c-5ab6-9599-5cdbe8d05427", itemGuid: "b1452847-9d2e-4476-b9c6-7f8b5a72a0de" }
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

addBatch(batch8, 'Batch 8');
