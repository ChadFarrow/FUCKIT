#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function debugITDVRemoteItems() {
  const feedUrl = "https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/ITDV-music-playlist.xml";
  
  console.log('\n🔍 DEBUGGING ITDV REMOTE ITEMS PARSING\n');
  console.log('═'.repeat(60));
  
  try {
    // First, let's fetch the raw XML and see what's in it
    console.log('📡 Fetching raw XML...\n');
    
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    
    console.log('✅ Raw XML fetched successfully');
    console.log(`   XML length: ${xmlText.length} characters`);
    
    // Count remote items manually
    const remoteItemMatches = xmlText.match(/<podcast:remoteItem[^>]*>/g);
    console.log(`   Manual count: ${remoteItemMatches ? remoteItemMatches.length : 0} podcast:remoteItem tags`);
    
    // Show first few remote items from raw XML
    if (remoteItemMatches) {
      console.log('\n📋 First 5 Remote Items (raw XML):');
      remoteItemMatches.slice(0, 5).forEach((match, index) => {
        console.log(`   ${index + 1}. ${match}`);
      });
    }
    
    // Now let's see what the RSS parser is extracting
    console.log('\n🔄 Testing RSS parser...');
    
    const parser = createRSSParser();
    const rssFeed = await parser.fetchAndParseFeed(feedUrl);
    
    console.log('\n📊 RSS Parser Results:');
    console.log(`   Title: ${rssFeed.metadata.title}`);
    console.log(`   RemoteItem field exists: ${rssFeed.metadata.remoteItem ? 'YES' : 'NO'}`);
    console.log(`   RemoteItem type: ${typeof rssFeed.metadata.remoteItem}`);
    
    if (rssFeed.metadata.remoteItem) {
      console.log(`   RemoteItem content:`, rssFeed.metadata.remoteItem);
    }
    
    // Check all metadata fields
    console.log('\n🔍 All metadata fields:');
    Object.keys(rssFeed.metadata).forEach(key => {
      console.log(`   ${key}: ${typeof rssFeed.metadata[key]} = ${JSON.stringify(rssFeed.metadata[key])?.substring(0, 100)}...`);
    });
    
    // Try to manually extract remote items from the XML
    console.log('\n🛠️  Manual extraction attempt...');
    
    const remoteItems = [];
    if (remoteItemMatches) {
      remoteItemMatches.forEach(match => {
        const feedGuidMatch = match.match(/feedGuid="([^"]+)"/);
        const itemGuidMatch = match.match(/itemGuid="([^"]+)"/);
        const feedUrlMatch = match.match(/feedUrl="([^"]+)"/);
        const mediumMatch = match.match(/medium="([^"]+)"/);
        
        if (feedGuidMatch && itemGuidMatch) {
          remoteItems.push({
            feedGuid: feedGuidMatch[1],
            itemGuid: itemGuidMatch[1],
            feedUrl: feedUrlMatch ? feedUrlMatch[1] : null,
            medium: mediumMatch ? mediumMatch[1] : null
          });
        }
      });
    }
    
    console.log(`   ✅ Manually extracted: ${remoteItems.length} remote items`);
    
    if (remoteItems.length > 0) {
      console.log('\n📋 First 5 Manually Extracted Items:');
      remoteItems.slice(0, 5).forEach((item, index) => {
        console.log(`   ${index + 1}. feedGuid: ${item.feedGuid}`);
        console.log(`      itemGuid: ${item.itemGuid}`);
        console.log(`      feedUrl: ${item.feedUrl || 'null'}`);
        console.log(`      medium: ${item.medium || 'null'}`);
        console.log('');
      });
      
      // Test resolving one manually extracted item
      console.log('🔄 Testing resolution of first manually extracted item...');
      
      try {
        const firstItem = remoteItems[0];
        const resolved = await parser.resolveRemoteItem(firstItem);
        
        console.log(`   ✅ Successfully resolved!`);
        console.log(`   Track: "${resolved.item.title}"`);
        console.log(`   Artist: ${resolved.feed.itunes?.author || 'Unknown'}`);
        console.log(`   Duration: ${resolved.item.itunes?.duration || 'Unknown'}`);
        if (resolved.item.value) {
          console.log(`   ⚡ Value4Value enabled`);
        }
      } catch (resolveError) {
        console.log(`   ❌ Resolution failed: ${resolveError.message}`);
      }
    }
    
    console.log('\n💡 DIAGNOSIS:');
    if (remoteItemMatches && remoteItemMatches.length > 0 && !rssFeed.metadata.remoteItem) {
      console.log('❌ The RSS parser is not extracting podcast:remoteItem tags');
      console.log('💡 The customFields configuration may need adjustment');
    } else if (rssFeed.metadata.remoteItem) {
      console.log('✅ RSS parser is extracting remote items correctly');
    } else {
      console.log('❓ No remote items found in the feed');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugITDVRemoteItems().catch(console.error);