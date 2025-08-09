#!/usr/bin/env node

/**
 * Check All Image Sizes
 * 
 * Analyze all image URLs in parsed-feeds.json to identify large images that might cause issues
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkAllImageSizes() {
  console.log('🔍 Checking all image sizes in parsed-feeds.json...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    const data = JSON.parse(feedsContent);
    
    // Extract all image URLs from feeds
    const imageUrls = new Set();
    
    data.feeds.forEach(feed => {
      // Add album cover art
      if (feed.parsedData?.album?.coverArt && feed.parsedData.album.coverArt.trim()) {
        imageUrls.add(feed.parsedData.album.coverArt.trim());
      }
      
      // Add track images
      if (feed.parsedData?.album?.tracks) {
        feed.parsedData.album.tracks.forEach(track => {
          if (track.image && track.image.trim()) {
            imageUrls.add(track.image.trim());
          }
        });
      }
    });
    
    console.log(`📊 Found ${imageUrls.size} unique image URLs\n`);
    
    const results = [];
    const largeImages = [];
    const failedImages = [];
    
    // Check each image
    for (const url of imageUrls) {
      try {
        console.log(`🔍 Checking: ${url}`);
        
        const response = await fetch(url, { 
          method: 'HEAD',
          timeout: 10000 
        });
        
        if (response.ok) {
          const contentLength = response.headers.get('content-length');
          const contentType = response.headers.get('content-type');
          const sizeInBytes = contentLength ? parseInt(contentLength) : 0;
          const sizeInMB = sizeInBytes / (1024 * 1024);
          
          results.push({
            url,
            size: sizeInMB,
            sizeBytes: sizeInBytes,
            contentType,
            status: response.status
          });
          
          // Flag large images (>1MB)
          if (sizeInMB > 1) {
            largeImages.push({
              url,
              size: sizeInMB,
              sizeBytes: sizeInBytes,
              contentType
            });
          }
          
          console.log(`   ✅ ${sizeInMB.toFixed(2)}MB (${contentType})`);
        } else {
          failedImages.push({
            url,
            status: response.status,
            error: `HTTP ${response.status}`
          });
          console.log(`   ❌ HTTP ${response.status}`);
        }
      } catch (error) {
        failedImages.push({
          url,
          status: 'ERROR',
          error: error.message
        });
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Summary report
    console.log('\n📋 SUMMARY REPORT');
    console.log('================');
    console.log(`Total images checked: ${imageUrls.size}`);
    console.log(`Successful: ${results.length}`);
    console.log(`Failed: ${failedImages.length}`);
    console.log(`Large images (>1MB): ${largeImages.length}`);
    
    if (largeImages.length > 0) {
      console.log('\n🚨 LARGE IMAGES (>1MB):');
      console.log('======================');
      largeImages
        .sort((a, b) => b.size - a.size)
        .forEach(img => {
          console.log(`${img.size.toFixed(2)}MB - ${img.url}`);
        });
    }
    
    if (failedImages.length > 0) {
      console.log('\n❌ FAILED IMAGES:');
      console.log('================');
      failedImages.forEach(img => {
        console.log(`${img.error} - ${img.url}`);
      });
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: imageUrls.size,
        successful: results.length,
        failed: failedImages.length,
        large: largeImages.length
      },
      largeImages,
      failedImages,
      allResults: results
    };
    
    const reportPath = path.join(__dirname, '..', 'data', 'parse-reports', `image-size-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllImageSizes(); 