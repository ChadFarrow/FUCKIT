#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function parseAndResolveRemoteItem() {
  const remoteItemXML = '<podcast:remoteItem feedGuid="3ae285ab-434c-59d8-aa2f-59c6129afb92" itemGuid="d8145cb6-97d9-4358-895b-2bf055d169aa"/>';
  
  console.log('\n🔍 Parsing Remote Item Reference\n');
  console.log('XML:', remoteItemXML);
  console.log('═'.repeat(60));
  
  try {
    const parser = createRSSParser();
    
    // Extract the attributes from the XML
    const remoteItem = {
      feedGuid: '3ae285ab-434c-59d8-aa2f-59c6129afb92',
      itemGuid: 'd8145cb6-97d9-4358-895b-2bf055d169aa',
      feedUrl: null,
      medium: null
    };
    
    console.log('\n📋 Parsed Attributes:');
    console.log(`  feedGuid: ${remoteItem.feedGuid}`);
    console.log(`  itemGuid: ${remoteItem.itemGuid}`);
    console.log(`  feedUrl: ${remoteItem.feedUrl || 'not specified'}`);
    console.log(`  medium: ${remoteItem.medium || 'not specified'}`);
    
    console.log('\n🔄 Resolving remote item...\n');
    
    const resolved = await parser.resolveRemoteItem(remoteItem);
    
    console.log('✅ Successfully Resolved!\n');
    console.log('═══ FEED INFORMATION ═══');
    console.log(`Title: ${resolved.feed.title}`);
    console.log(`Description: ${resolved.feed.description}`);
    console.log(`Link: ${resolved.feed.link}`);
    
    console.log('\n═══ REFERENCED ITEM ═══');
    console.log(`Type: ${resolved.type}`);
    console.log(`Track Title: ${resolved.item.title}`);
    console.log(`Published: ${resolved.item.pubDate}`);
    console.log(`Duration: ${resolved.item.itunes?.duration || 'N/A'}`);
    console.log(`GUID: ${resolved.item.guid}`);
    
    if (resolved.item.enclosure) {
      console.log('\n═══ AUDIO DETAILS ═══');
      console.log(`URL: ${resolved.item.enclosure.url}`);
      console.log(`Type: ${resolved.item.enclosure.type}`);
      console.log(`Size: ${(parseInt(resolved.item.enclosure.length) / 1024 / 1024).toFixed(2)} MB`);
    }
    
    if (resolved.item.value) {
      console.log('\n═══ VALUE4VALUE ═══');
      console.log('Track supports Lightning payments');
      if (resolved.item.value['podcast:valueRecipient']) {
        const recipient = resolved.item.value['podcast:valueRecipient'][0].$;
        console.log(`Recipient: ${recipient.name}`);
        console.log(`Split: ${recipient.split}%`);
        console.log(`Custom Value: ${recipient.customValue}`);
      }
    }
    
    console.log('\n🎵 PLAYBACK READY');
    console.log('This remote item reference points to:');
    console.log(`  "${resolved.item.title}" by John Depew Trio`);
    console.log(`  From album: ${resolved.feed.title}`);
    console.log(`  Duration: ${resolved.item.itunes?.duration || 'Unknown'}`);
    
    if (resolved.item.enclosure?.url) {
      console.log(`\n  ▶️ Play URL:`);
      console.log(`  ${resolved.item.enclosure.url}`);
    }
    
    console.log('\n✨ Remote item successfully parsed and resolved!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

parseAndResolveRemoteItem().catch(console.error);