#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseStringPromise } = require('xml2js');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Generate auth headers for Podcast Index API
function generateAuthHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = 'sha1';
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = API_KEY + API_SECRET + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest('hex');

  return {
    'X-Auth-Date': apiHeaderTime.toString(),
    'X-Auth-Key': API_KEY,
    'Authorization': hash4Header,
    'User-Agent': 'FUCKIT-Music-App/1.0'
  };
}

// Resolve remoteItem via Podcast Index API
async function resolveRemoteItem(feedGuid, itemGuid) {
  try {
    console.log('🔍 Resolving remote item...');
    console.log(`  Feed GUID: ${feedGuid}`);
    console.log(`  Item GUID: ${itemGuid}`);
    
    // First, get the feed info by GUID
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    const feedResponse = await fetch(feedUrl, {
      headers: generateAuthHeaders()
    });
    
    if (!feedResponse.ok) {
      throw new Error(`Feed API error: ${feedResponse.status}`);
    }
    
    const feedData = await feedResponse.json();
    console.log('Feed API Response:', JSON.stringify(feedData, null, 2));
    
    if (!feedData.feed) {
      throw new Error('Feed not found in Podcast Index');
    }
    
    const feed = feedData.feed;
    console.log(`\n✅ Found feed: ${feed.title}`);
    console.log(`  URL: ${feed.url}`);
    
    // Now get the specific episode/track by GUID
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}`;
    const episodeResponse = await fetch(episodeUrl, {
      headers: generateAuthHeaders()
    });
    
    if (!episodeResponse.ok) {
      console.log(`Episode API returned ${episodeResponse.status}, fetching feed directly...`);
      return await fetchAndFindItem(feed.url, itemGuid, feed);
    }
    
    const episodeData = await episodeResponse.json();
    
    if (!episodeData.episode) {
      // Try fetching the feed directly and finding the item
      console.log('\n📡 Item not in API, fetching feed directly...');
      return await fetchAndFindItem(feed.url, itemGuid, feed);
    }
    
    const episode = Array.isArray(episodeData.episode) ? episodeData.episode[0] : episodeData.episode;
    console.log(`\n✅ Found track: ${episode.title}`);
    
    return {
      // From API
      feedGuid: feedGuid,
      itemGuid: itemGuid,
      feedUrl: feed.url,
      feedTitle: feed.title,
      
      // Track data
      title: episode.title,
      artist: feed.author || 'Unknown Artist',
      album: feed.title,
      description: episode.description,
      duration: episode.duration,
      enclosureUrl: episode.enclosureUrl,
      enclosureType: episode.enclosureType,
      pubDate: new Date(episode.datePublished * 1000).toISOString(),
      image: episode.image || feed.image || feed.artwork,
      
      // Additional metadata
      explicit: episode.explicit,
      episode: episode.episode,
      season: episode.season,
      value: episode.value,
      
      // Source info
      resolvedFrom: 'podcast-index-api',
      resolvedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to resolve:', error.message);
    return null;
  }
}

// Fallback: Fetch feed directly and find item by GUID
async function fetchAndFindItem(feedUrl, itemGuid, feedInfo) {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xmlContent = await response.text();
    const result = await parseStringPromise(xmlContent, { 
      explicitArray: false,
      ignoreAttrs: false 
    });
    
    const podcast = result.rss?.channel || result.podcast;
    if (!podcast) {
      throw new Error('Invalid feed structure');
    }
    
    const items = Array.isArray(podcast.item) ? podcast.item : [podcast.item].filter(Boolean);
    
    // Find the item with matching GUID
    const targetItem = items.find(item => {
      const guid = item.guid?._ || item.guid;
      return guid === itemGuid;
    });
    
    if (!targetItem) {
      throw new Error(`Item with GUID ${itemGuid} not found in feed`);
    }
    
    console.log(`✅ Found track in feed: ${targetItem.title}`);
    
    return {
      // GUIDs
      feedGuid: feedInfo?.guid || feedUrl,
      itemGuid: itemGuid,
      feedUrl: feedUrl,
      feedTitle: feedInfo?.title || podcast.title,
      
      // Track data from feed
      title: targetItem.title || 'Unknown Track',
      artist: targetItem['itunes:author'] || podcast['itunes:author'] || feedInfo?.author || 'Unknown Artist',
      album: podcast.title || feedInfo?.title || 'Unknown Album',
      description: targetItem.description || targetItem['itunes:summary'],
      duration: targetItem['itunes:duration'] || targetItem.duration,
      enclosureUrl: targetItem.enclosure?.['$']?.url || targetItem.enclosure?.url,
      enclosureType: targetItem.enclosure?.['$']?.type || targetItem.enclosure?.type,
      pubDate: targetItem.pubDate,
      image: targetItem['itunes:image']?.['$']?.href || targetItem.image?.url || podcast.image?.url || feedInfo?.image,
      
      // Value block if present
      value: targetItem['podcast:value'],
      
      // Source info
      resolvedFrom: 'direct-feed-fetch',
      resolvedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch feed directly:', error.message);
    return null;
  }
}

// Save resolved data to database
async function saveToDatabase(trackData) {
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  
  try {
    // Load current database
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Check if track already exists by itemGuid
    const existingIndex = db.musicTracks.findIndex(t => t.itemGuid === trackData.itemGuid);
    
    if (existingIndex >= 0) {
      // Update existing
      db.musicTracks[existingIndex] = {
        ...db.musicTracks[existingIndex],
        ...trackData,
        updatedAt: new Date().toISOString()
      };
      console.log('📝 Updated existing track in database');
    } else {
      // Add new
      db.musicTracks.push({
        id: `track-${db.musicTracks.length + 1}`,
        ...trackData,
        addedAt: new Date().toISOString()
      });
      console.log('➕ Added new track to database');
    }
    
    // Update metadata
    db.metadata.totalTracks = db.musicTracks.length;
    db.metadata.lastUpdated = new Date().toISOString();
    
    // Save database
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('💾 Database saved');
    
  } catch (error) {
    console.error('❌ Failed to save to database:', error.message);
  }
}

// Main function
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node resolve-remote-item.js <feedGuid> <itemGuid>');
    console.log('Example: node resolve-remote-item.js 3ae285ab-434c-59d8-aa2f-59c6129afb92 d8145cb6-97d9-4358-895b-2bf055d169aa');
    process.exit(1);
  }
  
  const [feedGuid, itemGuid] = args;
  
  console.log('🚀 Starting remote item resolution...\n');
  
  const trackData = await resolveRemoteItem(feedGuid, itemGuid);
  
  if (trackData) {
    console.log('\n📊 Resolved track data:');
    console.log('================================');
    console.log(`Title: ${trackData.title}`);
    console.log(`Artist: ${trackData.artist}`);
    console.log(`Album: ${trackData.album}`);
    console.log(`Duration: ${trackData.duration}`);
    console.log(`Audio URL: ${trackData.enclosureUrl}`);
    console.log(`Image: ${trackData.image}`);
    console.log(`Pub Date: ${trackData.pubDate}`);
    console.log('================================\n');
    
    // Save to database
    await saveToDatabase(trackData);
    
    console.log('\n✅ Resolution complete!');
  } else {
    console.log('\n❌ Failed to resolve remote item');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { resolveRemoteItem, generateAuthHeaders };