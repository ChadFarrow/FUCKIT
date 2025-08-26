const fs = require('fs');
const path = require('path');

const batch9 = [
  { feedGuid: "afc5df5b-bfce-5843-802d-3c074b06e969", itemGuid: "82199f7a-374c-4374-9428-81a59aacf937" },
  { feedGuid: "9bbdcae3-d31e-5c12-83d7-2209f4e59a96", itemGuid: "a4d9efe2-0057-4c49-b4b8-bd2f6b31379c" },
  { feedGuid: "49ec73c9-abe2-5a65-83d6-f7152b919df7", itemGuid: "3185beef-e16a-4c0b-a9a3-837bc2038e8b" },
  { feedGuid: "61514864-0b81-5de1-9067-05e3205ce859", itemGuid: "1ca53abb-7583-50bc-b969-e539f1bfecba" },
  { feedGuid: "17f28a04-ccb0-5897-84cb-996ba33d883d", itemGuid: "afbb67c8-08c9-49f2-b3b3-6272a09a2bfc" },
  { feedGuid: "3d526a90-0e3c-54c0-8497-cc643ece4e44", itemGuid: "4442d28d-eb81-4860-a001-cb975076d584" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "5f926d76-3ff5-49d9-8f22-2a6eccd86b1a" },
  { feedGuid: "3313081c-0406-59fa-ab95-01c30d03bbe0", itemGuid: "d029b907-2704-40c5-aae5-9a26bb8447cd" },
  { feedGuid: "69a45aaa-1a54-5709-b058-0c2d8e732643", itemGuid: "974c2fee-1154-40a4-8f04-915d4bf0feed" },
  { feedGuid: "5893882c-083e-5b4c-bbac-7991b5d255ac", itemGuid: "28764a81-8ba0-468b-951c-43b1d8da50a1" },
  { feedGuid: "69c634ad-afea-5826-ad9a-8e1f06d6470b", itemGuid: "45cb0eb4-baaa-4925-9de6-80dfa57205f4" },
  { feedGuid: "00addc23-7769-5471-bb9a-c0acb6f27437", itemGuid: "dc1f26d2-bc70-45e9-ac13-e85dfdef133c" },
  { feedGuid: "18c8a214-fccb-5083-be4d-d37ea9683391", itemGuid: "a96e7155-dd37-428b-a772-2c2e269228fd" },
  { feedGuid: "f0206f92-8118-50df-aa16-1754d994eb70", itemGuid: "d6af18ce-9adc-4c2b-b566-08a995f51e4c" },
  { feedGuid: "3d92b2f6-4aac-5f24-bffe-2536eb579286", itemGuid: "bda485d5-7c17-4b02-bd1a-5ded3132a61a" },
  { feedGuid: "822b93ec-7087-59ed-a1fa-7e959e99f812", itemGuid: "598b520a-929c-437b-8f1f-960f9df55a64" },
  { feedGuid: "b7842bf4-143a-51fc-be80-552e09b672ef", itemGuid: "1006e0ad-dc79-4a48-8d50-011efaa4f36e" },
  { feedGuid: "c58e87a0-dc16-5b1f-9987-5089e0c3d146", itemGuid: "ee9833ef-b1da-53cf-bfce-0842b5e17423" },
  { feedGuid: "858fc46f-6287-5e39-8268-46a91bccbbba", itemGuid: "933441f0-8b4e-4b5d-8dfe-6df83ca70107" },
  { feedGuid: "08d087dc-c837-5d7f-96c6-ced7713e82eb", itemGuid: "8ac47953-0d22-41a4-a4c4-0ab0981031d8" }
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
      console.log(`✅ ${batch9}: Added ${missingItems.length} tracks. Total: ${musicTracks.length}`);
    }
    
    return missingItems.length;
    
  } catch (error) {
    console.error(`❌ Error in ${batchName}:`, error.message);
    return 0;
  }
}

addBatch(batch9, 'Batch 9');
