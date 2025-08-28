#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function testRemoteItems() {
  console.log('\n🔗 Testing podcast:remoteItem functionality\n');
  console.log('═'.repeat(60));
  
  try {
    const parser = createRSSParser();
    
    // First, let's check if our test feed has any remote items
    const testFeedGuid = process.argv[2] || '3ae285ab-434c-59d8-aa2f-59c6129afb92';
    
    console.log(`\n📡 Checking feed for remote items: ${testFeedGuid}`);
    
    const remoteItems = await parser.getRemoteItems(testFeedGuid);
    
    if (remoteItems.length === 0) {
      console.log('   ℹ️ No remote items found in this feed\n');
      
      // Let's demonstrate how remote items would work
      console.log('📚 How podcast:remoteItem works:\n');
      console.log('Remote items allow feeds to reference content from other feeds.');
      console.log('Common use cases:');
      console.log('  • Playlists - Create curated lists from multiple podcasts');
      console.log('  • Trailers - Reference preview episodes from other shows');
      console.log('  • Cross-promotion - Link to specific episodes in other feeds');
      console.log('  • Music compilations - Build playlists from multiple artists\n');
      
      console.log('Example remote item structure:');
      console.log('  <podcast:remoteItem');
      console.log('    feedGuid="917393e3-1b1e-5cef-ace4-edaa54e1f810"');
      console.log('    itemGuid="episode-123"');
      console.log('    medium="music" />');
      
      // Demonstrate with a manual example
      console.log('\n🔍 Demo: Creating a manual remote item reference...\n');
      
      const exampleRemoteItem = {
        feedGuid: '917393e3-1b1e-5cef-ace4-edaa54e1f810',
        itemGuid: null,  // Get whole feed
        medium: 'podcast'
      };
      
      console.log('Resolving remote feed reference...');
      try {
        const resolved = await parser.resolveRemoteItem(exampleRemoteItem);
        console.log(`✅ Resolved to: ${resolved.feed.title}`);
        console.log(`   Type: ${resolved.type}`);
        console.log(`   Episodes available: ${resolved.items?.length || 0}`);
      } catch (err) {
        console.log(`   ⚠️ Could not resolve example: ${err.message}`);
      }
      
    } else {
      console.log(`\n✅ Found ${remoteItems.length} remote item(s)!\n`);
      
      remoteItems.forEach((item, index) => {
        console.log(`Remote Item ${index + 1}:`);
        console.log(`  Location: ${item.location} level`);
        if (item.location === 'item') {
          console.log(`  From episode: ${item.itemTitle}`);
        }
        console.log(`  Feed GUID: ${item.feedGuid || 'N/A'}`);
        console.log(`  Feed URL: ${item.feedUrl || 'N/A'}`);
        console.log(`  Item GUID: ${item.itemGuid || 'N/A'}`);
        console.log(`  Medium: ${item.medium || 'N/A'}`);
        console.log('');
      });
      
      console.log('🔄 Resolving all remote items...\n');
      const resolved = await parser.resolveAllRemoteItems(testFeedGuid);
      
      resolved.forEach((result, index) => {
        if (result.error) {
          console.log(`❌ Remote Item ${index + 1}: Failed to resolve`);
          console.log(`   Error: ${result.error}`);
        } else {
          console.log(`✅ Remote Item ${index + 1}: Successfully resolved`);
          console.log(`   Type: ${result.type}`);
          console.log(`   Feed: ${result.feed.title}`);
          if (result.type === 'item' && result.item) {
            console.log(`   Item: ${result.item.title}`);
            console.log(`   Duration: ${result.item.itunes?.duration || 'N/A'}`);
          } else if (result.type === 'feed') {
            console.log(`   Items in feed: ${result.items.length}`);
          }
        }
        console.log('');
      });
    }
    
    // Test creating a playlist using remote items
    console.log('\n🎵 Example: Building a cross-feed playlist\n');
    console.log('You could create a playlist by referencing specific tracks:');
    
    const playlistExample = [
      {
        feedGuid: '3ae285ab-434c-59d8-aa2f-59c6129afb92',
        itemGuid: 'd8145cb6-97d9-4358-895b-2bf055d169aa',
        title: 'Neon Hawk - John Depew Trio'
      },
      {
        feedGuid: '3ae285ab-434c-59d8-aa2f-59c6129afb92', 
        itemGuid: 'cdb82073-1c37-4bd8-ae25-cac04854ef73',
        title: 'Bell of Hope - John Depew Trio'
      }
    ];
    
    playlistExample.forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.title}`);
      console.log(`     feedGuid="${track.feedGuid}"`);
      console.log(`     itemGuid="${track.itemGuid}"`);
    });
    
    console.log('\n✨ Remote item testing complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRemoteItems().catch(console.error);