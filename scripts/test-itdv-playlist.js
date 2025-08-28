#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function testITDVPlaylist() {
  const feedUrl = "https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/ITDV-music-playlist.xml";
  
  console.log('\n🎵 TESTING ITDV MUSIC PLAYLIST (122 REMOTE ITEMS)\n');
  console.log('═'.repeat(70));
  console.log(`Feed URL: ${feedUrl}`);
  
  try {
    const parser = createRSSParser();
    const startTime = Date.now();
    
    console.log('\n📡 Fetching and parsing RSS feed...\n');
    
    const rssFeed = await parser.fetchAndParseFeed(feedUrl);
    
    console.log('✅ RSS Feed Successfully Parsed!');
    console.log(`   Title: ${rssFeed.metadata.title}`);
    console.log(`   Description: ${rssFeed.metadata.description}`);
    console.log(`   Author: ${rssFeed.metadata.itunes?.author || 'N/A'}`);
    console.log(`   Medium: ${rssFeed.metadata.medium || 'N/A'}`);
    console.log(`   Feed GUID: ${rssFeed.metadata.podcastGuid || 'N/A'}`);
    console.log(`   Episodes: ${rssFeed.items.length}`);
    
    // Check for remote items in feed level
    console.log('\n🔍 Analyzing remote items...');
    
    let feedLevelRemoteItems = 0;
    let itemLevelRemoteItems = 0;
    
    if (rssFeed.metadata.remoteItem) {
      const feedRemotes = Array.isArray(rssFeed.metadata.remoteItem) ? 
        rssFeed.metadata.remoteItem : [rssFeed.metadata.remoteItem];
      feedLevelRemoteItems = feedRemotes.length;
      console.log(`   📻 Feed-level remote items: ${feedLevelRemoteItems}`);
    }
    
    rssFeed.items.forEach(item => {
      if (item.remoteItem) {
        const itemRemotes = Array.isArray(item.remoteItem) ? 
          item.remoteItem : [item.remoteItem];
        itemLevelRemoteItems += itemRemotes.length;
      }
    });
    
    console.log(`   🎵 Item-level remote items: ${itemLevelRemoteItems}`);
    console.log(`   📊 Total remote items detected: ${feedLevelRemoteItems + itemLevelRemoteItems}`);
    
    // Use the parser's built-in remote item getter
    console.log('\n🔄 Using built-in remote item parser...');
    const allRemoteItems = await parser.getRemoteItems(feedUrl);
    console.log(`   ✅ Parser found: ${allRemoteItems.length} remote items`);
    
    // Show first few items as examples
    console.log('\n📋 First 5 Remote Items:');
    allRemoteItems.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. feedGuid: ${item.feedGuid}`);
      console.log(`      itemGuid: ${item.itemGuid}`);
      console.log(`      location: ${item.location}`);
    });
    
    // Test resolution in smaller batches due to the large number
    console.log('\n⚡ Testing resolution of remote items (sample of 10)...');
    
    const sampleItems = allRemoteItems.slice(0, 10);
    const batchSize = 3; // Smaller batches to be respectful to API
    
    const resolved = [];
    const failed = [];
    
    for (let i = 0; i < sampleItems.length; i += batchSize) {
      const batch = sampleItems.slice(i, i + batchSize);
      console.log(`\n  Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sampleItems.length/batchSize)} (${batch.length} items)...`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const result = await parser.resolveRemoteItem(item);
            return { success: true, result, original: item };
          } catch (error) {
            return { success: false, error: error.message, original: item };
          }
        })
      );
      
      batchResults.forEach(result => {
        const value = result.value || result.reason;
        if (value.success) {
          resolved.push(value);
          console.log(`    ✅ ${value.result.item.title}`);
        } else {
          failed.push(value);
          console.log(`    ❌ ${value.original.feedGuid.substring(0, 8)}...: ${value.error}`);
        }
      });
      
      // Brief pause between batches
      if (i + batchSize < sampleItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n═'.repeat(70));
    console.log('📊 RESULTS SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total Remote Items in Feed: ${allRemoteItems.length}`);
    console.log(`Sample Tested: ${sampleItems.length}`);
    console.log(`Successfully Resolved: ${resolved.length}`);
    console.log(`Failed to Resolve: ${failed.length}`);
    console.log(`Success Rate: ${((resolved.length / sampleItems.length) * 100).toFixed(1)}%`);
    console.log(`Processing Time: ${duration.toFixed(1)}s`);
    
    if (resolved.length > 0) {
      console.log('\n🎵 SAMPLE RESOLVED TRACKS:');
      resolved.forEach((item, index) => {
        const track = item.result.item;
        const feed = item.result.feed;
        console.log(`${index + 1}. "${track.title}" by ${feed.itunes?.author || 'Unknown Artist'}`);
        console.log(`   Duration: ${track.itunes?.duration || 'Unknown'}`);
        if (track.value) {
          console.log(`   ⚡ Value4Value enabled`);
        }
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ FAILED TO RESOLVE:');
      failed.forEach((item, index) => {
        console.log(`${index + 1}. feedGuid: ${item.original.feedGuid.substring(0, 16)}...`);
        console.log(`   Error: ${item.error}`);
      });
    }
    
    console.log('\n💡 PLAYLIST ANALYSIS:');
    console.log(`This appears to be the complete ITDV music playlist with ${allRemoteItems.length} tracks.`);
    console.log(`The RSS parser can successfully handle feeds with this many remote items.`);
    console.log(`For full resolution, consider processing in smaller batches to avoid API rate limits.`);
    
    // Analyze unique feeds referenced
    const uniqueFeeds = [...new Set(allRemoteItems.map(item => item.feedGuid))];
    console.log(`\n📊 FEED DIVERSITY:`);
    console.log(`Unique feeds referenced: ${uniqueFeeds.length}`);
    console.log(`Average tracks per feed: ${(allRemoteItems.length / uniqueFeeds.length).toFixed(1)}`);
    
    console.log('\n✨ ITDV playlist parsing test complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testITDVPlaylist().catch(console.error);