#!/usr/bin/env node

/**
 * Fix All CDN URLs - Replace ALL CloudFront URLs with Bunny.net CDN URLs
 * 
 * This script replaces ALL instances of the old CloudFront URLs with the correct
 * Bunny.net CDN URLs, regardless of whether they were in the upload report.
 */

import fs from 'fs/promises';
import path from 'path';

// Bunny.net CDN configuration
const BUNNY_CDN_URL = 'https://re-podtards.b-cdn.net';

/**
 * Generate a proper Bunny.net CDN URL for any image
 */
function generateBunnyImageUrl(originalUrl) {
  // Extract filename from original URL
  const urlParts = originalUrl.split('/');
  const filename = urlParts[urlParts.length - 1];
  
  // Generate a unique ID based on the filename
  const uniqueId = generateUniqueId(filename);
  
  // Determine file extension
  const extension = filename.split('.').pop().toLowerCase();
  
  // Create CDN URL
  return `${BUNNY_CDN_URL}/albums/${uniqueId}.${extension}`;
}

/**
 * Generate a unique ID based on filename
 */
function generateUniqueId(filename) {
  // Remove extension
  const nameWithoutExt = filename.split('.')[0];
  
  // Create a hash-like ID
  let hash = 0;
  for (let i = 0; i < nameWithoutExt.length; i++) {
    const char = nameWithoutExt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  const positiveHash = Math.abs(hash).toString(16);
  
  // Pad to 8 characters
  return positiveHash.padStart(8, '0');
}

/**
 * Replace all CloudFront URLs with Bunny.net CDN URLs
 */
function replaceCloudFrontUrls(data) {
  if (typeof data === 'string') {
    // Replace CloudFront image URLs
    if (data.includes('d12wklypp119aj.cloudfront.net/image/')) {
      const newUrl = generateBunnyImageUrl(data);
      console.log(`🖼️ Replacing CloudFront image URL: ${data} → ${newUrl}`);
      return newUrl;
    }
    // Replace CloudFront track URLs (keep as is for now since we don't have audio mappings)
    else if (data.includes('d12wklypp119aj.cloudfront.net/track/')) {
      // For now, keep the original URL structure but change the domain
      const newUrl = data.replace('d12wklypp119aj.cloudfront.net', 're-podtards.b-cdn.net');
      console.log(`🎵 Replacing CloudFront track URL: ${data} → ${newUrl}`);
      return newUrl;
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => replaceCloudFrontUrls(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const updated = {};
    for (const [key, value] of Object.entries(data)) {
      updated[key] = replaceCloudFrontUrls(value);
    }
    return updated;
  }
  
  return data;
}

/**
 * Count images and tracks in the data
 */
function countImages(data) {
  let count = 0;
  
  function countRecursive(obj) {
    if (typeof obj === 'string' && (obj.includes('coverArt') || obj.includes('image'))) {
      count++;
    } else if (Array.isArray(obj)) {
      obj.forEach(countRecursive);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(countRecursive);
    }
  }
  
  countRecursive(data);
  return count;
}

function countTracks(data) {
  let count = 0;
  
  function countRecursive(obj) {
    if (typeof obj === 'string' && obj.includes('.mp3')) {
      count++;
    } else if (Array.isArray(obj)) {
      obj.forEach(countRecursive);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(countRecursive);
    }
  }
  
  countRecursive(data);
  return count;
}

/**
 * Main function to fix all CDN URLs
 */
async function fixAllCdnUrls() {
  try {
    console.log('🚀 Starting comprehensive CDN URL fix...\n');
    
    // Read the parsed data
    const dataPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    console.log(`📖 Reading parsed data from: ${dataPath}`);
    
    const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    console.log(`📊 Found ${data.feeds.length} feeds to process`);
    
    // Create backup
    const backupPath = path.join(process.cwd(), 'data', 'parsed-feeds-backup-3.json');
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
    console.log(`💾 Created backup: ${backupPath}`);
    
    // Replace all CloudFront URLs
    console.log('\n🔄 Replacing all CloudFront URLs with Bunny.net CDN URLs...');
    const updatedData = replaceCloudFrontUrls(data);
    
    // Save the updated data
    await fs.writeFile(dataPath, JSON.stringify(updatedData, null, 2));
    console.log(`✅ Updated data saved to: ${dataPath}`);
    
    // Count statistics
    const imageCount = countImages(updatedData);
    const trackCount = countTracks(updatedData);
    
    console.log('\n🎉 CDN URL fix completed!');
    console.log(`📊 Processed ${data.feeds.length} feeds`);
    console.log(`🖼️ Total images: ${imageCount}`);
    console.log(`🎵 Total tracks: ${trackCount}`);
    console.log(`💾 Backup saved to: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error fixing CDN URLs:', error.message);
    process.exit(1);
  }
}

// Run the script
fixAllCdnUrls(); 