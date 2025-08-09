#!/usr/bin/env node

/**
 * Update RSS Feeds to Use Simple Artwork Names
 * 
 * Convert encoded artwork URLs in RSS feeds to simple names:
 * From: artwork-album-aHR0cHM6Ly9GVUNLSVQuYi1jZG4ubmV0L2FsYnVtcy9hbGJ1bS1hcnR3b3JrLnBuZw==.png
 * To:   artwork-album-artwork.png
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert encoded filename to simple name
function getSimpleNameFromEncoded(encodedFilename) {
  const match = encodedFilename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
  if (match) {
    try {
      const base64Part = match[1];
      const originalUrl = atob(base64Part);
      
      if (originalUrl.includes('/albums/')) {
        const albumPart = originalUrl.split('/albums/')[1];
        const nameWithoutExt = albumPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
        return `artwork-${nameWithoutExt}.${match[2]}`;
      }
    } catch (error) {
      // Ignore decode errors
    }
  }
  return null;
}

async function updateFeedsToSimpleNames() {
  console.log('🔄 Updating RSS feeds to use simple artwork names...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    
    // Read current feeds
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    const parsedData = JSON.parse(feedsData);
    
    let updatedCount = 0;
    
    // Update each feed
    parsedData.feeds.forEach(feed => {
      // Update album cover art
      if (feed.parsedData?.album?.coverArt && feed.parsedData.album.coverArt.includes('FUCKIT.b-cdn.net/cache/artwork/')) {
        const filename = feed.parsedData.album.coverArt.split('/').pop();
        const simpleName = getSimpleNameFromEncoded(filename);
        if (simpleName) {
          const newUrl = feed.parsedData.album.coverArt.replace(filename, simpleName);
          console.log(`📸 Album cover: ${filename} → ${simpleName}`);
          feed.parsedData.album.coverArt = newUrl;
          updatedCount++;
        }
      }
      
      // Update track images
      feed.parsedData?.album?.tracks?.forEach(track => {
        if (track.image && track.image.includes('FUCKIT.b-cdn.net/cache/artwork/')) {
          const filename = track.image.split('/').pop();
          const simpleName = getSimpleNameFromEncoded(filename);
          if (simpleName) {
            const newUrl = track.image.replace(filename, simpleName);
            console.log(`🎵 Track: ${filename} → ${simpleName}`);
            track.image = newUrl;
            updatedCount++;
          }
        }
      });
    });
    
    console.log(`\n📊 Updated ${updatedCount} artwork URLs to simple names`);
    
    if (updatedCount === 0) {
      console.log('✅ No updates needed!');
      return;
    }
    
    // Create backup
    const backupPath = `${feedsPath}.backup-${Date.now()}`;
    await fs.copyFile(feedsPath, backupPath);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
    
    // Write updated feeds
    const updatedFeedsData = JSON.stringify(parsedData, null, 2);
    await fs.writeFile(feedsPath, updatedFeedsData, 'utf8');
    console.log('✅ Updated parsed-feeds.json with simple artwork names');
    
    console.log('\n🎉 RSS feeds now use simple artwork URLs!');
    console.log('🔄 CDN will serve simple paths like: FUCKIT.b-cdn.net/cache/artwork/artwork-album-name.png');
    
  } catch (error) {
    console.error('❌ Error updating feeds:', error.message);
    process.exit(1);
  }
}

// Run the update
updateFeedsToSimpleNames();