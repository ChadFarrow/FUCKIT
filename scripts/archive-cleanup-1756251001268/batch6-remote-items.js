const fs = require('fs');
const path = require('path');

const batch6 = [
  { feedGuid: "cf2fe766-9923-5101-b57e-5f5b754c0de5", itemGuid: "86bd7fef-3bd4-4e7a-84a8-8eeb2b56224a" },
  { feedGuid: "0ee7cd8e-277e-532e-a772-7e70e15e1eaf", itemGuid: "eb58c266-139d-43bb-8219-ab4283b0977e" },
  { feedGuid: "78a0f2e4-c466-5efb-aef6-b5f21c83d4b9", itemGuid: "aaa20f26-7fef-5e2e-9ce3-7542667b2d22" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "edfbeb88-894f-4c4e-8d08-af42ba9f54bd" },
  { feedGuid: "e6be595d-73c5-53e5-8a46-e34aa704312a", itemGuid: "93c0ef53-acac-4c5a-8dc3-3cad85432dd3" },
  { feedGuid: "2c5f77fe-25d9-5a2d-97ef-236718c627df", itemGuid: "469fb1ea-6b9e-4df4-96d3-0b61e9b1b5ca" },
  { feedGuid: "2c5f77fe-25d9-5a2d-97ef-236718c627df", itemGuid: "c5071214-ba27-4327-ae0b-4769fc9cac06" },
  { feedGuid: "4eb3cb59-296b-572d-bf27-8f56cce69fb0", itemGuid: "598f2d62-1d8f-4937-8dcb-a3803443279b" },
  { feedGuid: "7b7949ca-5019-5814-aa53-d4b14bd15a6d", itemGuid: "655333c2-be52-46e4-a1d5-c0f76dc9ab43" },
  { feedGuid: "989414c1-8e40-5904-8313-672e84b39111", itemGuid: "b6dff415-a775-4da3-9c75-81b1ca48ab8a" },
  { feedGuid: "54b3451e-d332-5eaa-bd21-ec051f66b1ab", itemGuid: "895d2523-06c6-4760-84fc-911f2ad49dfb" },
  { feedGuid: "428bb912-0f0d-5a2e-b3bb-b01afc3773f8", itemGuid: "86422995-6d94-4f4f-a9a3-bd0ad3ea4feb" },
  { feedGuid: "25db9866-7c91-57f9-a2da-b9295bd1383a", itemGuid: "ab58d2d8-af49-43a0-a31c-57de222965ec" },
  { feedGuid: "7196a738-2282-568a-a9be-be23f8bdb293", itemGuid: "4a0d52a9-f93b-4cd4-b024-d844a7388a23" },
  { feedGuid: "82235f8b-da8c-52a5-ba6b-1f11c199f526", itemGuid: "472d0a17-1f24-440e-ba85-f47a616417c6" },
  { feedGuid: "ed8d5071-7905-5b4e-b67f-463d29e4542d", itemGuid: "d5b76343-c42a-533c-bb42-a88c18a8845b" },
  { feedGuid: "4e7b52fa-fbe7-5112-9177-ce4b6cf22826", itemGuid: "9b22036f-01b7-41f9-8e54-c1c59a177fae" },
  { feedGuid: "68beab02-1caf-5eae-b471-78c230b0fe90", itemGuid: "12f41daa-c8da-5ac7-af4f-86bfbcb2546c" },
  { feedGuid: "dcf9784b-14fe-54b7-9186-10f7275e0022", itemGuid: "9e083dc5-baa4-4257-8a34-773d0130030d" },
  { feedGuid: "07121659-17cc-5e3e-b754-b9a1de54b325", itemGuid: "bcc54aec-2cf5-5a43-bb1f-904e11a4a89c" }
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

addBatch(batch6, 'Batch 6');
