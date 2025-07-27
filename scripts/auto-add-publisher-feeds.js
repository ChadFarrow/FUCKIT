#!/usr/bin/env node

/**
 * Auto-add Publisher Feeds Script
 * 
 * This script automatically detects publisher feeds from parsed data
 * and adds them to the feeds configuration if they're missing.
 * 
 * Usage: node scripts/auto-add-publisher-feeds.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔍 Scanning for publisher feeds in parsed data...\n');
  
  try {
    // Read parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const feedsConfigPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('❌ Parsed feeds file not found');
      return;
    }
    
    if (!fs.existsSync(feedsConfigPath)) {
      console.error('❌ Feeds configuration file not found');
      return;
    }
    
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
    const feedsConfig = JSON.parse(fs.readFileSync(feedsConfigPath, 'utf-8'));
    
    // Extract all publisher feed URLs from parsed data
    const publisherFeeds = new Set();
    const feedTitles = new Map();
    
    // Scan through all parsed feeds for publisher references
    parsedFeedsData.feeds.forEach(feed => {
      if (feed.parsedData && feed.parsedData.album && feed.parsedData.album.publisher) {
        const publisher = feed.parsedData.album.publisher;
        if (publisher.feedUrl && publisher.medium === 'publisher') {
          publisherFeeds.add(publisher.feedUrl);
          
          // Try to get a meaningful title
          const title = feed.parsedData.album.artist || 
                       feed.parsedData.album.title || 
                       feed.title || 
                       'Unknown Artist';
          feedTitles.set(publisher.feedUrl, title);
        }
      }
    });
    
    console.log(`📊 Found ${publisherFeeds.size} publisher feeds in parsed data`);
    
    // Check which publisher feeds are already in configuration
    const existingPublisherUrls = new Set();
    feedsConfig.feeds.forEach(feed => {
      if (feed.type === 'publisher') {
        existingPublisherUrls.add(feed.originalUrl);
      }
    });
    
    console.log(`📋 ${existingPublisherUrls.size} publisher feeds already configured`);
    
    // Find missing publisher feeds
    const missingPublisherFeeds = Array.from(publisherFeeds).filter(url => 
      !existingPublisherUrls.has(url)
    );
    
    if (missingPublisherFeeds.length === 0) {
      console.log('✅ All publisher feeds are already configured!');
      return;
    }
    
    console.log(`\n🆕 Found ${missingPublisherFeeds.length} new publisher feeds to add:`);
    
    // Add missing publisher feeds
    const newFeeds = [];
    missingPublisherFeeds.forEach((url, index) => {
      const title = feedTitles.get(url) || `Publisher ${index + 1}`;
      const feedId = generateFeedId(title);
      
      const newFeed = {
        id: feedId,
        originalUrl: url,
        type: "publisher",
        title: title,
        priority: "extended",
        status: "active",
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      newFeeds.push(newFeed);
      console.log(`  📝 ${title} (${url})`);
    });
    
    // Add new feeds to configuration
    feedsConfig.feeds.push(...newFeeds);
    feedsConfig.lastUpdated = new Date().toISOString();
    
    // Write updated configuration
    fs.writeFileSync(feedsConfigPath, JSON.stringify(feedsConfig, null, 2));
    
    console.log(`\n✅ Successfully added ${newFeeds.length} publisher feeds to configuration`);
    console.log('📁 Updated: data/feeds.json');
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Total publisher feeds found: ${publisherFeeds.size}`);
    console.log(`   Already configured: ${existingPublisherUrls.size}`);
    console.log(`   Newly added: ${newFeeds.length}`);
    
  } catch (error) {
    console.error('❌ Error processing publisher feeds:', error);
    process.exit(1);
  }
}

function generateFeedId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-') + '-publisher';
}

// Run the script
main().catch(console.error); 