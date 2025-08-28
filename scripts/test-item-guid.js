#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function testItemGuidLookup() {
  const feedGuid = process.argv[2] || '3ae285ab-434c-59d8-aa2f-59c6129afb92';
  const itemGuid = process.argv[3] || 'd8145cb6-97d9-4358-895b-2bf055d169aa';
  
  console.log(`\n🎵 Looking up specific track/episode`);
  console.log(`   Feed GUID: ${feedGuid}`);
  console.log(`   Item GUID: ${itemGuid}`);
  console.log('═'.repeat(60));
  
  try {
    const parser = createRSSParser();
    
    console.log('\n📡 Method 1: Getting item from RSS feed...');
    const itemData = await parser.getItemByGuid(feedGuid, itemGuid);
    
    console.log(`\n✅ Found in feed: ${itemData.feedInfo.title}`);
    console.log(`\n🎵 Track Details:`);
    console.log(`   Title: ${itemData.item.title}`);
    console.log(`   Published: ${itemData.item.pubDate}`);
    console.log(`   Duration: ${itemData.item.itunes?.duration || 'N/A'}`);
    console.log(`   GUID: ${itemData.item.guid}`);
    
    if (itemData.item.enclosure) {
      console.log(`\n📻 Audio Details:`);
      console.log(`   URL: ${itemData.item.enclosure.url}`);
      console.log(`   Type: ${itemData.item.enclosure.type}`);
      console.log(`   Size: ${(parseInt(itemData.item.enclosure.length) / 1024 / 1024).toFixed(2)} MB`);
    }
    
    if (itemData.item.content) {
      console.log(`\n📝 Description:`);
      console.log(`   ${itemData.item.content.substring(0, 200)}${itemData.item.content.length > 200 ? '...' : ''}`);
    }
    
    if (itemData.item.value) {
      console.log(`\n💰 Track Value4Value Info:`);
      console.log(JSON.stringify(itemData.item.value, null, 2));
    }
    
    if (itemData.valueInfo) {
      console.log(`\n💸 Feed-level Value4Value:`);
      console.log(`   Type: ${itemData.valueInfo.$.type}`);
      console.log(`   Method: ${itemData.valueInfo.$.method}`);
      if (itemData.valueInfo['podcast:valueRecipient']) {
        itemData.valueInfo['podcast:valueRecipient'].forEach((recipient, i) => {
          console.log(`   Recipient ${i + 1}: ${recipient.$.name || 'unnamed'}`);
          console.log(`     Split: ${recipient.$.split}%`);
          console.log(`     Address: ${recipient.$.address.substring(0, 30)}...`);
        });
      }
    }
    
    console.log('\n📡 Method 2: Getting episode from Podcast Index API...');
    try {
      const episodeData = await parser.getEpisodeByGuid(feedGuid, itemGuid);
      console.log(`\n✅ Found in API:`);
      console.log(`   ID: ${episodeData.id}`);
      console.log(`   Title: ${episodeData.title}`);
      console.log(`   Feed ID: ${episodeData.feedId}`);
      console.log(`   Duration: ${episodeData.duration} seconds`);
      console.log(`   Date Published: ${new Date(episodeData.datePublished * 1000).toISOString()}`);
      
      if (episodeData.value) {
        console.log(`   Has Value4Value: Yes`);
      }
    } catch (apiError) {
      console.log(`   ⚠️ Not found via API: ${apiError.message}`);
    }
    
    console.log('\n✨ Item lookup successful!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testItemGuidLookup().catch(console.error);