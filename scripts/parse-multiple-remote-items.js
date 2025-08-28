#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function parseMultipleRemoteItems() {
  // Parse the remote items from the XML
  const remoteItems = [
    { feedGuid: "3ae285ab-434c-59d8-aa2f-59c6129afb92", itemGuid: "d8145cb6-97d9-4358-895b-2bf055d169aa" },
    { feedGuid: "6fc2ad98-d4a8-5d70-9c68-62e9efc1209c", itemGuid: "aad6e3b1-6589-4e22-b8ca-521f3d888263" },
    { feedGuid: "dea01a9d-a024-5b13-84aa-b157304cd3bc", itemGuid: "52007112-2772-42f9-957a-a93eaeedb222" },
    { feedGuid: "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4", itemGuid: "d79f242f-0651-4b12-be79-c2bac234cfde" },
    { feedGuid: "3058af0c-1807-5732-9a08-9114675ef7d6", itemGuid: "c51ecaa4-f237-4707-9c62-2de611820e4b" },
    { feedGuid: "011c3a82-d716-54f7-9738-3d5fcacf65be", itemGuid: "c2ba80cc-add9-42ad-9a8f-b490436826ae" },
    { feedGuid: "0ab5bc9d-c9fb-52f4-8b8c-64be5edf322f", itemGuid: "7bc23b30-5d37-4e03-8256-543b7bf17ba8" },
    { feedGuid: "187f22db-79cb-5ac4-aa60-54e424e3915e", itemGuid: "83b608cb-fbb8-4cc4-895e-bd1cf2b08ae3" },
    { feedGuid: "265706d5-d6a1-5e96-b4c8-5db454844254", itemGuid: "fe6b1845-6b98-425d-aa07-9531474939de" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "7c823adf-1e53-4df1-98c0-979da81ec916" },
    { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "f9683d28-70df-4112-95c4-490c0383c3c9" },
    { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "d60032f3-ce45-45c4-81fc-26ff0394a248" },
    { feedGuid: "6bf3785f-e053-57f4-9f70-261ee5e3747f", itemGuid: "a12d4410-03e0-44fd-bc8b-890760541a93" },
    { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "e046f9dd-aca3-4c7a-b396-2148a90ac0f2" },
    { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
    { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "24f655ae-8918-4089-8f2c-4c5ef612088b" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" },
    { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
    { feedGuid: "092e8cd8-6f44-5189-b574-9c0a5881b334", itemGuid: "35e81e15-6820-4f83-9a3d-4ef2cf0da14b" },
    { feedGuid: "e1e1fed5-4ca3-55b0-9370-182287ec24e5", itemGuid: "86a439b0-6b51-46a4-86f3-2490b7ca34ad" },
    { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "9ff8f18b-cc79-474c-a3e9-2948113b8bf5" },
    { feedGuid: "d6fe0d1c-bd8d-552b-ac66-cce620391810", itemGuid: "cf8a54a4-5cc2-4263-9ee2-a8d99697578a" },
    { feedGuid: "18843839-f79f-5b22-a842-241d0f6b12ea", itemGuid: "7bf430ff-6f92-4b44-bd3e-c4d0366e7508" },
    { feedGuid: "57203632-2003-55d2-b710-c699db963f18", itemGuid: "1f7e025c-e8f7-4e10-b12b-9715c9c460c7" }
  ];

  console.log(`\n🎵 Resolving ${remoteItems.length} Remote Items (Playlist)\n`);
  console.log('═'.repeat(80));
  
  try {
    const parser = createRSSParser();
    const startTime = Date.now();
    
    console.log('\n⚡ Resolving all remote items in parallel...');
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < remoteItems.length; i += batchSize) {
      batches.push(remoteItems.slice(i, i + batchSize));
    }
    
    const allResolved = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n  Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (item, index) => {
          try {
            const resolved = await parser.resolveRemoteItem(item);
            return { 
              success: true, 
              index: batchIndex * batchSize + index + 1,
              ...resolved 
            };
          } catch (error) {
            return { 
              success: false, 
              error: error.message, 
              index: batchIndex * batchSize + index + 1,
              feedGuid: item.feedGuid,
              itemGuid: item.itemGuid
            };
          }
        })
      );
      
      allResolved.push(...batchResults.map(result => result.value || result.reason));
      
      // Brief pause between batches to be respectful to the API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\n✅ Processing complete in ${duration.toFixed(1)}s\n`);
    console.log('═'.repeat(80));
    
    // Analyze results
    const successful = allResolved.filter(item => item.success);
    const failed = allResolved.filter(item => !item.success);
    
    console.log(`\n📊 RESULTS SUMMARY:`);
    console.log(`   ✅ Successfully resolved: ${successful.length}`);
    console.log(`   ❌ Failed to resolve: ${failed.length}`);
    console.log(`   📈 Success rate: ${((successful.length / allResolved.length) * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      console.log('\n🎵 PLAYLIST TRACKS:\n');
      
      let totalDuration = 0;
      const artists = new Set();
      
      successful.forEach((resolved) => {
        const duration = resolved.item.itunes?.duration || '00:00:00';
        const [hours, minutes, seconds] = duration.split(':').map(Number);
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        totalDuration += totalSeconds;
        
        if (resolved.feed.itunes?.author) {
          artists.add(resolved.feed.itunes.author);
        }
        
        console.log(`${String(resolved.index).padStart(2)}. ${resolved.item.title}`);
        console.log(`    🎤 ${resolved.feed.title}`);
        console.log(`    ⏱️  ${duration}`);
        if (resolved.item.value) {
          console.log(`    ⚡ Value4Value enabled`);
        }
        console.log('');
      });
      
      // Convert total duration back to HH:MM:SS
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      const seconds = totalDuration % 60;
      const totalDurationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      console.log('═'.repeat(50));
      console.log(`📈 PLAYLIST STATS:`);
      console.log(`   Total Duration: ${totalDurationStr}`);
      console.log(`   Unique Artists: ${artists.size}`);
      console.log(`   V4V Enabled: ${successful.filter(s => s.item.value).length} tracks`);
    }
    
    if (failed.length > 0) {
      console.log('\n❌ FAILED TO RESOLVE:\n');
      failed.forEach((item) => {
        console.log(`${String(item.index).padStart(2)}. Feed: ${item.feedGuid.substring(0, 8)}...`);
        console.log(`    Error: ${item.error}`);
        console.log('');
      });
    }
    
    console.log('\n✨ Remote items playlist processing complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

parseMultipleRemoteItems().catch(console.error);