#!/usr/bin/env node

/**
 * Test Publisher Page Loading Script
 * 
 * This script simulates how the publisher page should load data
 * and shows what data should be available for My Friend Jimi.
 */

const fs = require('fs');
const path = require('path');

async function testPublisherPageLoading() {
  console.log('🔍 Testing Publisher Page Data Loading...\n');
  
  try {
    // Load the parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Simulate the publisher page loading process for My Friend Jimi
    const publisherId = 'my-friend-jimi';
    
    console.log(`🎯 Testing publisher page for: ${publisherId}`);
    
    // Step 1: Find the publisher feed
    const publisherFeed = parsedFeedsData.feeds.find(feed => 
      feed.type === 'publisher' && 
      feed.parseStatus === 'success' &&
      feed.parsedData &&
      (feed.id === `${publisherId}-publisher` || feed.id.includes(publisherId))
    );
    
    if (!publisherFeed) {
      console.log('❌ Publisher feed not found');
      return;
    }
    
    console.log(`✅ Found publisher feed: ${publisherFeed.id}`);
    
    // Step 2: Extract publisher info
    const publisherInfo = publisherFeed.parsedData?.publisherInfo;
    const publisherItems = publisherFeed.parsedData?.publisherItems || [];
    
    console.log('\n📋 Publisher Info:');
    if (publisherInfo) {
      console.log(`   Title: ${publisherInfo.title}`);
      console.log(`   Artist: ${publisherInfo.artist}`);
      console.log(`   Description: ${publisherInfo.description}`);
      console.log(`   Cover Art: ${publisherInfo.coverArt ? 'Available' : 'Not available'}`);
    } else {
      console.log('   No publisher info available');
    }
    
    console.log(`\n📋 Publisher Items (${publisherItems.length} albums):`);
    publisherItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (${item.trackCount} tracks)`);
      console.log(`      Artist: ${item.artist}`);
      console.log(`      Cover Art: ${item.coverArt ? 'Available' : 'Not available'}`);
      console.log(`      Release Date: ${item.releaseDate}`);
      console.log(`      Link: ${item.link}`);
      console.log('');
    });
    
    // Step 3: Find individual albums for this publisher
    const publisherAlbums = parsedFeedsData.feeds.filter(feed => 
      feed.type === 'album' &&
      feed.parseStatus === 'success' &&
      feed.parsedData?.album?.publisher?.feedGuid === "0ea699be-e985-4aa1-8c00-43542e4b9e0d"
    );
    
    console.log(`📋 Individual Albums (${publisherAlbums.length} albums):`);
    publisherAlbums.forEach((album, index) => {
      const albumData = album.parsedData.album;
      console.log(`   ${index + 1}. ${albumData.title} (${albumData.tracks.length} tracks)`);
      console.log(`      Artist: ${albumData.artist}`);
      console.log(`      Cover Art: ${albumData.coverArt ? 'Available' : 'Not available'}`);
      console.log(`      Release Date: ${albumData.releaseDate}`);
      console.log(`      Link: ${albumData.link}`);
      console.log('');
    });
    
    // Step 4: Simulate what the publisher page should display
    console.log('🎯 Publisher Page Should Display:');
    console.log(`   - Publisher Name: ${publisherInfo?.artist || publisherInfo?.title || 'My Friend Jimi'}`);
    console.log(`   - Publisher Description: ${publisherInfo?.description || 'Independent artist and music creator'}`);
    console.log(`   - Publisher Cover Art: ${publisherInfo?.coverArt ? 'Available' : 'Not available'}`);
    console.log(`   - Number of Albums: ${publisherItems.length}`);
    console.log(`   - Individual Album Count: ${publisherAlbums.length}`);
    
    if (publisherItems.length > 0) {
      console.log('\n✅ The publisher page should show all albums correctly!');
      console.log('   The data is available in the parsed feeds.');
    } else {
      console.log('\n❌ The publisher page may not show albums correctly.');
      console.log('   No publisher items found in the publisher feed.');
    }
    
    // Step 5: Check if there's a mismatch between publisher items and individual albums
    if (publisherItems.length !== publisherAlbums.length) {
      console.log('\n⚠️  Warning: Mismatch between publisher items and individual albums');
      console.log(`   Publisher Items: ${publisherItems.length}`);
      console.log(`   Individual Albums: ${publisherAlbums.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing publisher page loading:', error.message);
  }
}

// Run the script
testPublisherPageLoading(); 