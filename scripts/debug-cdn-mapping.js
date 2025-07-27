#!/usr/bin/env node

/**
 * Debug CDN URL Mapping
 * 
 * This script helps debug why the CDN URL mapping isn't working.
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
 * Debug parsed feeds
 */
async function debugParsedFeeds(urlMapping) {
  try {
    const feedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const feedsData = JSON.parse(await fs.readFile(feedsPath, 'utf8'));
    
    console.log(`\n📊 Parsed feeds data:`);
    console.log(`- Total feeds: ${feedsData.feeds.length}`);
    
    let totalImages = 0;
    let matchedImages = 0;
    
    // Check first few feeds
    feedsData.feeds.slice(0, 3).forEach((feed, index) => {
      console.log(`\n🔍 Feed ${index + 1}: ${feed.title}`);
      
      // Check album artwork
      if (feed.artwork) {
        totalImages++;
        console.log(`  Album artwork: ${feed.artwork}`);
        if (urlMapping[feed.artwork]) {
          matchedImages++;
          console.log(`  ✅ Mapped to: ${urlMapping[feed.artwork]}`);
        } else {
          console.log(`  ❌ No mapping found`);
        }
      }
      
      // Check track images
      if (feed.tracks) {
        feed.tracks.slice(0, 3).forEach((track, trackIndex) => {
          if (track.image) {
            totalImages++;
            console.log(`  Track ${trackIndex + 1} image: ${track.image}`);
            if (urlMapping[track.image]) {
              matchedImages++;
              console.log(`  ✅ Mapped to: ${urlMapping[track.image]}`);
            } else {
              console.log(`  ❌ No mapping found`);
            }
          }
        });
      }
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`- Total images checked: ${totalImages}`);
    console.log(`- Images with mappings: ${matchedImages}`);
    console.log(`- Match rate: ${((matchedImages / totalImages) * 100).toFixed(1)}%`);
    
    // Show some example mappings
    console.log(`\n🔗 Example mappings from upload report:`);
    const mappingKeys = Object.keys(urlMapping).slice(0, 5);
    mappingKeys.forEach(key => {
      console.log(`  ${key} → ${urlMapping[key]}`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging parsed feeds:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Starting CDN URL mapping debug...\n');
  
  // Load upload report
  const urlMapping = await loadUploadReport();
  
  if (Object.keys(urlMapping).length === 0) {
    console.error('❌ No URL mappings found in upload report');
    process.exit(1);
  }
  
  // Debug parsed feeds
  await debugParsedFeeds(urlMapping);
}

// Run the script
main().catch(console.error); 