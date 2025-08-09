#!/usr/bin/env node

/**
 * Add Death by Lions Publisher Script
 * 
 * This script adds the Death by Lions publisher feed and the second album
 */

const fs = require('fs');
const path = require('path');

async function addDeathByLionsPublisher() {
  console.log('🔄 Adding Death by Lions publisher feed and second album...\n');
  
  try {
    // Load the current feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Death by Lions publisher feed
    const publisherFeed = {
      id: "death-by-lions-publisher",
      originalUrl: "https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67",
      type: "publisher",
      title: "Death by Lions",
      priority: "extended",
      status: "active",
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Death by Lions second album feed
    const secondAlbumFeed = {
      id: "death-by-lions-second-album",
      originalUrl: "https://wavlake.com/feed/music/ef437ae2-c7f1-449b-84ee-fba14daabd02",
      type: "album",
      title: "Death by Lions Album 2",
      priority: "extended",
      status: "active",
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Check if feeds already exist
    const existingPublisher = feedsData.feeds.find(feed => 
      feed.originalUrl === publisherFeed.originalUrl
    );
    
    const existingAlbum = feedsData.feeds.find(feed => 
      feed.originalUrl === secondAlbumFeed.originalUrl
    );
    
    let addedCount = 0;
    
    if (!existingPublisher) {
      feedsData.feeds.push(publisherFeed);
      console.log('➕ Added Death by Lions publisher feed');
      addedCount++;
    } else {
      console.log('✅ Death by Lions publisher feed already exists');
    }
    
    if (!existingAlbum) {
      feedsData.feeds.push(secondAlbumFeed);
      console.log('➕ Added Death by Lions second album feed');
      addedCount++;
    } else {
      console.log('✅ Death by Lions second album feed already exists');
    }
    
    if (addedCount > 0) {
      // Save the updated feeds.json
      fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2));
      
      console.log(`\n✅ Added ${addedCount} new Death by Lions feeds to feeds.json`);
      console.log('\n📝 Next steps:');
      console.log('1. Run the parse-all-feeds script to parse the new feeds');
      console.log('2. The Death by Lions publisher page will show all albums');
    } else {
      console.log('\n✅ All Death by Lions feeds already exist');
    }
    
  } catch (error) {
    console.error('❌ Error adding feeds:', error.message);
  }
}

// Run the script
addDeathByLionsPublisher(); 