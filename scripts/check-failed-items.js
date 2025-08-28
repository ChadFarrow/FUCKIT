#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function checkFailedItems() {
  const failedFeedGuid = "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8";
  
  const failedItems = [
    { position: 10, feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "7c823adf-1e53-4df1-98c0-979da81ec916" },
    { position: 16, feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
    { position: 18, feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" }
  ];

  console.log('\n❌ FAILED REMOTE ITEMS ANALYSIS\n');
  console.log('═'.repeat(60));
  
  console.log(`\nFailed Feed GUID: ${failedFeedGuid}`);
  console.log('\nFailed Items:');
  failedItems.forEach(item => {
    console.log(`  ${item.position}. itemGuid: ${item.itemGuid}`);
  });

  try {
    const parser = createRSSParser();
    
    console.log('\n🔍 Investigating the feed...\n');
    
    // Try to look up the feed directly
    try {
      const feedInfo = await parser.lookupByFeedGuid(failedFeedGuid);
      console.log('✅ Feed found in Podcast Index API:');
      console.log(`   Title: ${feedInfo.title}`);
      console.log(`   URL: ${feedInfo.url || 'NO URL PROVIDED'}`);
      console.log(`   ID: ${feedInfo.id}`);
      console.log(`   Status: ${feedInfo.dead ? 'DEAD' : 'ALIVE'}`);
      console.log(`   Episode Count: ${feedInfo.episodeCount}`);
      
      if (!feedInfo.url) {
        console.log('\n❌ PROBLEM IDENTIFIED: Feed has no URL in API response');
        console.log('   This is why parsing failed - no RSS feed URL to fetch');
      } else {
        console.log('\n🔄 Attempting to fetch RSS feed...');
        try {
          const rssFeed = await parser.fetchAndParseFeed(feedInfo.url);
          console.log(`✅ RSS feed successfully parsed: ${rssFeed.items.length} items`);
          
          // Check if the specific items exist
          failedItems.forEach(failedItem => {
            const found = rssFeed.items.find(item => item.guid === failedItem.itemGuid);
            if (found) {
              console.log(`   ✅ Item ${failedItem.position}: "${found.title}" - FOUND`);
            } else {
              console.log(`   ❌ Item ${failedItem.position}: ${failedItem.itemGuid} - NOT FOUND`);
            }
          });
          
        } catch (rssError) {
          console.log(`❌ Failed to fetch RSS feed: ${rssError.message}`);
        }
      }
      
    } catch (apiError) {
      console.log(`❌ Feed not found in API: ${apiError.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error during investigation:', error.message);
  }
  
  console.log('\n═'.repeat(60));
  console.log('🔍 INVESTIGATION COMPLETE');
}

checkFailedItems().catch(console.error);