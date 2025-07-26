#!/usr/bin/env node

/**
 * Analyze Cache Duplicates
 * 
 * This script analyzes the cache metadata to identify duplicate artwork
 * that would cause issues during upload to Bunny.net
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeCacheDuplicates() {
  console.log('🔍 Analyzing cache metadata for duplicates...\n');
  
  try {
    // Read cache metadata
    const metadataPath = path.join(__dirname, '..', 'data', 'cache', 'cache-metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    const cacheItems = JSON.parse(metadataContent);
    
    console.log(`📊 Total cache items: ${cacheItems.length}`);
    
    // Group by original URL to find duplicates
    const groupedByUrl = {};
    const artworkItems = cacheItems.filter(item => item.type === 'artwork');
    
    console.log(`🎨 Artwork items: ${artworkItems.length}`);
    
    artworkItems.forEach(item => {
      if (!groupedByUrl[item.originalUrl]) {
        groupedByUrl[item.originalUrl] = [];
      }
      groupedByUrl[item.originalUrl].push(item);
    });
    
    // Find duplicates
    const duplicates = {};
    const uniqueItems = [];
    
    Object.entries(groupedByUrl).forEach(([url, items]) => {
      if (items.length > 1) {
        duplicates[url] = items;
      } else {
        uniqueItems.push(items[0]);
      }
    });
    
    console.log(`\n📈 Analysis Results:`);
    console.log(`   Unique artwork URLs: ${Object.keys(groupedByUrl).length}`);
    console.log(`   Duplicate URLs: ${Object.keys(duplicates).length}`);
    console.log(`   Items with duplicates: ${Object.values(duplicates).reduce((sum, items) => sum + items.length, 0)}`);
    console.log(`   Unique items: ${uniqueItems.length}`);
    
    if (Object.keys(duplicates).length > 0) {
      console.log(`\n🚨 DUPLICATE ARTWORK FOUND:`);
      
      Object.entries(duplicates).forEach(([url, items]) => {
        console.log(`\n   Original URL: ${url}`);
        console.log(`   Duplicate count: ${items.length}`);
        
        items.forEach((item, index) => {
          const isAlbumArt = !item.trackNumber;
          const trackInfo = isAlbumArt ? 'ALBUM ART' : `Track ${item.trackNumber}`;
          console.log(`     ${index + 1}. ${item.id} (${trackInfo})`);
        });
      });
      
      // Generate deduplication recommendations
      console.log(`\n💡 DEDUPLICATION RECOMMENDATIONS:`);
      console.log(`   1. Keep only album artwork (no trackNumber) for each unique URL`);
      console.log(`   2. Remove track-specific artwork duplicates`);
      console.log(`   3. Use album artwork for all tracks from the same album`);
      
      // Calculate storage savings
      const totalDuplicateSize = Object.values(duplicates).reduce((sum, items) => {
        return sum + items.slice(1).reduce((itemSum, item) => itemSum + item.size, 0);
      }, 0);
      
      console.log(`\n💰 STORAGE SAVINGS:`);
      console.log(`   Duplicate size: ${(totalDuplicateSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Upload time saved: ~${Math.ceil(totalDuplicateSize / 1024 / 1024 / 10)} minutes`);
      
    } else {
      console.log(`\n✅ No duplicates found!`);
    }
    
    // Save analysis report
    const report = {
      totalItems: cacheItems.length,
      artworkItems: artworkItems.length,
      uniqueUrls: Object.keys(groupedByUrl).length,
      duplicateUrls: Object.keys(duplicates).length,
      duplicates: duplicates,
      uniqueItems: uniqueItems,
      analysisDate: new Date().toISOString()
    };
    
    const reportPath = path.join(__dirname, '..', 'cache-duplicates-analysis.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Analysis report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error analyzing cache:', error.message);
    process.exit(1);
  }
}

analyzeCacheDuplicates(); 