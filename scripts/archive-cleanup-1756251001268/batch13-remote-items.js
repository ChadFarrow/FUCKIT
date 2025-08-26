const fs = require('fs');
const path = require('path');

const batch13 = [
  { feedGuid: "4ea5686d-199f-5076-892b-bf50c2f904ae", itemGuid: "2e769548-9ffd-4ffd-92b6-4221d4913138" },
  { feedGuid: "9c01dad6-4831-5e56-a7c5-b5663a5805c7", itemGuid: "29df4cfe-0999-4b8b-bcd8-d2ae78feb857" },
  { feedGuid: "6782774c-17e1-5f60-821f-93a9d5296da7", itemGuid: "ff5a733d-3d01-4d33-b481-04fe3406c204" },
  { feedGuid: "5f073fbd-f8f3-5488-8ab1-701aee7bbeeb", itemGuid: "850eced6-44fb-4a49-8e9a-3b6e718f19d0" },
  { feedGuid: "424bdc29-d20b-5d17-afe6-c16a249cd8ee", itemGuid: "05e0f5fd-4cc7-4e49-a1d0-7e9a49653dba" },
  { feedGuid: "04f0e777-881e-5425-b26e-4e3fe0a0831e", itemGuid: "66dcce12-ca2d-4709-b1d1-324211ccd89e" },
  { feedGuid: "a24fe7d6-3bce-50ef-90d8-62b40794c00d", itemGuid: "604d03b2-35ba-45d9-a00e-4c0ca409e670" },
  { feedGuid: "d5f5de7c-41c8-535a-9143-20418ac19231", itemGuid: "0de1e1bf-308c-48cf-9182-e14f281bc790" },
  { feedGuid: "4da9ed1a-5c3e-57c9-958f-3ed36880a26a", itemGuid: "8cc4281d-b82b-4631-800c-36becae784d8" },
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "caad3f52-ea66-4576-a2f5-671429f7cf65" },
  { feedGuid: "c94d67ad-83b5-5dd9-8941-48060d533018", itemGuid: "72e54ff1-5459-4ab4-a394-af01509fd37a" },
  { feedGuid: "9f52b4d4-6858-50d7-a132-5eb885d850d1", itemGuid: "1ea7aec4-cacc-4914-8757-12264ac91fdc" },
  { feedGuid: "08604071-83cc-5810-bec2-bea0f0cd0033", itemGuid: "19fcca83-7788-4a97-9c29-e383a5356a2f" },
  { feedGuid: "d577b6cd-8c41-548b-abba-60e1502a94df", itemGuid: "https://justcast.com/shows/44721/audioposts/1246518" },
  { feedGuid: "2c7c9f5f-a6d1-5fdf-8208-185d437fc83d", itemGuid: "0a5feec9-6428-437c-aa2b-867610510447" },
  { feedGuid: "1b261b5d-f833-5310-bbc3-0966cbe18634", itemGuid: "74f72990-cc1c-4e74-9ca0-ef833433346c" },
  { feedGuid: "607b4ce3-2373-5ce3-a6c5-0e612c28fa31", itemGuid: "6719e450-5301-45c1-935e-afd634e01cf5" },
  { feedGuid: "d46367eb-be3c-548a-9c27-fbf1dcf27f30", itemGuid: "c7003607-233e-40e8-b2fa-6465127d0076" },
  { feedGuid: "4ec13c27-8ba7-5f6b-9439-05ef43624518", itemGuid: "bac1b854-ec02-4a5d-ae15-fb980b3fc4b7" },
  { feedGuid: "e2c041df-4a80-54b5-883b-c2bebe22517f", itemGuid: "b54a4bc8-fe4d-4d0f-bf65-ddae29b501cf" }
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

addBatch(batch13, 'Batch 13');
