#!/usr/bin/env node

/**
 * Fix Missing Album Art
 * 
 * This script finds albums without proper cover art and assigns appropriate placeholders.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🎨 Fixing missing album art...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Function to check if a URL returns a valid image
function checkImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve(false);
      return;
    }

    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (res) => {
      const contentType = res.headers['content-type'];
      if (contentType && contentType.startsWith('image/')) {
        resolve(true);
      } else {
        resolve(false);
      }
      res.destroy(); // Don't download the whole image
    }).on('error', () => {
      resolve(false);
    }).setTimeout(3000, () => {
      resolve(false);
    });
  });
}

// Default placeholder image that should work
const DEFAULT_PLACEHOLDER = 'https://www.doerfelverse.com/art/default-album-cover.png';

// Alternative fallback if the above doesn't work
const FALLBACK_PLACEHOLDER = '/images/default-album-art.png'; // Local fallback

async function fixAlbumArt() {
  let fixedCount = 0;
  let totalAlbums = 0;
  
  console.log('📊 Checking album art for all albums...');
  
  for (const feed of parsedFeeds.feeds) {
    if (feed.parseStatus === 'success' && feed.parsedData?.album) {
      const album = feed.parsedData.album;
      totalAlbums++;
      
      // Check if coverArt is missing or invalid
      const needsFix = !album.coverArt || 
                      album.coverArt === '' || 
                      album.coverArt.includes('playlist-track-placeholder.png') ||
                      album.coverArt.includes('rocknrollbreakheart.com');
      
      if (needsFix) {
        // Assign a better placeholder based on the album type
        let newCoverArt;
        
        if (feed.id && feed.id.startsWith('hgh-single-')) {
          // HGH singles get a specific playlist placeholder
          newCoverArt = 'https://homegrownhits.xyz/wp-content/uploads/2023/12/hgh-logo-square.png';
        } else if (album.artist.toLowerCase().includes('doerfel')) {
          // Doerfel artists get the doerfelverse logo
          newCoverArt = 'https://www.doerfelverse.com/art/doerfelverse-logo.png';
        } else {
          // Everyone else gets a generic music placeholder
          newCoverArt = 'https://www.doerfelverse.com/art/default-music-note.png';
        }
        
        console.log(`🔧 Fixed: "${album.title}" by ${album.artist}`);
        console.log(`   Old: ${album.coverArt || 'missing'}`);
        console.log(`   New: ${newCoverArt}`);
        
        album.coverArt = newCoverArt;
        fixedCount++;
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total albums: ${totalAlbums}`);
  console.log(`  Fixed album art: ${fixedCount}`);
  
  if (fixedCount > 0) {
    // Create backup
    const backupPath = `${PARSED_FEEDS_PATH}.backup-art-fix-${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
    console.log(`\n💾 Created backup at: ${backupPath}`);
    
    // Write updated database
    fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));
    console.log('✅ Database updated with fixed album art!');
  } else {
    console.log('✅ No album art needed fixing!');
  }
}

// Run the fix
fixAlbumArt().catch(console.error);