#!/usr/bin/env node

/**
 * Update Death by Lions Publisher Script
 * 
 * This script updates the Death by Lions publisher feed to include
 * both albums in the publisherItems array.
 */

const fs = require('fs');
const path = require('path');

async function updateDeathByLionsPublisher() {
  console.log('🔄 Updating Death by Lions publisher feed...\n');
  
  try {
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find all Death by Lions albums
    const deathByLionsAlbums = parsedFeedsData.feeds.filter(feed => 
      feed.parsedData?.album?.publisher?.feedGuid === "1e7f8807-31a7-454c-b612-f2563ba4cf67" &&
      feed.type === "album"
    );
    
    console.log(`📋 Found ${deathByLionsAlbums.length} Death by Lions albums:`);
    deathByLionsAlbums.forEach(album => {
      console.log(`   - ${album.parsedData.album.title} (${album.parsedData.album.tracks.length} tracks)`);
    });
    
    // Find the Death by Lions publisher feed
    const publisherFeedIndex = parsedFeedsData.feeds.findIndex(feed => 
      feed.id === "death-by-lions-publisher"
    );
    
    if (publisherFeedIndex === -1) {
      console.log('❌ Death by Lions publisher feed not found');
      return;
    }
    
    // Create publisher items from the albums
    const publisherItems = deathByLionsAlbums.map(album => ({
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
    
    console.log(`\n✅ Updated Death by Lions publisher feed with ${publisherItems.length} albums`);
    console.log('\n📝 The Death by Lions publisher page should now show all albums:');
    publisherItems.forEach(item => {
      console.log(`   - ${item.title} (${item.trackCount} tracks)`);
    });
    
  } catch (error) {
    console.error('❌ Error updating publisher feed:', error.message);
  }
}

// Run the script
updateDeathByLionsPublisher(); 