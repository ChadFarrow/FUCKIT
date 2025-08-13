#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseStringPromise } = require('xml2js');

// Paths
const DATABASE_PATH = path.join(__dirname, '../data/music-tracks.json');
const FEEDS_PATH = path.join(__dirname, '../data/feeds.json');
const PARSED_FEEDS_PATH = path.join(__dirname, '../data/parsed-feeds.json');

// Backup current database with timestamp
function backupDatabase() {
  if (fs.existsSync(DATABASE_PATH)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, '../data', `music-tracks-backup-rebuild-${timestamp}.json`);
    fs.copyFileSync(DATABASE_PATH, backupPath);
    console.log(`✅ Database backed up to: ${backupPath}`);
    return backupPath;
  }
  return null;
}

// Create empty database structure
function createEmptyDatabase() {
  return {
    musicTracks: [],
    episodes: [],
    feeds: [],
    valueTimeSplits: [],
    valueRecipients: [],
    boostagrams: [],
    funding: [],
    extractions: [],
    analytics: [],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalTracks: 0,
      totalEpisodes: 0,
      totalFeeds: 0,
      totalExtractions: 0
    }
  };
}

// Parse a single feed
async function parseFeed(feedUrl) {
  try {
    console.log(`  📡 Fetching: ${feedUrl}`);
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    
    return {
      feedInfo: {
        title: podcast.title || 'Unknown Feed',
        description: podcast.description,
        author: podcast['itunes:author'] || podcast.author,
        link: podcast.link,
        image: podcast.image?.url || podcast['itunes:image']?.['$']?.href,
        guid: podcast.guid || feedUrl
      },
      tracks: items.map(item => ({
        guid: item.guid?._ || item.guid || `${feedUrl}#${item.title}`,
        title: item.title || 'Unknown Track',
        artist: item['itunes:author'] || podcast['itunes:author'] || 'Unknown Artist',
        album: podcast.title || 'Unknown Album',
        duration: item['itunes:duration'] || item.duration,
        enclosureUrl: item.enclosure?.['$']?.url || item.enclosure?.url,
        pubDate: item.pubDate,
        description: item.description || item['itunes:summary'],
        image: item['itunes:image']?.['$']?.href || item.image?.url || podcast.image?.url,
        feedUrl: feedUrl,
        parsedAt: new Date().toISOString()
      }))
    };
  } catch (error) {
    console.error(`  ❌ Failed to parse ${feedUrl}:`, error.message);
    return null;
  }
}

// Main rebuild function
async function rebuildDatabase() {
  console.log('🚀 Starting database rebuild from feeds...\n');
  
  // Step 1: Backup existing database
  const backupPath = backupDatabase();
  
  // Step 2: Load feed list
  const feedsData = JSON.parse(fs.readFileSync(FEEDS_PATH, 'utf-8'));
  const activeFeeds = feedsData.feeds.filter(f => f.status === 'active');
  console.log(`📋 Found ${activeFeeds.length} active feeds to parse\n`);
  
  // Step 3: Create new empty database
  const newDatabase = createEmptyDatabase();
  const parsedFeeds = [];
  
  // Step 4: Parse each feed
  for (const feed of activeFeeds) {
    console.log(`\n🎵 Processing: ${feed.title}`);
    const parsedData = await parseFeed(feed.originalUrl);
    
    if (parsedData) {
      // Add feed info
      newDatabase.feeds.push({
        id: feed.id,
        ...parsedData.feedInfo,
        originalUrl: feed.originalUrl,
        type: feed.type,
        priority: feed.priority,
        parsedAt: new Date().toISOString()
      });
      
      // Add tracks
      parsedData.tracks.forEach(track => {
        // Check for duplicate GUIDs
        if (!newDatabase.musicTracks.some(t => t.guid === track.guid)) {
          newDatabase.musicTracks.push({
            id: `track-${newDatabase.musicTracks.length + 1}`,
            ...track,
            addedAt: new Date().toISOString()
          });
        } else {
          console.log(`  ⚠️  Duplicate GUID skipped: ${track.guid}`);
        }
      });
      
      parsedFeeds.push({
        feedId: feed.id,
        feedUrl: feed.originalUrl,
        title: parsedData.feedInfo.title,
        trackCount: parsedData.tracks.length,
        parsedAt: new Date().toISOString(),
        success: true
      });
      
      console.log(`  ✅ Added ${parsedData.tracks.length} tracks`);
    } else {
      parsedFeeds.push({
        feedId: feed.id,
        feedUrl: feed.originalUrl,
        title: feed.title,
        trackCount: 0,
        parsedAt: new Date().toISOString(),
        success: false,
        error: 'Parse failed'
      });
    }
  }
  
  // Step 5: Update metadata
  newDatabase.metadata = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    totalTracks: newDatabase.musicTracks.length,
    totalEpisodes: newDatabase.episodes.length,
    totalFeeds: newDatabase.feeds.length,
    totalExtractions: 0,
    rebuildInfo: {
      rebuiltAt: new Date().toISOString(),
      feedsParsed: activeFeeds.length,
      feedsSuccessful: parsedFeeds.filter(f => f.success).length,
      feedsFailed: parsedFeeds.filter(f => !f.success).length,
      backupPath: backupPath
    }
  };
  
  // Step 6: Save new database
  fs.writeFileSync(DATABASE_PATH, JSON.stringify(newDatabase, null, 2));
  console.log(`\n💾 Database saved to: ${DATABASE_PATH}`);
  
  // Step 7: Save parsed feeds report
  fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));
  console.log(`📊 Parse report saved to: ${PARSED_FEEDS_PATH}`);
  
  // Step 8: Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 DATABASE REBUILD COMPLETE!');
  console.log('='.repeat(50));
  console.log(`📈 Total tracks: ${newDatabase.musicTracks.length}`);
  console.log(`📁 Total feeds: ${newDatabase.feeds.length}`);
  console.log(`✅ Successful feeds: ${parsedFeeds.filter(f => f.success).length}`);
  console.log(`❌ Failed feeds: ${parsedFeeds.filter(f => !f.success).length}`);
  console.log(`💾 Backup saved at: ${backupPath}`);
  console.log('='.repeat(50));
  
  // List any failed feeds
  const failedFeeds = parsedFeeds.filter(f => !f.success);
  if (failedFeeds.length > 0) {
    console.log('\n⚠️  Failed feeds:');
    failedFeeds.forEach(f => {
      console.log(`  - ${f.title || f.feedId}: ${f.feedUrl}`);
    });
  }
}

// Run the rebuild
rebuildDatabase().catch(error => {
  console.error('\n❌ REBUILD FAILED:', error);
  process.exit(1);
});