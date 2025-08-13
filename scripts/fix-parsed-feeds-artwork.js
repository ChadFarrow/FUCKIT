#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function fixParsedFeedsArtwork() {
  console.log('🎨 Fixing artwork in parsed-feeds.json...');
  
  const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
  const backupPath = path.join(__dirname, '..', 'data', 'parsed-feeds-backup-before-artwork-fix.json');
  
  // Create backup
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(parsedFeedsPath, backupPath);
    console.log('📋 Created backup:', backupPath);
  }
  
  const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  const feeds = parsedFeedsData.feeds;
  
  let updatedCount = 0;
  
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    
    if (feed.parseStatus === 'success' && feed.parsedData?.album) {
      const album = feed.parsedData.album;
      
      // Check if album has no coverArt
      if (!album.coverArt || album.coverArt.trim() === '') {
        // Create a custom placeholder based on the album title
        const placeholderUrl = `https://via.placeholder.com/300x300/1e40af/ffffff?text=${encodeURIComponent(album.title)}`;
        
        feeds[i].parsedData.album.coverArt = placeholderUrl;
        updatedCount++;
        
        console.log(`🎨 Added placeholder artwork for album: "${album.title}" by ${album.artist || 'Unknown Artist'}`);
      }
      
      // Also check and fix track images if they're empty
      if (album.tracks && Array.isArray(album.tracks)) {
        let trackImagesFixed = 0;
        
        for (let j = 0; j < album.tracks.length; j++) {
          const track = album.tracks[j];
          
          if (!track.image || track.image.trim() === '') {
            // Use the album coverArt for individual tracks
            feeds[i].parsedData.album.tracks[j].image = feeds[i].parsedData.album.coverArt;
            trackImagesFixed++;
          }
        }
        
        if (trackImagesFixed > 0) {
          console.log(`  📝 Fixed ${trackImagesFixed} track images for "${album.title}"`);
        }
      }
    }
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`📊 Processed ${i + 1}/${feeds.length} feeds...`);
    }
  }
  
  // Save updated feeds
  parsedFeedsData.feeds = feeds;
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  
  console.log('\n🎯 Parsed Feeds Artwork Fix Summary:');
  console.log(`- Total feeds processed: ${feeds.length}`);
  console.log(`- Albums with artwork added: ${updatedCount}`);
  console.log(`- Database updated: ${parsedFeedsPath}`);
  
  // Verify the specific album we're looking for
  const atYourCervixFeed = feeds.find(feed => 
    feed.parseStatus === 'success' && 
    feed.parsedData?.album?.title === 'At Your Cervix'
  );
  
  if (atYourCervixFeed) {
    console.log(`\n✅ "At Your Cervix" album now has artwork: ${atYourCervixFeed.parsedData.album.coverArt}`);
  } else {
    console.log(`\n⚠️  Could not find "At Your Cervix" album in parsed feeds`);
  }
}

// Run the fix
fixParsedFeedsArtwork().catch(console.error);
