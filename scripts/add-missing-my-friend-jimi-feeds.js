#!/usr/bin/env node

/**
 * Add Missing My Friend Jimi Feeds Script
 * 
 * This script adds the missing My Friend Jimi album feeds to feeds.json
 * based on the publisher feed data.
 */

const fs = require('fs');
const path = require('path');

// My Friend Jimi album feeds from the publisher feed
const myFriendJimiAlbums = [
  {
    "feedGuid": "b220b396-0ebe-4760-8294-4bb27e06eabf",
    "feedUrl": "https://wavlake.com/feed/music/b220b396-0ebe-4760-8294-4bb27e06eabf"
  },
  {
    "feedGuid": "e3f0086f-5ee2-4ead-ba9d-78a9a29acac8",
    "feedUrl": "https://wavlake.com/feed/music/e3f0086f-5ee2-4ead-ba9d-78a9a29acac8"
  },
  {
    "feedGuid": "6c539346-f58e-4480-9276-32da31368f8e",
    "feedUrl": "https://wavlake.com/feed/music/6c539346-f58e-4480-9276-32da31368f8e"
  },
  {
    "feedGuid": "76407adf-773c-4eb2-b5e2-8aef137d781f",
    "feedUrl": "https://wavlake.com/feed/music/76407adf-773c-4eb2-b5e2-8aef137d781f"
  },
  {
    "feedGuid": "6e236029-d72e-48a4-8d0b-aecf78d39e87",
    "feedUrl": "https://wavlake.com/feed/music/6e236029-d72e-48a4-8d0b-aecf78d39e87"
  },
  {
    "feedGuid": "b6d8f17c-f448-4085-8ce2-8b247eb26e63",
    "feedUrl": "https://wavlake.com/feed/music/b6d8f17c-f448-4085-8ce2-8b247eb26e63"
  },
  {
    "feedGuid": "2b5b26a9-3b7a-4f78-9db2-424d94b182d8",
    "feedUrl": "https://wavlake.com/feed/music/2b5b26a9-3b7a-4f78-9db2-424d94b182d8"
  },
  {
    "feedGuid": "ed3d6bdf-011b-4416-ab87-591672c07145",
    "feedUrl": "https://wavlake.com/feed/music/ed3d6bdf-011b-4416-ab87-591672c07145"
  },
  {
    "feedGuid": "3d8c7279-6aa6-41e7-be1c-2680e57af6c8",
    "feedUrl": "https://wavlake.com/feed/music/3d8c7279-6aa6-41e7-be1c-2680e57af6c8"
  },
  {
    "feedGuid": "86061a0e-52df-4cad-8c6d-cd1e19ca1e63",
    "feedUrl": "https://wavlake.com/feed/music/86061a0e-52df-4cad-8c6d-cd1e19ca1e63"
  }
];

async function addMissingFeeds() {
  console.log('🔄 Adding missing My Friend Jimi album feeds...\n');
  
  try {
    // Load the current feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Check which feeds already exist
    const existingFeedUrls = feedsData.feeds.map(feed => feed.originalUrl);
    const missingFeeds = [];
    
    console.log(`📋 Checking ${myFriendJimiAlbums.length} My Friend Jimi albums...\n`);
    
    for (const album of myFriendJimiAlbums) {
      if (!existingFeedUrls.includes(album.feedUrl)) {
        missingFeeds.push({
          id: `my-friend-jimi-${album.feedGuid}`,
          originalUrl: album.feedUrl,
          type: "album",
          title: `My Friend Jimi Album - ${album.feedGuid.substring(0, 8)}`,
          priority: "extended",
          status: "active",
          addedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
        console.log(`➕ Adding: ${album.feedUrl}`);
      } else {
        console.log(`✅ Already exists: ${album.feedUrl}`);
      }
    }
    
    if (missingFeeds.length === 0) {
      console.log('\n✅ All My Friend Jimi albums are already in feeds.json');
      return;
    }
    
    // Add the missing feeds
    feedsData.feeds.push(...missingFeeds);
    
    // Save the updated feeds.json
    fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log(`\n✅ Added ${missingFeeds.length} missing My Friend Jimi album feeds to feeds.json`);
    console.log('\n📝 Next steps:');
    console.log('1. Run the parse-all-feeds script to parse the new feeds');
    console.log('2. Check the My Friend Jimi publisher page to see all albums');
    
  } catch (error) {
    console.error('❌ Error adding missing feeds:', error.message);
  }
}

// Run the script
addMissingFeeds(); 