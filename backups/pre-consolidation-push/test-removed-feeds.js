#!/usr/bin/env node

// Test script for removed RSS feeds
const https = require('https');
const http = require('http');

// All the feeds that were removed from the configuration
const removedFeeds = [
  // Additional Doerfels albums and projects
  'https://www.doerfelverse.com/feeds/18sundays.xml',
  'https://www.doerfelverse.com/feeds/alandace.xml',
  'https://www.doerfelverse.com/feeds/autumn.xml',
  'https://www.doerfelverse.com/feeds/christ-exalted.xml',
  'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
  'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
  'https://www.doerfelverse.com/feeds/dfbv1.xml',
  'https://www.doerfelverse.com/feeds/dfbv2.xml',
  'https://www.doerfelverse.com/feeds/disco-swag.xml',
  'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
  'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
  'https://www.doerfelverse.com/feeds/generation-gap.xml',
  'https://www.doerfelverse.com/feeds/heartbreak.xml',
  'https://www.doerfelverse.com/feeds/merry-christmix.xml',
  'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
  'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
  'https://www.doerfelverse.com/feeds/possible.xml',
  'https://www.doerfelverse.com/feeds/pour-over.xml',
  'https://www.doerfelverse.com/feeds/psalm-54.xml',
  'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
  'https://www.doerfelverse.com/feeds/they-dont-know.xml',
  'https://www.doerfelverse.com/feeds/think-ep.xml',
  'https://www.doerfelverse.com/feeds/underwater-single.xml',
  'https://www.doerfelverse.com/feeds/unsound-existence.xml',
  'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
  'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
  'https://www.doerfelverse.com/feeds/your-chance.xml',
  'https://www.doerfelverse.com/artists/opus/opus/opus.xml',
];

console.log('🔍 Testing Removed RSS Feeds...\n');

let successful = 0;
let failed = 0;
const results = [];

async function testFeed(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 300;
      
      results.push({
        url,
        status: statusCode,
        success,
        error: null
      });
      
      if (success) {
        successful++;
        console.log(`✅ Success: ${url} (${statusCode})`);
      } else {
        failed++;
        console.log(`❌ Failed: ${url} (${statusCode})`);
      }
      
      resolve();
    });
    
    req.on('error', (error) => {
      failed++;
      results.push({
        url,
        status: null,
        success: false,
        error: error.message
      });
      console.log(`❌ Error: ${url} - ${error.message}`);
      resolve();
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      failed++;
      results.push({
        url,
        status: null,
        success: false,
        error: 'Timeout'
      });
      console.log(`⏰ Timeout: ${url}`);
      resolve();
    });
  });
}

async function testAllFeeds() {
  console.log(`📋 Found ${removedFeeds.length} removed feeds to test\n`);
  
  // Test feeds in batches of 5
  const batchSize = 5;
  for (let i = 0; i < removedFeeds.length; i += batchSize) {
    const batch = removedFeeds.slice(i, i + batchSize);
    console.log(`📦 Testing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(removedFeeds.length / batchSize)}`);
    
    await Promise.all(batch.map(testFeed));
    
    // Small delay between batches
    if (i + batchSize < removedFeeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`✅ Successful: ${successful}/${removedFeeds.length}`);
  console.log(`❌ Failed: ${failed}/${removedFeeds.length}\n`);
  
  if (successful > 0) {
    console.log('✅ Working Feeds:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   ${r.url} - ${r.status}`);
    });
    console.log();
  }
  
  if (failed > 0) {
    console.log('❌ Failed Feeds:');
    results.filter(r => !r.success).forEach(r => {
      const error = r.error || `HTTP ${r.status}`;
      console.log(`   ${r.url} - ${error}`);
    });
    console.log();
  }
  
  console.log('🏁 Test completed!');
}

testAllFeeds().catch(console.error); 