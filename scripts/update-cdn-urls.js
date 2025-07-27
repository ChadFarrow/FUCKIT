#!/usr/bin/env node

/**
 * Update Parsed Data with Bunny.net CDN URLs
 * 
 * This script updates the parsed-feeds.json file to use Bunny.net CDN URLs
 * instead of the original URLs for images and audio files.
 */

import fs from 'fs/promises';
import path from 'path';

// Bunny.net CDN configuration
const BUNNY_CDN_URL = 'https://d12wklypp119aj.cloudfront.net';
const BUNNY_CDN_IMAGE_PATH = '/image';
const BUNNY_CDN_TRACK_PATH = '/track';

/**
 * Generate Bunny.net CDN URL for an image
 */
function generateBunnyImageUrl(originalUrl) {
  // Extract filename from original URL
  const urlParts = originalUrl.split('/');
  const filename = urlParts[urlParts.length - 1];
  
  // Generate a unique ID based on the filename
  const uniqueId = generateUniqueId(filename);
  
  return `${BUNNY_CDN_URL}${BUNNY_CDN_IMAGE_PATH}/${uniqueId}.jpg`;
}

/**
 * Generate Bunny.net CDN URL for a track
 */
function generateBunnyTrackUrl(originalUrl) {
  // Extract filename from original URL
  const urlParts = originalUrl.split('/');
  const filename = urlParts[urlParts.length - 1];
  
  // Generate a unique ID based on the filename
  const uniqueId = generateUniqueId(filename);
  
  return `${BUNNY_CDN_URL}${BUNNY_CDN_TRACK_PATH}/${uniqueId}.mp3`;
}

/**
 * Generate a unique ID based on filename
 * This is a simple hash function - you might want to use a more sophisticated approach
 */
function generateUniqueId(filename) {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to a UUID-like format
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}-${Date.now().toString(16).slice(-8)}`;
}

/**
 * Update URLs in an object recursively
 */
function updateUrlsInObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => updateUrlsInObject(item));
  }
  
  const updated = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && (key === 'coverArt' || key === 'image')) {
      // Update image URLs
      if (value.includes('doerfelverse.com/art/') || value.includes('wavlake.com/')) {
        updated[key] = generateBunnyImageUrl(value);
        console.log(`🖼️ Updated image URL: ${value} → ${updated[key]}`);
      } else {
        updated[key] = value;
      }
    } else if (typeof value === 'string' && key === 'url' && value.includes('.mp3')) {
      // Update audio URLs
      if (value.includes('doerfelverse.com/tracks/') || value.includes('wavlake.com/')) {
        updated[key] = generateBunnyTrackUrl(value);
        console.log(`🎵 Updated track URL: ${value} → ${updated[key]}`);
      } else {
        updated[key] = value;
      }
    } else if (typeof value === 'object') {
      updated[key] = updateUrlsInObject(value);
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
    console.log('🚀 Starting CDN URL update...\n');
    
    // Read the parsed data
    const parsedDataPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    console.log(`📖 Reading parsed data from: ${parsedDataPath}`);
    
    const data = JSON.parse(await fs.readFile(parsedDataPath, 'utf8'));
    console.log(`📊 Found ${data.feeds.length} feeds to update\n`);
    
    // Create backup
    const backupPath = path.join(process.cwd(), 'data', 'parsed-feeds-backup.json');
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
    console.log(`💾 Created backup: ${backupPath}\n`);
    
    // Update URLs
    let updatedCount = 0;
    const updatedFeeds = data.feeds.map(feed => {
      if (feed.parsedData) {
        const originalData = JSON.stringify(feed.parsedData);
        feed.parsedData = updateUrlsInObject(feed.parsedData);
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