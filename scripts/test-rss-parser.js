#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function testRSSParser() {
  console.log('🚀 Testing RSS Feed Parser with Podcast Index API\n');
  
  try {
    const parser = createRSSParser();
    
    const testFeedGuid = process.argv[2] || '917393e3-1b1e-5cef-ace4-edaa54e1f810';
    
    console.log(`📡 Looking up feed by GUID: ${testFeedGuid}`);
    console.log('─'.repeat(50));
    
    const feedInfo = await parser.lookupByFeedGuid(testFeedGuid);
    console.log('\n✅ Feed Info from API:');
    console.log(`  Title: ${feedInfo.title}`);
    console.log(`  URL: ${feedInfo.url}`);
    console.log(`  ID: ${feedInfo.id}`);
    console.log(`  Last Update: ${new Date(feedInfo.lastUpdateTime * 1000).toISOString()}`);
    console.log(`  Episode Count: ${feedInfo.episodeCount}`);
    
    if (feedInfo.value) {
      console.log(`  💰 Has Value4Value: Yes`);
    }
    
    console.log('\n📥 Fetching and parsing RSS feed...');
    const rssFeed = await parser.fetchAndParseFeed(feedInfo.url);
    console.log(`\n✅ RSS Feed Parsed:`);
    console.log(`  Title: ${rssFeed.metadata.title}`);
    console.log(`  Description: ${rssFeed.metadata.description?.substring(0, 100)}...`);
    console.log(`  Episodes found: ${rssFeed.items.length}`);
    
    if (rssFeed.items.length > 0) {
      console.log(`\n  Latest Episode:`);
      console.log(`    Title: ${rssFeed.items[0].title}`);
      console.log(`    Date: ${rssFeed.items[0].pubDate}`);
      if (rssFeed.items[0].enclosure) {
        console.log(`    Audio URL: ${rssFeed.items[0].enclosure.url}`);
      }
    }
    
    console.log('\n🔍 Getting complete podcast data...');
    const completeData = await parser.getCompletePocastData(testFeedGuid);
    console.log(`✅ Complete data retrieved with ${completeData.rssFeed.items.length} episodes`);
    
    console.log('\n💸 Checking Value4Value info...');
    const valueInfo = await parser.getValueInfo(testFeedGuid);
    if (valueInfo.hasValue) {
      console.log('  ✅ This podcast supports Value4Value!');
      if (valueInfo.valueData) {
        console.log(`  Value Data:`, valueInfo.valueData);
      }
    } else {
      console.log('  ℹ️ No Value4Value configuration found');
    }
    
    if (valueInfo.fundingData) {
      console.log('  💰 Funding info found:', valueInfo.fundingData);
    }
    
    console.log('\n🔎 Testing search functionality...');
    const searchResults = await parser.searchPodcasts('bitcoin', { max: 3 });
    console.log(`  Found ${searchResults.length} results for "bitcoin"`);
    searchResults.forEach((result, index) => {
      console.log(`    ${index + 1}. ${result.title} (GUID: ${result.podcastGuid})`);
    });
    
    console.log('\n✨ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRSSParser().catch(console.error);