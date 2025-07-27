#!/usr/bin/env node

/**
 * Temporarily Revert to Original Image URLs
 * 
 * Uses original image URLs instead of CDN to bypass cache issues
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map of simple names back to original URLs
const originalUrls = {
  'artwork-music-from-the-doerfel-verse-artwork.png': 'https://www.doerfelverse.com/art/music-from-the-doerfel-verse-artwork.png',
  'artwork-bloodshot-lies---the-album-artwork.png': 'https://www.doerfelverse.com/art/bloodshot-lies-the-album.png',
  'artwork-into-the-doerfel-verse-artwork.png': 'https://www.doerfelverse.com/art/into-the-doerfel-verse-artwork.png',
  'artwork-ben-doerfel-artwork.png': 'https://www.doerfelverse.com/art/ben-doerfel-artwork.png',
  'artwork-kurtisdrums-artwork.png': 'https://www.thisisjdog.com/media/images/kurtisdrumicon.png',
  'artwork-18-sundays-artwork.gif': 'https://www.thisisjdog.com/media/images/18-sundays-cover.gif',
  'artwork-wrath-of-banjo-artwork.png': 'https://www.sirtjthewrathful.com/wp-content/uploads/2024/11/wrath-of-banjo-logo-300x300.png',
  'artwork-dfb-volume-1-artwork.png': 'https://www.doerfelverse.com/art/dfb-volume-1-artwork.png',
  'artwork-dfb-volume-2-artwork.png': 'https://www.doerfelverse.com/art/dfb-volume-2-artwork.png',
  'artwork-generation-gap-artwork.png': 'https://www.doerfelverse.com/art/generation-gap-artwork.png',
  'artwork-christ-exalted-artwork.png': 'https://www.sirtjthewrathful.com/wp-content/uploads/2024/04/christ-exalted-512x512-1.png',
  // Add more mappings as needed
};

async function revertToOriginalUrls() {
  console.log('🔄 Reverting to original image URLs to bypass CDN cache issues...\n');
  
  try {
    // Read parsed feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    const feedsData = JSON.parse(feedsContent);
    
    let updateCount = 0;
    
    // Process each feed
    feedsData.feeds.forEach(feed => {
      if (feed.parsedData) {
        // Update album artwork
        if (feed.parsedData.album?.coverArt) {
          const filename = feed.parsedData.album.coverArt.split('/').pop();
          if (originalUrls[filename]) {
            console.log(`✅ Reverting ${filename} to original URL`);
            feed.parsedData.album.coverArt = originalUrls[filename];
            updateCount++;
          }
        }
        
        // Update track artwork
        if (feed.parsedData.album?.tracks) {
          feed.parsedData.album.tracks.forEach(track => {
            if (track.coverArt) {
              const filename = track.coverArt.split('/').pop();
              if (originalUrls[filename]) {
                console.log(`✅ Reverting track ${filename} to original URL`);
                track.coverArt = originalUrls[filename];
                updateCount++;
              }
            }
          });
        }
        
        // Update podcast artwork
        if (feed.parsedData.podcast?.coverArt) {
          const filename = feed.parsedData.podcast.coverArt.split('/').pop();
          if (originalUrls[filename]) {
            console.log(`✅ Reverting podcast ${filename} to original URL`);
            feed.parsedData.podcast.coverArt = originalUrls[filename];
            updateCount++;
          }
        }
      }
    });
    
    // Save updated feeds
    await fs.writeFile(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log(`\n🎉 Reverted ${updateCount} image URLs to original sources!`);
    console.log('📌 This bypasses the CDN cache issues temporarily.');
    console.log('💡 Images will load directly from original servers like before.\n');
    
  } catch (error) {
    console.error('❌ Error reverting URLs:', error.message);
  }
}

revertToOriginalUrls();