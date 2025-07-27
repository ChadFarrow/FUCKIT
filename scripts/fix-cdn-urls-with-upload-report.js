#!/usr/bin/env node

/**
 * Fix CDN URLs Using Upload Report
 * 
 * This script uses the actual upload report to map original URLs to the real
 * Bunny.net CDN URLs that were actually uploaded, instead of generating fake ones.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Load the upload report to get the actual CDN URL mappings
 */
async function loadUploadReport() {
  try {
    const reportPath = path.join(process.cwd(), 'bunny-upload-report.json');
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    
    // Create a mapping from original URLs to CDN URLs
    const urlMapping = {};
    
    reportData.albums.forEach(album => {
      // Map album artwork
      if (album.originalArtwork && album.cdnArtwork) {
        urlMapping[album.originalArtwork] = album.cdnArtwork;
      }
      
      // Map track images
      if (album.tracks) {
        album.tracks.forEach(track => {
          if (track.originalImage && track.cdnImage) {
            urlMapping[track.originalImage] = track.cdnImage;
          }
        });
      }
    });
    
    console.log(`📋 Loaded ${Object.keys(urlMapping).length} URL mappings from upload report`);
    return urlMapping;
  } catch (error) {
    console.error('❌ Error loading upload report:', error.message);
    return {};
  }
}

/**
 * Update parsed feeds with correct CDN URLs
 */
async function updateParsedFeeds(urlMapping) {
  try {
    const feedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const feedsData = JSON.parse(await fs.readFile(feedsPath, 'utf8'));
    
    let totalUpdates = 0;
    let feedsUpdated = 0;
    
    // Process each feed
    feedsData.feeds.forEach(feed => {
      let feedUpdated = false;
      
      // Check if feed has parsed data with album
      if (feed.parsedData && feed.parsedData.album) {
        const album = feed.parsedData.album;
        
        // Update album cover art
        if (album.coverArt && urlMapping[album.coverArt]) {
          album.coverArt = urlMapping[album.coverArt];
          totalUpdates++;
          feedUpdated = true;
        }
        
        // Update track images
        if (album.tracks) {
          album.tracks.forEach(track => {
            if (track.image && urlMapping[track.image]) {
              track.image = urlMapping[track.image];
              totalUpdates++;
              feedUpdated = true;
            }
          });
        }
      }
      
      if (feedUpdated) {
        feedsUpdated++;
      }
    });
    
    // Create backup
    const backupPath = path.join(process.cwd(), 'data', 'parsed-feeds-backup-5.json');
    await fs.writeFile(backupPath, JSON.stringify(feedsData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Save updated data
    await fs.writeFile(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log(`✅ Updated ${feedsUpdated} feeds with ${totalUpdates} CDN URL mappings`);
    return { feedsUpdated, totalUpdates };
  } catch (error) {
    console.error('❌ Error updating parsed feeds:', error.message);
    return { feedsUpdated: 0, totalUpdates: 0 };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Starting CDN URL fix using upload report...\n');
  
  // Load upload report
  const urlMapping = await loadUploadReport();
  
  if (Object.keys(urlMapping).length === 0) {
    console.error('❌ No URL mappings found in upload report');
    process.exit(1);
  }
  
  // Update parsed feeds
  const results = await updateParsedFeeds(urlMapping);
  
  console.log('\n🎉 CDN URL fix completed!');
  console.log(`📊 Results: ${results.feedsUpdated} feeds updated, ${results.totalUpdates} URLs mapped`);
}

// Run the script
main().catch(console.error); 