#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function inspectFeedDetails() {
  const feedGuid = '3ae285ab-434c-59d8-aa2f-59c6129afb92';
  console.log(`\n🔍 Detailed inspection of feed: ${feedGuid}\n`);
  
  try {
    const parser = createRSSParser();
    const completeData = await parser.getCompletePocastData(feedGuid);
    
    console.log('═══ FEED METADATA ═══');
    console.log(`Title: ${completeData.rssFeed.metadata.title}`);
    console.log(`Description: ${completeData.rssFeed.metadata.description}`);
    console.log(`Link: ${completeData.rssFeed.metadata.link}`);
    console.log(`Image URL: ${completeData.rssFeed.metadata.image?.url || 'N/A'}`);
    console.log(`Language: ${completeData.rssFeed.metadata.language || 'N/A'}`);
    
    if (completeData.rssFeed.metadata.itunes) {
      console.log('\n═══ ITUNES METADATA ═══');
      const itunes = completeData.rssFeed.metadata.itunes;
      console.log(`Author: ${itunes.author || 'N/A'}`);
      console.log(`Category: ${itunes.category || 'N/A'}`);
      console.log(`Explicit: ${itunes.explicit || 'N/A'}`);
    }
    
    console.log('\n═══ VALUE4VALUE INFO ═══');
    if (completeData.rssFeed.metadata.value) {
      console.log('Raw Value Data:', JSON.stringify(completeData.rssFeed.metadata.value, null, 2));
    } else {
      console.log('No Value4Value metadata in RSS feed');
    }
    
    if (completeData.apiData.value) {
      console.log('\nAPI Value Data:', JSON.stringify(completeData.apiData.value, null, 2));
    }
    
    console.log('\n═══ TRACKS/EPISODES ═══');
    completeData.rssFeed.items.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   Published: ${item.pubDate}`);
      console.log(`   GUID: ${item.guid}`);
      if (item.enclosure) {
        console.log(`   Audio: ${item.enclosure.url}`);
        console.log(`   Size: ${(parseInt(item.enclosure.length) / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Type: ${item.enclosure.type}`);
      }
      if (item.itunes) {
        console.log(`   Duration: ${item.itunes.duration || 'N/A'}`);
        console.log(`   Image: ${item.itunes.image || 'N/A'}`);
      }
      if (item.value) {
        console.log(`   Track has Value4Value: Yes`);
      }
    });
    
    console.log('\n═══ WAVLAKE SPECIFIC INFO ═══');
    console.log(`Feed URL Pattern: ${completeData.apiData.url}`);
    const wavlakeMatch = completeData.apiData.url.match(/wavlake\.com\/feed\/music\/([a-f0-9-]+)/);
    if (wavlakeMatch) {
      console.log(`Wavlake Artist ID: ${wavlakeMatch[1]}`);
      console.log(`Wavlake Artist Page: https://wavlake.com/john-depew-trio`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

inspectFeedDetails().catch(console.error);