#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function checkWavlakeFeed() {
  const wavlakeUrl = "https://wavlake.com/feed/music/87c4f77c-f400-4548-bb7d-78f1ec8a7fa9";
  const failedFeedGuid = "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8";
  
  console.log('\n🔍 CHECKING WAVLAKE FEED\n');
  console.log('═'.repeat(60));
  console.log(`Feed URL: ${wavlakeUrl}`);
  
  try {
    const parser = createRSSParser();
    
    console.log('\n📡 Fetching and parsing the Wavlake RSS feed...\n');
    
    const rssFeed = await parser.fetchAndParseFeed(wavlakeUrl);
    
    console.log('✅ Successfully parsed RSS feed!');
    console.log(`   Title: ${rssFeed.metadata.title}`);
    console.log(`   Artist: ${rssFeed.metadata.itunes?.author}`);
    console.log(`   Description: ${rssFeed.metadata.description}`);
    console.log(`   Podcast GUID: ${rssFeed.metadata.podcastGuid}`);
    console.log(`   Link: ${rssFeed.metadata.link}`);
    console.log(`   Items: ${rssFeed.items.length}`);
    
    // Check if this matches our failed feed GUID
    const feedGuid = rssFeed.metadata.podcastGuid;
    console.log(`\n🔍 Comparing GUIDs:`);
    console.log(`   This feed GUID: ${feedGuid}`);
    console.log(`   Failed feed GUID: ${failedFeedGuid}`);
    console.log(`   Match: ${feedGuid === failedFeedGuid ? '✅ YES' : '❌ NO'}`);
    
    if (feedGuid !== failedFeedGuid) {
      // This is a different feed, let's see what it actually is
      console.log(`\n📋 This is actually a different feed:`);
      console.log(`   Artist: The Greensands`);
      console.log(`   Album: Going Gold Single`);
      
      // Check if this feed GUID appeared in our original list
      const originalRemoteItems = [
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
      
      const matchingItems = originalRemoteItems.filter(item => item.feedGuid === feedGuid);
      if (matchingItems.length > 0) {
        console.log(`\n✅ This feed WAS in our original list!`);
        console.log(`   Found ${matchingItems.length} reference(s) to this feed:`);
        matchingItems.forEach((item, i) => {
          console.log(`   ${i + 1}. itemGuid: ${item.itemGuid}`);
        });
        
        // Check if the referenced items exist in this feed
        console.log(`\n🔍 Checking if referenced items exist in feed:`);
        matchingItems.forEach((refItem, i) => {
          const found = rssFeed.items.find(item => item.guid === refItem.itemGuid);
          if (found) {
            console.log(`   ✅ Item ${i + 1}: "${found.title}" - FOUND`);
          } else {
            console.log(`   ❌ Item ${i + 1}: ${refItem.itemGuid} - NOT FOUND`);
          }
        });
        
      } else {
        console.log(`\n❌ This feed was NOT in our original remote items list`);
      }
    }
    
    console.log(`\n🎵 Feed Contents:`);
    rssFeed.items.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title} (${item.guid})`);
      if (item.itunes?.duration) {
        console.log(`      Duration: ${item.itunes.duration}`);
      }
    });
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  console.log('\n═'.repeat(60));
  console.log('✅ Feed analysis complete');
}

checkWavlakeFeed().catch(console.error);