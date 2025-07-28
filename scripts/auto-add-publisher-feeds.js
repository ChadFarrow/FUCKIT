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
const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');

async function autoAddPublisherFeeds() {
  console.log('🔍 Scanning for publisher feeds in parsed data...\n');
  
  try {
    // Read parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const feedsConfigPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('❌ Parsed feeds file not found');
      return 0;
    }
    
    if (!fs.existsSync(feedsConfigPath)) {
      console.error('❌ Feeds configuration file not found');
      return 0;
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
      return 0;
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

    // --- NEW LOGIC: Add album feeds from publisher feeds ---
    const allPublisherFeeds = feedsConfig.feeds.filter(f => f.type === 'publisher');
    let newAlbumFeeds = [];
    for (const pubFeed of allPublisherFeeds) {
      const remoteItems = await fetchRemoteItemsFromPublisherFeed(pubFeed.originalUrl);
      for (const albumUrl of remoteItems) {
        // Check if already present
        if (!feedsConfig.feeds.some(f => f.originalUrl === albumUrl)) {
          const albumId = albumUrl
            .replace(/^https?:\/\//, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
          const newAlbumFeed = {
            id: albumId,
            originalUrl: albumUrl,
            type: 'album',
            title: albumId,
            priority: 'extended',
            status: 'active',
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          feedsConfig.feeds.push(newAlbumFeed);
          newAlbumFeeds.push(albumUrl);
          console.log(`  🎶 Added album feed from publisher: ${albumUrl}`);
        }
      }
    }
    if (newAlbumFeeds.length > 0) {
      fs.writeFileSync(feedsConfigPath, JSON.stringify(feedsConfig, null, 2));
      console.log(`\n✅ Added ${newAlbumFeeds.length} new album feeds from publisher feeds.`);
    } else {
      console.log('\n✅ No new album feeds found in publisher feeds.');
    }
    // --- END NEW LOGIC ---
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Total publisher feeds found: ${publisherFeeds.size}`);
    console.log(`   Already configured: ${existingPublisherUrls.size}`);
    console.log(`   Newly added: ${newFeeds.length}`);
    
    return newFeeds.length;
    
  } catch (error) {
    console.error('❌ Error processing publisher feeds:', error);
    return 0;
  }
}

async function main() {
  const added = await autoAddPublisherFeeds();
  if (added === 0) {
    process.exit(0);
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

async function fetchRemoteItemsFromPublisherFeed(publisherUrl) {
  try {
    const res = await fetch(publisherUrl);
    if (!res.ok) {
      console.warn(`⚠️  Failed to fetch publisher feed: ${publisherUrl} (${res.status})`);
      return [];
    }
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xml);
    // Find <podcast:remoteItem> entries
    const channel = data.rss && data.rss.channel ? data.rss.channel : null;
    if (!channel) return [];
    let remoteItems = [];
    if (Array.isArray(channel['podcast:remoteItem'])) {
      remoteItems = channel['podcast:remoteItem'];
    } else if (channel['podcast:remoteItem']) {
      remoteItems = [channel['podcast:remoteItem']];
    }
    // Extract feedUrl from each remoteItem
    return remoteItems
      .map(item => item['@_feedUrl'] || item['@_feedurl'] || item['@_url'])
      .filter(Boolean);
  } catch (e) {
    console.warn(`⚠️  Error parsing publisher feed: ${publisherUrl}`);
    return [];
  }
}

// Export the function for use in other scripts
module.exports = { autoAddPublisherFeeds };

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
} 