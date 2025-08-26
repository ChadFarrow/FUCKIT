const fs = require('fs');
const path = require('path');

const batch12 = [
  { feedGuid: "b8697322-13af-568f-a283-5022367c50a3", itemGuid: "3633147c-b046-4120-aa55-9c6df5739938" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "7ccdb8b1-e9c1-474a-acc5-3afcbbc0f261" },
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "660c8516-ba38-480a-9ce7-e70a17427842" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "e465a2ab-3ab2-4901-b64f-eb0b8961a861" },
  { feedGuid: "978a9ed0-1bef-5fb5-8abe-ba61c3b925e5", itemGuid: "e12b9dac-feb7-4418-92e0-3c32e6739b52" },
  { feedGuid: "265706d5-d6a1-5e96-b4c8-5db454844254", itemGuid: "c2045369-22bd-4e74-a43f-7758c801ba5d" },
  { feedGuid: "babd1567-2803-5ede-9a19-302c2fbf9eae", itemGuid: "32f6b55e-b769-4897-952d-dc5697728be6" },
  { feedGuid: "93d908ad-d668-526d-8f55-a345724d2e9c", itemGuid: "3b8dc0b1-ee66-4001-8521-5162399f16a4" },
  { feedGuid: "bc89b7c8-97a2-5536-8e21-d7814d3eefee", itemGuid: "c61b0cf3-7e69-4350-9680-bd3ee259bedc" },
  { feedGuid: "e15431dd-80e9-554f-a47b-a5377d7e9bb1", itemGuid: "e1fb9fff-2669-4690-b935-fcd4f9190c75" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "1ea099a5-bb58-493a-ba4f-fa3e47502f60" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "f69cd5a5-2018-411b-afc1-00ab12142e83" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "3c506193-5247-41bf-9d5d-6d8c7571142c" },
  { feedGuid: "8310643a-9719-503c-b20a-23a3a71d3c9d", itemGuid: "e604da49-e46f-4850-8e0a-7b9c62e1312b" },
  { feedGuid: "4e4cfa62-3f77-5ae5-8d31-afb210d205d1", itemGuid: "2b86228e-bc6c-4451-86c3-dae92d93ce81" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "7ad63686-68ca-49fb-b5f3-a5426f1e87c9" },
  { feedGuid: "96524e8c-90c3-5002-b95a-cfff220c8bed", itemGuid: "0b3188a2-ca8e-4f2a-b78e-68145f8d68d9" },
  { feedGuid: "384d77cf-dadf-5774-b967-835a77ab2c99", itemGuid: "https://www.falsefinish.club/wp-content/uploads/2023/05/01.-Oops_24Bit_Aria_Master_MTC.mp3" },
  { feedGuid: "474e7f5d-d5e6-5594-82ba-651b8df4739c", itemGuid: "86e3fd3e-d905-4161-84f2-78cede5d0d8b" },
  { feedGuid: "47081700-bd65-511f-b535-f545f3cd660c", itemGuid: "7b03666e-b323-499d-93a7-ca51ce627ffd" }
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

addBatch(batch12, 'Batch 12');
