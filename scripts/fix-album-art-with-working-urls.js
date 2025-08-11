#!/usr/bin/env node

/**
 * Fix Album Art with Working URLs
 * 
 * This script fixes album art by using actual working placeholder images
 * instead of URLs that return 404.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🎨 Fixing album art with working placeholder URLs...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Working placeholder images - these are actual working URLs
const WORKING_PLACEHOLDERS = {
  // Generic music placeholder - using a working image from doerfelverse
  default: 'https://www.doerfelverse.com/art/doerfelverse-logo.png',
  
  // HGH placeholder - using an actual working logo
  hgh: 'https://www.doerfelverse.com/art/doerfelverse-logo.png', // fallback to working logo
  
  // Alternative generic placeholder
  music: 'https://www.doerfelverse.com/art/carol-of-the-bells.png', // Known working image
  
  // Final fallback - local placeholder
  fallback: '/images/album-placeholder.png' // Local image in public folder
};

// URLs that are known to be broken and need replacement
const BROKEN_URLS = [
  'https://www.doerfelverse.com/art/default-music-note.png',
  'https://homegrownhits.xyz/wp-content/uploads/2023/12/hgh-logo-square.png',
  'https://www.doerfelverse.com/art/playlist-track-placeholder.png',
  'http://rocknrollbreakheart.com/msp/RNRBH/album-art.png'
];

let fixedCount = 0;
let totalAlbums = 0;

console.log('📊 Scanning for albums with broken or missing art...');

for (const feed of parsedFeeds.feeds) {
  if (feed.parseStatus === 'success' && feed.parsedData?.album) {
    const album = feed.parsedData.album;
    totalAlbums++;
    
    // Check if coverArt needs fixing
    const needsFix = !album.coverArt || 
                    album.coverArt === '' || 
                    BROKEN_URLS.some(url => album.coverArt.includes(url.replace('https://', '').replace('http://', '')));
    
    if (needsFix) {
      let newCoverArt;
      
      // Use working placeholder based on album type
      if (feed.id && feed.id.startsWith('hgh-single-')) {
        // HGH singles - use doerfelverse logo as fallback
        newCoverArt = WORKING_PLACEHOLDERS.hgh;
      } else if (album.artist.toLowerCase().includes('doerfel')) {
        // Doerfel artists - use their logo
        newCoverArt = WORKING_PLACEHOLDERS.default;
      } else {
        // Everyone else - use a known working image
        newCoverArt = WORKING_PLACEHOLDERS.music;
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
  const backupPath = `${PARSED_FEEDS_PATH}.backup-working-art-${Date.now()}`;
  fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
  console.log(`\n💾 Created backup at: ${backupPath}`);
  
  // Write updated database
  fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));
  console.log('✅ Database updated with working album art URLs!');
  
  console.log('\n🔍 Using these working placeholder images:');
  Object.entries(WORKING_PLACEHOLDERS).forEach(([key, url]) => {
    console.log(`  ${key}: ${url}`);
  });
} else {
  console.log('✅ No album art needed fixing!');
}