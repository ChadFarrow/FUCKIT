#!/usr/bin/env node

/**
 * Test IROH Publisher Script
 * This script tests the IROH publisher mapping and feed loading
 */

import { getPublisherInfo } from '../lib/url-utils.ts';
import { RSSParser } from '../lib/rss-parser.ts';

async function testIrohPublisher() {
  console.log('🧪 Testing IROH Publisher...\n');
  
  // Test 1: Check publisher mapping
  console.log('1️⃣ Testing publisher mapping...');
  const publisherInfo = getPublisherInfo('iroh');
  
  if (!publisherInfo) {
    console.error('❌ Publisher mapping not found for "iroh"');
    return;
  }
  
  console.log('✅ Publisher mapping found:', publisherInfo);
  
  // Test 2: Test publisher feed info
  console.log('\n2️⃣ Testing publisher feed info...');
  try {
    const feedInfo = await RSSParser.parsePublisherFeedInfo(publisherInfo.feedUrl);
    console.log('✅ Publisher feed info:', feedInfo);
  } catch (error) {
    console.error('❌ Error loading publisher feed info:', error);
  }
  
  // Test 3: Test publisher items
  console.log('\n3️⃣ Testing publisher items...');
  try {
    const items = await RSSParser.parsePublisherFeed(publisherInfo.feedUrl);
    console.log(`✅ Found ${items.length} publisher items:`, items);
  } catch (error) {
    console.error('❌ Error loading publisher items:', error);
  }
  
  // Test 4: Test loading albums (this might take a while)
  console.log('\n4️⃣ Testing album loading...');
  try {
    console.log('⏳ Loading albums (this may take a moment)...');
    const albums = await RSSParser.parsePublisherFeedAlbums(publisherInfo.feedUrl);
    console.log(`✅ Loaded ${albums.length} albums from IROH publisher`);
    
    if (albums.length > 0) {
      console.log('📋 Album list:');
      albums.forEach((album, index) => {
        console.log(`  ${index + 1}. ${album.title} (${album.tracks.length} tracks)`);
      });
    }
  } catch (error) {
    console.error('❌ Error loading albums:', error);
  }
  
  console.log('\n✅ IROH publisher test completed!');
}

// Run the test
testIrohPublisher().catch(console.error); 