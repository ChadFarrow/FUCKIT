const fs = require('fs');
const path = require('path');

// New remote item GUIDs to add
const newRemoteItems = [
  { feedGuid: "1f2260ba-adcc-58c9-80c8-76b8eb92085e", itemGuid: "4bcdb21b-57dd-48b4-bfbc-ee9f8111e46f" },
  { feedGuid: "ef94e9ff-78b3-56a1-ad33-f838735f1e57", itemGuid: "a45e74f6-4a61-4175-9f5b-829249b152e5" },
  { feedGuid: "bd513295-bc3f-58d7-bfac-33fec5d1957f", itemGuid: "2350a008-9da3-4182-b13f-0d7c1603e8bd" },
  { feedGuid: "9becc0e2-aa67-5924-b9d4-61b943c265c2", itemGuid: "64b7ea46-ff25-4127-8dcf-aca01a5b4ff5" },
  { feedGuid: "2cbfc960-18a5-5216-af54-312ba45a3f7b", itemGuid: "1e75b446-05c6-4262-a194-de184cb264ed" },
  { feedGuid: "03885572-bccc-50bc-ab4c-f8fbf7c76b91", itemGuid: "1cdcc151-6487-42bf-8b93-9cb16d4997e7" },
  { feedGuid: "116a848a-ba3e-5686-b1fb-66dff808a168", itemGuid: "f4fcab56-d7c5-4c3f-a247-f5e72cde5ca7" },
  { feedGuid: "84c4d46d-4155-5f9f-a6b6-2a01c3440dcf", itemGuid: "3ef2da90-57be-4614-aa7d-24ceeb19a5e4" },
  { feedGuid: "dbc3bd82-1d26-5e48-898a-0a2c82bf496a", itemGuid: "361b9a91-0ee6-49c7-87d0-242b637e1bce" },
  { feedGuid: "49d69844-fd16-5f1d-b24f-5ff558a46990", itemGuid: "5033e103-f048-4226-9971-87fb1662bcc7" },
  { feedGuid: "a9618a99-8ec0-5210-a8ad-2d2240049ea9", itemGuid: "2a62be0c-920f-4e0d-b6ad-c28b826ee326" },
  { feedGuid: "86618e8a-238e-5864-af05-49676b35b38c", itemGuid: "d01c45d0-d15b-4650-a7dd-97dcc8b960db" },
  { feedGuid: "9bc5a8b4-e8b7-5d4f-8df1-4e121a68ede7", itemGuid: "2659bfa0-a0c4-47b6-a43b-54d775c860fe" },
  { feedGuid: "6065ec4d-ff03-5ce6-9cae-2e9fa0d49268", itemGuid: "69995522-db9a-48dc-a38a-5fa8afdf77a2" },
  { feedGuid: "bb97ae75-2178-5ca5-8dbe-48424bb1fd5e", itemGuid: "9b99d4a2-68f1-49e7-af2c-3c02a5c3f8e8" },
  { feedGuid: "6697c2bd-77f4-5429-8c40-9107e109287c", itemGuid: "f2bc2a3d-de88-45cb-95d9-80b4365cf73d" },
  { feedGuid: "db80cd15-a336-56d9-ba27-d15394ce20f2", itemGuid: "41a86e5c-dbde-48aa-b9fe-361ff4da72c8" },
  { feedGuid: "eb4d1c50-f15f-5197-8891-694134ea467c", itemGuid: "3db1a4eb-8c3b-4bd6-bf05-b21dd7619a71" },
  { feedGuid: "2822c0a4-2c3d-5111-a59d-437982d41e4f", itemGuid: "c3b5ed89-bddb-49fe-9255-4f93091673ba" },
  { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
  { feedGuid: "976da06b-ab0d-54d2-b663-71420663f55e", itemGuid: "a28716fc-31a7-4f0e-8614-d9076ef8ed05" },
  { feedGuid: "d6fe0d1c-bd8d-552b-ac66-cce620391810", itemGuid: "cf8a54a4-5cc2-4263-9ee2-a8d99697578a" },
  { feedGuid: "2b6d971f-562e-510e-ad40-272cb3962c8b", itemGuid: "da04652e-8d3e-4720-9434-0455b930ea52" },
  { feedGuid: "d126bfe6-c1a8-55ca-8ca1-85332e67ade5", itemGuid: "e405efcf-698d-4356-8ab0-34e1d1385cc1" },
  { feedGuid: "ab7db89d-9602-5b8d-bba8-42855b20c13c", itemGuid: "9f3ecec7-bbe4-4053-a7b7-6fca98909ff9" },
  { feedGuid: "3058af0c-1807-5732-9a08-9114675ef7d6", itemGuid: "c51ecaa4-f237-4707-9c62-2de611820e4b" },
  { feedGuid: "df81ff07-65d4-5b75-af91-78b032aa9627", itemGuid: "a34d1e60-bee7-4caf-a6f1-98c1e878a2a1" },
  { feedGuid: "8c5dd9fd-4257-5e7b-9e94-643e6aa4ca1c", itemGuid: "f0d690d6-85f8-48bc-8038-5d564b5616e2" },
  { feedGuid: "75f0b434-19dc-5959-9920-0fb5304be61b", itemGuid: "640abac0-697e-4702-8871-48438c3e3138" },
  { feedGuid: "747af2a0-6adb-524d-a0ee-eb06ef92aca2", itemGuid: "3badc39a-2151-4d24-a624-b9b9c2c8ff7d" }
];

async function addNewRemoteItems() {
  try {
    console.log('🔍 Checking for new remote items to add...\n');
    
    // Read existing database
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📊 Current database size: ${musicTracks.length} tracks`);
    
    const missingItems = [];
    const existingItems = [];
    
    // Check which items are missing
    for (const item of newRemoteItems) {
      const exists = musicTracks.find(track => 
        track.itemGuid && track.itemGuid._ === item.itemGuid
      );
      
      if (exists) {
        existingItems.push(item);
        console.log(`✅ Found existing: ${item.itemGuid}`);
      } else {
        missingItems.push(item);
        console.log(`❌ Missing: ${item.itemGuid}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Existing: ${existingItems.length}`);
    console.log(`  Missing: ${missingItems.length}`);
    
    if (missingItems.length === 0) {
      console.log('\n🎉 All items already exist in database!');
      return;
    }
    
    // Add missing items
    console.log('\n➕ Adding missing items...');
    for (const item of missingItems) {
      const newTrack = {
        feedGuid: item.feedGuid,
        itemGuid: { _: item.itemGuid },
        title: `Track ${item.itemGuid.substring(0, 8)}`,
        artist: 'Unknown Artist',
        source: 'podcast:remoteItem (new)',
        addedDate: new Date().toISOString()
      };
      
      musicTracks.push(newTrack);
      console.log(`  ✅ Added: ${item.itemGuid}`);
    }
    
    // Save updated database
    console.log('\n💾 Saving updated database...');
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-new-items-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    console.log(`\n🎯 Final Status:`);
    console.log(`  Database size: ${musicTracks.length} tracks`);
    console.log(`  Added: ${missingItems.length} new tracks`);
    console.log(`  Backup created: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error adding new remote items:', error.message);
  }
}

addNewRemoteItems();
