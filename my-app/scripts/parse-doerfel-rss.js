#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';

const RSS_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';
const TARGET_FEED_GUID = '3ae285ab-434c-59d8-aa2f-59c6129afb92';
const TARGET_ITEM_GUID = 'd8145cb6-97d9-4358-895b-2bf055d169aa';

async function fetchAndParseRSS() {
  try {
    console.log('🔍 Fetching RSS feed from:', RSS_FEED_URL);
    
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    console.log('✅ RSS feed fetched successfully');
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error('XML parsing failed');
    }
    
    console.log('✅ XML parsed successfully');
    
    // Find all podcast:remoteItem elements
    const remoteItems = xmlDoc.getElementsByTagName('podcast:remoteItem');
    console.log(`📊 Found ${remoteItems.length} podcast:remoteItem elements`);
    
    // First, let's understand the structure better
    console.log(`\n📋 Analyzing ${remoteItems.length} podcast:remoteItem elements structure:\n`);
    
    // Check where remote items are located
    const remoteItemLocations = [];
    for (let i = 0; i < remoteItems.length; i++) {
      const item = remoteItems[i];
      const feedGuid = item.getAttribute('feedGuid');
      const itemGuid = item.getAttribute('itemGuid');
      const feedUrl = item.getAttribute('feedUrl');
      
      // Walk up the parent chain to understand structure
      let currentNode = item.parentNode;
      let path = ['podcast:remoteItem'];
      
      while (currentNode && currentNode.nodeType === 1) { // Element node
        path.unshift(currentNode.tagName);
        currentNode = currentNode.parentNode;
      }
      
      remoteItemLocations.push({
        feedGuid,
        itemGuid,
        feedUrl,
        path: path.join(' > '),
        parentTag: item.parentNode?.tagName || 'unknown'
      });
    }
    
    // Group by parent tag
    const parentGroups = new Map();
    remoteItemLocations.forEach(location => {
      if (!parentGroups.has(location.parentTag)) {
        parentGroups.set(location.parentTag, []);
      }
      parentGroups.get(location.parentTag).push(location);
    });
    
    console.log('📍 Remote item locations by parent element:');
    for (const [parentTag, items] of parentGroups) {
      console.log(`\n📂 Parent: <${parentTag}> (${items.length} items)`);
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. feedGuid: ${item.feedGuid}`);
        if (item.itemGuid) console.log(`     itemGuid: ${item.itemGuid}`);
        if (item.feedUrl) console.log(`     feedUrl: ${item.feedUrl}`);
      });
    }
    
    // Now try to find episodes and their remote items
    const episodes = xmlDoc.getElementsByTagName('item');
    console.log(`\n🎙️ Found ${episodes.length} episodes in the feed`);
    
    const episodeMap = new Map();
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const title = episode.getElementsByTagName('title')[0]?.textContent;
      const pubDate = episode.getElementsByTagName('pubDate')[0]?.textContent;
      const guid = episode.getElementsByTagName('guid')[0]?.textContent;
      
      // Find remote items within this episode
      const episodeRemoteItems = episode.getElementsByTagName('podcast:remoteItem');
      
      if (episodeRemoteItems.length > 0) {
        const episodeKey = `${title} (${pubDate})`;
        episodeMap.set(episodeKey, {
          title,
          pubDate,
          guid,
          remoteItems: []
        });
        
        for (let j = 0; j < episodeRemoteItems.length; j++) {
          const remoteItem = episodeRemoteItems[j];
          episodeMap.get(episodeKey).remoteItems.push({
            feedGuid: remoteItem.getAttribute('feedGuid'),
            itemGuid: remoteItem.getAttribute('itemGuid'),
            feedUrl: remoteItem.getAttribute('feedUrl')
          });
        }
      }
    }
    
    // Display episodes with their remote items
    let episodeNumber = 1;
    for (const [episodeKey, episode] of episodeMap) {
      console.log(`🎙️ Episode ${episodeNumber}: ${episode.title}`);
      console.log(`📅 Published: ${episode.pubDate}`);
      console.log(`🆔 GUID: ${episode.guid}`);
      console.log(`🔗 Remote Items (${episode.remoteItems.length}):`);
      
      episode.remoteItems.forEach((remoteItem, index) => {
        console.log(`  ${index + 1}. feedGuid: ${remoteItem.feedGuid}`);
        if (remoteItem.itemGuid) {
          console.log(`     itemGuid: ${remoteItem.itemGuid}`);
        }
        if (remoteItem.feedUrl) {
          console.log(`     feedUrl: ${remoteItem.feedUrl}`);
        }
      });
      
      console.log(''); // Empty line for readability
      episodeNumber++;
    }
    
    // Summary statistics
    console.log(`\n📊 Summary:`);
    console.log(`- Total episodes with remote items: ${episodeMap.size}`);
    console.log(`- Total remote items: ${remoteItems.length}`);
    console.log(`- Average remote items per episode: ${(remoteItems.length / episodeMap.size).toFixed(1)}`);
    
    // Check if our target item is in any episode
    const targetItem = Array.from(remoteItems).find(item => 
      item.getAttribute('feedGuid') === TARGET_FEED_GUID && 
      item.getAttribute('itemGuid') === TARGET_ITEM_GUID
    );
    
    if (targetItem) {
      const targetParent = targetItem.parentNode;
      if (targetParent && targetParent.tagName === 'item') {
        const targetTitle = targetParent.getElementsByTagName('title')[0]?.textContent;
        console.log(`\n🎯 Target item found in episode: ${targetTitle}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchAndParseRSS(); 