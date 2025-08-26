const fs = require('fs');
const path = require('path');

const batch10 = [
  { feedGuid: "bdcd7a0e-8cd3-5260-be61-3d3976013eea", itemGuid: "55375344-9f4d-593b-b90c-c7e3335ff6d8" },
  { feedGuid: "aac951ff-5eff-51b0-acc2-8d0c04900bd3", itemGuid: "15aafcd6-1c93-4429-aebd-b0ea4466bf24" },
  { feedGuid: "f800d241-34a2-5e38-93e0-71ad738fbeeb", itemGuid: "0cbf7989-bbf9-4a12-a0b0-0cb07fdb7f7f" },
  { feedGuid: "88483050-0cad-58e4-8079-c5ffda052219", itemGuid: "33657a77-1dbb-4a87-985f-1c776c78e081" },
  { feedGuid: "9800cffd-0260-5e32-94e1-86f4a4c1acc5", itemGuid: "f6d2b55a-2596-40f7-9b9e-b8e96a84e838" },
  { feedGuid: "d7dd77d0-63d8-552e-ac8c-c3c950117aec", itemGuid: "cc51e396-2105-43b2-8acd-b2836b3950f4" },
  { feedGuid: "5d7cffa8-35b5-5e3a-8368-15accda89feb", itemGuid: "c4a2fe30-00ce-4c9f-9ab5-d3fb5192a565" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "58f0d461-7ff0-4abc-bb04-3919cabf61a8" },
  { feedGuid: "9a586e61-bfa5-5c10-94e3-202ceefc2405", itemGuid: "1006e0ad-dc79-4a48-8d50-011efaa4f36e" },
  { feedGuid: "19835a35-b7d1-5fee-8d67-a89d996098e1", itemGuid: "30c985a0-d6fc-46da-9886-dca0d4c40f87" },
  { feedGuid: "38f290e4-e6d6-52d0-a52b-9fd9948e7dc8", itemGuid: "c2eeed20-1c5e-4e05-a4a9-30e8521207db" },
  { feedGuid: "955bc336-5e61-5b01-8703-950919bf28ae", itemGuid: "e0d74356-030b-4e0c-9902-445ae113f056" },
  { feedGuid: "d4173781-d8ad-5ee6-af5d-28f84726bf55", itemGuid: "04cead49-6aab-46ca-af7e-01c51c3bddbf" },
  { feedGuid: "4f8f8ac0-1dba-5d8d-ad26-4959369301d2", itemGuid: "69e5fc94-e49e-4d5a-8fa3-fa4de462c19f" },
  { feedGuid: "6783ed8f-08da-5d80-bf8a-815eb3cd89f2", itemGuid: "8674204a-f4d9-4619-b166-2405122e299f" },
  { feedGuid: "79ab151b-fdbb-5cf1-b565-2833deb02efe", itemGuid: "00282719-742f-4afb-b1f3-80457946632c" },
  { feedGuid: "0c0d756c-5e6b-5b8f-a3e3-11954402db9e", itemGuid: "0fe51d40-ee63-43da-a609-593d358ac064" },
  { feedGuid: "66f21a18-284f-54d6-951b-5d8cf2baee4a", itemGuid: "096d4743-571c-40b5-8a13-c9091030ee60" },
  { feedGuid: "7f762d4c-d702-5e9f-b0fa-2fdfeffa976d", itemGuid: "d38e74f2-5df3-40e0-8c05-5f018ee5de6e" },
  { feedGuid: "50fa357a-c445-53f2-9abd-cc092eaa7419", itemGuid: "61a2a040-3f46-4434-99e0-5b35a3dfae02" }
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

addBatch(batch10, 'Batch 10');
