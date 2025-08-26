const fs = require('fs');
const path = require('path');

const batch5 = [
  { feedGuid: "5ffbb078-b21b-545a-b01e-d3aaa3b3b4c5", itemGuid: "92627677-4f5b-4420-85cd-e76b5f9aa7fb" },
  { feedGuid: "3319d99e-23cc-5334-8b5c-594282bb2a0d", itemGuid: "f77411cd-dcf3-54e0-9d09-49051db7b655" },
  { feedGuid: "c20ed66b-eaab-5f16-b4d5-2ceb16338734", itemGuid: "a9cb5ece-f139-43c3-8b48-eb0aa8d7a0da" },
  { feedGuid: "c1068f73-172c-5ece-916f-dbf9791c3c76", itemGuid: "6f3daa09-11a2-59ee-b37f-de7346fcbb29" },
  { feedGuid: "db4f967f-4c56-5602-9442-daf318deb3b3", itemGuid: "3cbe6a17-0bae-5b07-8f4c-ed12fbeba205" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "bc80fa46-9563-48f0-b6df-5f9c847c7642" },
  { feedGuid: "5151c1e4-5dee-5a33-b4e3-59d4bb373d07", itemGuid: "176d6d64-1c9c-5e74-8799-e09fbeab90c7" },
  { feedGuid: "0ad0ac08-c029-5f84-9321-5d589090badf", itemGuid: "1d0c542e-54d3-56d0-8f77-192f24117abe" },
  { feedGuid: "2528b894-9203-5c0e-890b-9ae1e3edab52", itemGuid: "c7dbb242-676b-427e-96c1-c9bf72fdfccc" },
  { feedGuid: "8d0c0bd8-6daa-50fd-8d02-026f51801c3c", itemGuid: "a5085d38-e073-45bb-9687-b0ba0cc65493" },
  { feedGuid: "bba99401-378c-5540-bf95-c456b3d4de26", itemGuid: "804099cb-264f-42cc-8026-18f989c08f2b" },
  { feedGuid: "93f427fc-b634-5ba0-94df-3c646771d06e", itemGuid: "f702ba2f-dae1-5323-b315-3753dc53a092" },
  { feedGuid: "fa4d02f4-bf0c-523a-8219-e1b7cb75e4b3", itemGuid: "4c5616d9-5eb1-40ec-89d8-29865735c4ff" },
  { feedGuid: "129770f5-0cfb-563c-9f6e-87c63f92e84a", itemGuid: "b83eedb5-f5a4-43da-b2ad-143a0db84baf" },
  { feedGuid: "00d328f1-f6af-5499-83ea-2acb65fe7a2e", itemGuid: "1a16b884-5935-5346-81d8-20f6974b8738" },
  { feedGuid: "90f06077-971d-5aaf-b553-6e94e3f204b4", itemGuid: "e63c203b-7bf8-5d19-827e-3ca69db3fef3" },
  { feedGuid: "65af69db-7dcf-5c95-bf27-7526a6dbce35", itemGuid: "dc008ef7-4738-4423-85d1-a5e98b3fc420" },
  { feedGuid: "65af69db-7dcf-5c95-bf27-7526a6dbce35", itemGuid: "6e827f2f-69d8-4457-aad0-975007fe75b0" },
  { feedGuid: "9467df06-a6ba-5c05-996b-e1296f1a5371", itemGuid: "5f9975f2-39d3-4439-ba29-c4e32d873074" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "2658bf69-bd20-4b1c-8fa9-89c827cb5569" }
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

addBatch(batch5, 'Batch 5');
