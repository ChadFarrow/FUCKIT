#!/usr/bin/env node

/**
 * Update Parsed Data with Actual Bunny.net CDN URLs
 * 
 * This script updates the parsed-feeds.json file to use the actual
 * Bunny.net CDN URLs from the upload report instead of generating fake ones.
 */

import fs from 'fs/promises';
import path from 'path';

// Bunny.net CDN configuration
const BUNNY_CDN_URL = 'https://re-podtards.b-cdn.net';

/**
 * Load the upload report to get the actual CDN URLs
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
    
    return urlMapping;
  } catch (error) {
    console.error('❌ Error loading upload report:', error.message);
    return {};
  }
}

/**
 * Update URLs in an object recursively using the actual mapping
 */
function updateUrlsInObject(obj, urlMapping) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => updateUrlsInObject(item, urlMapping));
  }
  
  const updated = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && (key === 'coverArt' || key === 'image')) {
      // Update image URLs using the actual mapping
      if (urlMapping[value]) {
        updated[key] = urlMapping[value];
        console.log(`🖼️ Updated image URL: ${value} → ${updated[key]}`);
      } else {
        updated[key] = value;
      }
    } else if (typeof value === 'string' && key === 'url' && value.includes('.mp3')) {
      // For audio URLs, we'll keep them as is for now since we don't have audio mappings
      updated[key] = value;
    } else if (typeof value === 'object') {
      updated[key] = updateUrlsInObject(value, urlMapping);
    } else {
      updated[key] = value;
    }
  }
  
  return updated;
}

/**
 * Main function to update the parsed data
 */
async function updateParsedData() {
  try {
    console.log('🚀 Starting CDN URL update with actual Bunny.net URLs...\n');
    
    // Load the upload report
    console.log('📖 Loading upload report...');
    const urlMapping = await loadUploadReport();
    
    if (Object.keys(urlMapping).length === 0) {
      console.error('❌ No URL mappings found in upload report');
      return;
    }
    
    console.log(`📊 Found ${Object.keys(urlMapping).length} URL mappings\n`);
    
    // Read the parsed data
    const parsedDataPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    console.log(`📖 Reading parsed data from: ${parsedDataPath}`);
    
    const data = JSON.parse(await fs.readFile(parsedDataPath, 'utf8'));
    console.log(`📊 Found ${data.feeds.length} feeds to update\n`);
    
    // Create backup
    const backupPath = path.join(process.cwd(), 'data', 'parsed-feeds-backup-2.json');
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
    console.log(`💾 Created backup: ${backupPath}\n`);
    
    // Update URLs
    let updatedCount = 0;
    const updatedFeeds = data.feeds.map(feed => {
      if (feed.parsedData) {
        const originalData = JSON.stringify(feed.parsedData);
        feed.parsedData = updateUrlsInObject(feed.parsedData, urlMapping);
        const updatedData = JSON.stringify(feed.parsedData);
        
        if (originalData !== updatedData) {
          updatedCount++;
          console.log(`✅ Updated feed: ${feed.title}`);
        }
      }
      return feed;
    });
    
    // Save updated data
    const updatedData = { ...data, feeds: updatedFeeds };
    await fs.writeFile(parsedDataPath, JSON.stringify(updatedData, null, 2));
    
    console.log(`\n🎉 CDN URL update completed!`);
    console.log(`📊 Updated ${updatedCount} feeds`);
    console.log(`💾 Backup saved to: ${backupPath}`);
    console.log(`📁 Updated data saved to: ${parsedDataPath}`);
    
    // Show some statistics
    const totalImages = countImages(updatedData);
    const totalTracks = countTracks(updatedData);
    console.log(`\n📈 Statistics:`);
    console.log(`🖼️ Total images: ${totalImages}`);
    console.log(`🎵 Total tracks: ${totalTracks}`);
    
    // Show some example mappings
    console.log(`\n🔗 Example URL Mappings:`);
    const examples = Object.entries(urlMapping).slice(0, 5);
    examples.forEach(([original, cdn]) => {
      console.log(`   ${original} → ${cdn}`);
    });
    
  } catch (error) {
    console.error('❌ Error updating CDN URLs:', error);
    process.exit(1);
  }
}

/**
 * Count total images in the data
 */
function countImages(data) {
  let count = 0;
  data.feeds.forEach(feed => {
    if (feed.parsedData?.album?.coverArt) count++;
    if (feed.parsedData?.album?.tracks) {
      feed.parsedData.album.tracks.forEach(track => {
        if (track.image) count++;
      });
    }
  });
  return count;
}

/**
 * Count total tracks in the data
 */
function countTracks(data) {
  let count = 0;
  data.feeds.forEach(feed => {
    if (feed.parsedData?.album?.tracks) {
      count += feed.parsedData.album.tracks.length;
    }
  });
  return count;
}

// Run the script
updateParsedData().catch(console.error); 