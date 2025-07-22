#!/usr/bin/env node

/**
 * Test RSS Feeds Script
 * 
 * This script tests all RSS feeds individually to identify which ones are failing
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the feed URLs from the main page
const PAGE_FILE = path.join(__dirname, '..', 'app', 'page.tsx');

async function extractFeedUrls() {
  try {
    const content = await fs.readFile(PAGE_FILE, 'utf8');
    
    // Find the feedUrlMappings array
    const mappingMatch = content.match(/const feedUrlMappings = \[([\s\S]*?)\];/);
    if (!mappingMatch) {
      throw new Error('Could not find feedUrlMappings in page.tsx');
    }
    
    const mappings = mappingMatch[1];
    
    // Extract original URLs (first element of each array)
    const urlMatches = mappings.match(/\['([^']+)',\s*'[^']+'\]/g);
    if (!urlMatches) {
      throw new Error('Could not extract URLs from feedUrlMappings');
    }
    
    const urls = urlMatches.map(match => {
      const urlMatch = match.match(/\['([^']+)'/);
      return urlMatch ? urlMatch[1] : null;
    }).filter(url => url !== null);
    
    return urls;
  } catch (error) {
    console.error('Error extracting feed URLs:', error);
    return [];
  }
}

async function testFeed(url) {
  try {
    console.log(`🔍 Testing: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (RSS Test Script)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (response.ok) {
      console.log(`✅ Success: ${url} (${response.status})`);
      return { url, status: response.status, success: true };
    } else {
      console.log(`❌ Failed: ${url} (${response.status})`);
      return { url, status: response.status, success: false };
    }
  } catch (error) {
    console.log(`💥 Error: ${url} - ${error.message}`);
    return { url, status: 'ERROR', success: false, error: error.message };
  }
}

async function main() {
  console.log('🎵 Testing RSS Feeds...\n');
  
  const feedUrls = await extractFeedUrls();
  console.log(`📋 Found ${feedUrls.length} RSS feeds to test\n`);
  
  const results = [];
  
  // Test feeds in batches to avoid overwhelming servers
  const batchSize = 5;
  for (let i = 0; i < feedUrls.length; i += batchSize) {
    const batch = feedUrls.slice(i, i + batchSize);
    console.log(`📦 Testing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(feedUrls.length / batchSize)}`);
    
    const batchPromises = batch.map(url => testFeed(url));
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ 
          url: batch[index], 
          status: 'ERROR', 
          success: false, 
          error: result.reason.message 
        });
      }
    });
    
    // Small delay between batches
    if (i + batchSize < feedUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Feeds:');
    failed.forEach(result => {
      console.log(`   ${result.url} - ${result.status}${result.error ? ` (${result.error})` : ''}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\n✅ Working Feeds:');
    successful.slice(0, 5).forEach(result => {
      console.log(`   ${result.url} - ${result.status}`);
    });
    if (successful.length > 5) {
      console.log(`   ... and ${successful.length - 5} more`);
    }
  }
  
  console.log('\n🏁 Test completed!');
}

main().catch(console.error); 