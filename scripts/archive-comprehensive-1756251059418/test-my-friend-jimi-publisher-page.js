#!/usr/bin/env node

/**
 * Test My Friend Jimi Publisher Page Data Loading
 * 
 * This script tests if the My Friend Jimi publisher page data is loading correctly
 * and shows what albums are available.
 */

const fs = require('fs');
const path = require('path');

async function testMyFriendJimiPublisherPage() {
  console.log('🔍 Testing My Friend Jimi Publisher Page Data Loading...\n');
  
  try {
    // Load the parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find the My Friend Jimi publisher feed
    const myFriendJimiPublisher = parsedFeedsData.feeds.find(feed => 
      feed.id === "my-friend-jimi-publisher"
    );
    
    if (!myFriendJimiPublisher) {
      console.log('❌ My Friend Jimi publisher feed not found in parsed data');
      return;
    }
    
    console.log('✅ My Friend Jimi publisher feed found:');
    console.log(`   ID: ${myFriendJimiPublisher.id}`);
    console.log(`   Title: ${myFriendJimiPublisher.title}`);
    console.log(`   Type: ${myFriendJimiPublisher.type}`);
    console.log(`   Parse Status: ${myFriendJimiPublisher.parseStatus}`);
    console.log(`   Last Parsed: ${myFriendJimiPublisher.lastParsed}`);
    
    // Check publisher info
    if (myFriendJimiPublisher.parsedData?.publisherInfo) {
      console.log('\n📋 Publisher Info:');
      const info = myFriendJimiPublisher.parsedData.publisherInfo;
      console.log(`   Title: ${info.title}`);
      console.log(`   Artist: ${info.artist}`);
      console.log(`   Description: ${info.description}`);
      console.log(`   Cover Art: ${info.coverArt ? 'Available' : 'Not available'}`);
      if (info.coverArt) {
        console.log(`   Cover Art URL: ${info.coverArt}`);
      }
    } else {
      console.log('\n❌ No publisher info found in parsed data');
    }
    
    // Check publisher items
    if (myFriendJimiPublisher.parsedData?.publisherItems) {
      const items = myFriendJimiPublisher.parsedData.publisherItems;
      console.log(`\n📋 Publisher Items (${items.length} albums):`);
      
      items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title} (${item.trackCount} tracks)`);
        console.log(`      Artist: ${item.artist}`);
        console.log(`      Cover Art: ${item.coverArt ? 'Available' : 'Not available'}`);
        if (item.coverArt) {
          console.log(`      Cover Art URL: ${item.coverArt}`);
        }
        console.log(`      Release Date: ${item.releaseDate}`);
        console.log(`      Link: ${item.link}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No publisher items found in parsed data');
    }
    
    // Check if there are individual album feeds for My Friend Jimi
    const myFriendJimiAlbums = parsedFeedsData.feeds.filter(feed => 
      feed.parsedData?.album?.publisher?.feedGuid === "0ea699be-e985-4aa1-8c00-43542e4b9e0d" &&
      feed.type === "album"
    );
    
    console.log(`\n📋 Individual My Friend Jimi Albums (${myFriendJimiAlbums.length} albums):`);
    myFriendJimiAlbums.forEach((album, index) => {
      console.log(`   ${index + 1}. ${album.parsedData.album.title} (${album.parsedData.album.tracks.length} tracks)`);
      console.log(`      Artist: ${album.parsedData.album.artist}`);
      console.log(`      Cover Art: ${album.parsedData.album.coverArt ? 'Available' : 'Not available'}`);
      if (album.parsedData.album.coverArt) {
        console.log(`      Cover Art URL: ${album.parsedData.album.coverArt}`);
      }
      console.log(`      Release Date: ${album.parsedData.album.releaseDate}`);
      console.log(`      Link: ${album.parsedData.album.link}`);
      console.log('');
    });
    
    console.log('\n📝 Summary:');
    console.log(`   - Publisher feed exists: ✅`);
    console.log(`   - Publisher info available: ${myFriendJimiPublisher.parsedData?.publisherInfo ? '✅' : '❌'}`);
    console.log(`   - Publisher items available: ${myFriendJimiPublisher.parsedData?.publisherItems ? '✅' : '❌'}`);
    console.log(`   - Publisher items count: ${myFriendJimiPublisher.parsedData?.publisherItems?.length || 0}`);
    console.log(`   - Individual albums count: ${myFriendJimiAlbums.length}`);
    
    if (myFriendJimiPublisher.parsedData?.publisherItems?.length > 0) {
      console.log('\n✅ The My Friend Jimi publisher page should show all albums correctly!');
    } else {
      console.log('\n❌ The My Friend Jimi publisher page may not show albums correctly.');
      console.log('   The publisher feed exists but has no publisher items.');
    }
    
  } catch (error) {
    console.error('❌ Error testing publisher page data:', error.message);
  }
}

// Run the script
testMyFriendJimiPublisherPage(); 