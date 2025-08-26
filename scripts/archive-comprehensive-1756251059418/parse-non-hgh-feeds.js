#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

console.log('🔄 Parsing non-HGH feeds...\n');

// Load feeds.json to get non-HGH feed URLs
const feedsPath = path.join(__dirname, '..', 'data', 'feeds.json');
const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));

// Load current parsed feeds
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Create backup
const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-non-hgh-parse-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);

// Get non-HGH feeds from feeds.json
const nonHghFeeds = feedsData.feeds.filter(f => !f.id.startsWith('hgh-'));
console.log(`📊 Found ${nonHghFeeds.length} non-HGH feeds to parse\n`);

// XML parser
const parser = new xml2js.Parser({
  explicitArray: false,
  ignoreAttrs: true
});

// Helper function to safely get nested values
function safeGet(obj, path, defaultValue = '') {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || defaultValue;
}

// Helper function to ensure array
function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Parse a single feed
async function parseFeed(feed) {
  console.log(`📡 Parsing: ${feed.title} (${feed.id})`);
  
  try {
    const response = await fetch(feed.originalUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xmlText = await response.text();
    const result = await parser.parseStringPromise(xmlText);
    
    // Handle RSS or Atom feeds
    const rss = result.rss;
    if (!rss || !rss.channel) {
      throw new Error('Invalid RSS format');
    }
    
    const channel = rss.channel;
    
    // Extract album metadata
    const albumData = {
      title: safeGet(channel, 'title', feed.title),
      artist: safeGet(channel, 'itunes:author') || safeGet(channel, 'author') || feed.title,
      description: safeGet(channel, 'description', ''),
      summary: safeGet(channel, 'itunes:summary', ''),
      subtitle: safeGet(channel, 'itunes:subtitle', ''),
      coverArt: safeGet(channel, 'image.url') || safeGet(channel, 'itunes:image.href') || '',
      explicit: safeGet(channel, 'itunes:explicit') === 'true',
      feedGuid: safeGet(channel, 'podcast:guid', ''),
      feedTitle: safeGet(channel, 'title', feed.title)
    };
    
    // Extract tracks
    const items = ensureArray(channel.item);
    const tracks = items.map((item, index) => {
      const enclosure = item.enclosure || {};
      const duration = safeGet(item, 'itunes:duration', '0:00');
      
      return {
        title: safeGet(item, 'title', `Track ${index + 1}`),
        artist: safeGet(item, 'itunes:author') || albumData.artist,
        duration: duration,
        url: enclosure.url || '',
        trackNumber: index + 1,
        subtitle: safeGet(item, 'itunes:subtitle', ''),
        summary: safeGet(item, 'itunes:summary', ''),
        image: safeGet(item, 'itunes:image.href') || albumData.coverArt,
        explicit: safeGet(item, 'itunes:explicit') === 'true',
        keywords: ensureArray(safeGet(item, 'itunes:keywords')),
        itemGuid: safeGet(item, 'guid', '')
      };
    });
    
    albumData.tracks = tracks;
    albumData.releaseDate = new Date().toISOString();
    
    // Extract publisher info
    const publisher = {
      name: safeGet(channel, 'itunes:owner.itunes:name') || feed.title,
      url: safeGet(channel, 'link', ''),
      feedUrl: feed.originalUrl
    };
    
    albumData.publisher = publisher;
    
    // Extract podroll if present
    const podrollItems = ensureArray(safeGet(channel, 'podcast:podroll.podcast:remoteItem'));
    if (podrollItems.length > 0) {
      albumData.podroll = podrollItems.map(item => ({
        feedGuid: safeGet(item, 'feedGuid', ''),
        feedUrl: safeGet(item, 'feedUrl', ''),
        title: safeGet(item, 'title', '')
      }));
    }
    
    // Extract funding if present
    const fundingItems = ensureArray(safeGet(channel, 'podcast:funding'));
    if (fundingItems.length > 0) {
      albumData.funding = fundingItems.map(item => ({
        url: safeGet(item, 'url', ''),
        title: safeGet(item, '_', '')
      }));
    }
    
    console.log(`   ✅ Parsed: ${tracks.length} tracks found`);
    return albumData;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// Main function
async function parseAllNonHghFeeds() {
  let successCount = 0;
  let failCount = 0;
  let updatedCount = 0;
  let addedCount = 0;
  
  for (const feed of nonHghFeeds) {
    const albumData = await parseFeed(feed);
    
    if (albumData) {
      // Find existing feed in parsed data
      let existingFeedIndex = parsedFeedsData.feeds.findIndex(f => 
        f.id === feed.id || f.originalUrl === feed.originalUrl
      );
      
      const parsedFeed = {
        id: feed.id,
        originalUrl: feed.originalUrl,
        lastParsed: new Date().toISOString(),
        parseStatus: 'success',
        parsedData: {
          album: albumData
        }
      };
      
      if (existingFeedIndex >= 0) {
        // Update existing
        parsedFeedsData.feeds[existingFeedIndex] = parsedFeed;
        updatedCount++;
      } else {
        // Add new
        parsedFeedsData.feeds.push(parsedFeed);
        addedCount++;
      }
      
      successCount++;
    } else {
      failCount++;
      
      // Mark as failed in parsed data
      let existingFeedIndex = parsedFeedsData.feeds.findIndex(f => 
        f.id === feed.id || f.originalUrl === feed.originalUrl
      );
      
      if (existingFeedIndex >= 0) {
        parsedFeedsData.feeds[existingFeedIndex].parseStatus = 'failed';
        parsedFeedsData.feeds[existingFeedIndex].lastParsed = new Date().toISOString();
      }
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save updated data
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  
  console.log('\n✅ Parse complete!');
  console.log(`   • Successful: ${successCount}/${nonHghFeeds.length}`);
  console.log(`   • Failed: ${failCount}`);
  console.log(`   • Updated: ${updatedCount}`);
  console.log(`   • Added: ${addedCount}`);
  console.log(`   • Total feeds: ${parsedFeedsData.feeds.length}`);
  console.log('\n💾 Updated parsed-feeds.json');
}

// Run the parser
parseAllNonHghFeeds().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});