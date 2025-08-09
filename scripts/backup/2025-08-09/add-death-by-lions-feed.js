#!/usr/bin/env node

/**
 * Add Death by Lions Feed Script
 * 
 * This script adds the Death by Lions album feed to feeds.json
 */

const fs = require('fs');
const path = require('path');

async function addDeathByLionsFeed() {
  console.log('🔄 Adding Death by Lions album feed...\n');
  
  try {
    // Load the current feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Check if the feed already exists
    const existingFeed = feedsData.feeds.find(feed => 
      feed.originalUrl === "https://wavlake.com/feed/e9ae5762-130d-4a16-b8b2-98804cc1802e"
    );
    
    if (existingFeed) {
      console.log('✅ Death by Lions feed already exists in feeds.json');
      console.log(`   ID: ${existingFeed.id}`);
      console.log(`   Title: ${existingFeed.title}`);
      return;
    }
    
    // Create the new feed entry
    const newFeed = {
      id: "death-by-lions-the-sheer-magnitude-of-it-all",
      originalUrl: "https://wavlake.com/feed/e9ae5762-130d-4a16-b8b2-98804cc1802e",
      type: "album",
      title: "The Sheer Magnitude Of it All - Death by Lions",
      priority: "extended",
      status: "active",
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Add the feed to feeds.json
    feedsData.feeds.push(newFeed);
    
    // Save the updated feeds.json
    fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log('✅ Added Death by Lions feed to feeds.json');
    console.log(`   ID: ${newFeed.id}`);
    console.log(`   Title: ${newFeed.title}`);
    console.log(`   URL: ${newFeed.originalUrl}`);
    console.log('\n📝 Next steps:');
    console.log('1. Run the parse-all-feeds script to parse this new feed');
    console.log('2. The album will then be available on the site');
    
  } catch (error) {
    console.error('❌ Error adding feed:', error.message);
  }
}

// Run the script
addDeathByLionsFeed(); 