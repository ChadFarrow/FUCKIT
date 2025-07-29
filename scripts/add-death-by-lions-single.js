#!/usr/bin/env node

/**
 * Add Death by Lions Single Track Script
 * 
 * This script adds the Death by Lions single track feed to feeds.json
 */

const fs = require('fs');
const path = require('path');

async function addDeathByLionsSingle() {
  console.log('🔄 Adding Death by Lions single track feed...\n');
  
  try {
    // Load the current feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Check if the feed already exists
    const existingFeed = feedsData.feeds.find(feed => 
      feed.originalUrl === "https://music.behindthesch3m3s.com/wp-content/uploads/Death_by_Lions/i_guess_this_will_have_to_do.xml"
    );
    
    if (existingFeed) {
      console.log('✅ Death by Lions single track feed already exists in feeds.json');
      console.log(`   ID: ${existingFeed.id}`);
      console.log(`   Title: ${existingFeed.title}`);
      return;
    }
    
    // Create the new feed entry
    const newFeed = {
      id: "death-by-lions-i-guess-this-will-have-to-do-single",
      originalUrl: "https://music.behindthesch3m3s.com/wp-content/uploads/Death_by_Lions/i_guess_this_will_have_to_do.xml",
      type: "album",
      title: "I Guess This Will Have to Do - Death by Lions (Single)",
      priority: "extended",
      status: "active",
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Add the feed to feeds.json
    feedsData.feeds.push(newFeed);
    
    // Save the updated feeds.json
    fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log('✅ Added Death by Lions single track feed to feeds.json');
    console.log(`   ID: ${newFeed.id}`);
    console.log(`   Title: ${newFeed.title}`);
    console.log(`   URL: ${newFeed.originalUrl}`);
    console.log('\n📝 Next steps:');
    console.log('1. Run the parse script to parse this new feed');
    console.log('2. The single track will then be available on the site');
    
  } catch (error) {
    console.error('❌ Error adding feed:', error.message);
  }
}

// Run the script
addDeathByLionsSingle(); 