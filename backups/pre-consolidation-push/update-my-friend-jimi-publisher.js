#!/usr/bin/env node

/**
 * Update My Friend Jimi Publisher Script
 * 
 * This script updates the My Friend Jimi publisher feed to include
 * all the parsed albums in the publisherItems array.
 */

const fs = require('fs');
const path = require('path');

async function updateMyFriendJimiPublisher() {
  console.log('🔄 Updating My Friend Jimi publisher feed...\n');
  
  try {
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find all My Friend Jimi albums
    const myFriendJimiAlbums = parsedFeedsData.feeds.filter(feed => 
      feed.parsedData?.album?.publisher?.feedGuid === "0ea699be-e985-4aa1-8c00-43542e4b9e0d" &&
      feed.type === "album"
    );
    
    console.log(`📋 Found ${myFriendJimiAlbums.length} My Friend Jimi albums:`);
    myFriendJimiAlbums.forEach(album => {
      console.log(`   - ${album.parsedData.album.title} (${album.parsedData.album.tracks.length} tracks)`);
    });
    
    // Find the My Friend Jimi publisher feed
    const publisherFeedIndex = parsedFeedsData.feeds.findIndex(feed => 
      feed.id === "my-friend-jimi-publisher"
    );
    
    if (publisherFeedIndex === -1) {
      console.log('❌ My Friend Jimi publisher feed not found');
      return;
    }
    
    // Create publisher items from the albums
    const publisherItems = myFriendJimiAlbums.map(album => ({
      id: album.id,
      title: album.parsedData.album.title,
      artist: album.parsedData.album.artist,
      coverArt: album.parsedData.album.coverArt,
      trackCount: album.parsedData.album.tracks.length,
      releaseDate: album.parsedData.album.releaseDate,
      link: album.parsedData.album.link,
      description: album.parsedData.album.description
    }));
    
    // Update the publisher feed
    parsedFeedsData.feeds[publisherFeedIndex].parsedData.publisherItems = publisherItems;
    parsedFeedsData.feeds[publisherFeedIndex].lastParsed = new Date().toISOString();
    
    // Save the updated parsed-feeds.json
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    
    console.log(`\n✅ Updated My Friend Jimi publisher feed with ${publisherItems.length} albums`);
    console.log('\n📝 The My Friend Jimi publisher page should now show all albums:');
    publisherItems.forEach(item => {
      console.log(`   - ${item.title} (${item.trackCount} tracks)`);
    });
    
  } catch (error) {
    console.error('❌ Error updating publisher feed:', error.message);
  }
}

// Run the script
updateMyFriendJimiPublisher(); 