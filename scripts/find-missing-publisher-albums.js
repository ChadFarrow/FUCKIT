#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load existing music tracks
function loadExistingTracks() {
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  if (!fs.existsSync(dbPath)) {
    return [];
  }
  
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  return data.musicTracks || [];
}

// Load publisher feeds data
function loadPublisherFeeds() {
  const feedsPath = path.join(__dirname, '../data/publisher-feed-results.json');
  if (!fs.existsSync(feedsPath)) {
    return [];
  }
  
  return JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
}

// Extract publisher GUID from URL
function extractPublisherGuid(url) {
  const match = url.match(/\/artist\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// Analyze missing albums for each publisher
function analyzeMissingAlbums() {
  console.log('🔍 Analyzing missing publisher albums...\n');
  
  const existingTracks = loadExistingTracks();
  const publisherFeeds = loadPublisherFeeds();
  
  // Group existing tracks by publisher (based on exact artist match)
  const tracksByPublisher = new Map();
  
  existingTracks.forEach(track => {
    const artist = track.feedArtist || track.artist || '';
    if (!tracksByPublisher.has(artist)) {
      tracksByPublisher.set(artist, new Set());
    }
    tracksByPublisher.get(artist).add(track.feedGuid || track.feedUrl);
  });
  
  // Analyze each publisher
  const missingAlbumData = [];
  
  publisherFeeds.forEach(publisherFeed => {
    const publisherName = publisherFeed.title?.replace('<![CDATA[', '').replace(']]>', '') || '';
    const expectedCount = publisherFeed.remoteItemCount || 0;
    const publisherGuid = extractPublisherGuid(publisherFeed.feed.originalUrl);
    
    if (!publisherGuid) {
      console.log(`⚠️  Could not extract GUID from ${publisherFeed.feed.originalUrl}`);
      return;
    }
    
    // Count actual albums in our database for this publisher
    const actualAlbums = tracksByPublisher.get(publisherName) || new Set();
    const actualCount = actualAlbums.size;
    
    const missing = expectedCount - actualCount;
    
    if (missing > 0) {
      const publisherInfo = {
        name: publisherName,
        publisherGuid: publisherGuid,
        feedUrl: publisherFeed.feed.originalUrl,
        expectedCount: expectedCount,
        actualCount: actualCount,
        missingCount: missing,
        priority: missing * (expectedCount > 10 ? 2 : 1) // Higher priority for publishers with many albums
      };
      
      missingAlbumData.push(publisherInfo);
      
      console.log(`📊 ${publisherName}`);
      console.log(`   Expected: ${expectedCount} albums`);
      console.log(`   Actual: ${actualCount} albums`);
      console.log(`   Missing: ${missing} albums`);
      console.log(`   Priority: ${publisherInfo.priority}`);
      console.log(`   GUID: ${publisherGuid}`);
      console.log('');
    } else if (actualCount > 0) {
      console.log(`✅ ${publisherName}: Complete (${actualCount}/${expectedCount} albums)`);
    }
  });
  
  // Sort by priority (missing count * album factor)
  missingAlbumData.sort((a, b) => b.priority - a.priority);
  
  console.log('\n🎯 Top Priority Publishers with Missing Albums:');
  console.log('================================================');
  
  missingAlbumData.slice(0, 10).forEach((publisher, index) => {
    console.log(`${index + 1}. ${publisher.name}`);
    console.log(`   Missing: ${publisher.missingCount}/${publisher.expectedCount} albums`);
    console.log(`   Priority Score: ${publisher.priority}`);
    console.log(`   Feed: ${publisher.feedUrl}`);
    console.log('');
  });
  
  // Save analysis results
  const outputPath = path.join(__dirname, '../data/missing-publishers-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    analysisDate: new Date().toISOString(),
    totalPublishers: publisherFeeds.length,
    publishersWithMissingAlbums: missingAlbumData.length,
    totalMissingAlbums: missingAlbumData.reduce((sum, p) => sum + p.missingCount, 0),
    publishers: missingAlbumData
  }, null, 2));
  
  console.log(`💾 Analysis saved to: ${outputPath}`);
  console.log(`\n📈 Summary:`);
  console.log(`   Total Publishers: ${publisherFeeds.length}`);
  console.log(`   Publishers with Missing Albums: ${missingAlbumData.length}`);
  console.log(`   Total Missing Albums: ${missingAlbumData.reduce((sum, p) => sum + p.missingCount, 0)}`);
  
  return missingAlbumData;
}

// Run the analysis
if (require.main === module) {
  analyzeMissingAlbums();
}

module.exports = { analyzeMissingAlbums };