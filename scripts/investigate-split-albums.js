#!/usr/bin/env node

/**
 * Investigate specific split albums to understand the pattern
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Investigating split albums in detail...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Look at Ollie's singles specifically
const ollieSingles = parsedFeeds.feeds.filter(feed => 
  feed.parseStatus === 'success' && 
  feed.parsedData?.album?.artist?.toLowerCase().includes('ollie')
);

console.log(`\n📊 Ollie singles analysis (${ollieSingles.length} found):`);
ollieSingles.forEach((feed, index) => {
  const album = feed.parsedData.album;
  console.log(`${index + 1}. "${album.title}" - track: "${album.tracks[0]?.title}"`);
  console.log(`   Artist: ${album.artist}`);
  console.log(`   Feed ID: ${feed.id}`);
  console.log(`   Track count: ${album.tracks.length}`);
  if (feed.feedUrl) {
    console.log(`   Feed URL: ${feed.feedUrl}`);
  }
  console.log('');
});

// Check if these should be consolidated into actual albums
console.log('🎵 Looking for patterns that suggest these were originally albums...');

// Group by common patterns
const patterns = new Map();

ollieSingles.forEach(feed => {
  const album = feed.parsedData.album;
  
  // Check if feed URL or ID suggests they're from the same source
  let pattern = 'unknown';
  if (feed.feedUrl) {
    // Extract domain/path pattern
    try {
      const url = new URL(feed.feedUrl);
      pattern = `${url.hostname}${url.pathname.split('/').slice(0, -1).join('/')}`;
    } catch (e) {
      pattern = feed.feedUrl.split('/').slice(0, -1).join('/');
    }
  } else if (feed.id && feed.id.startsWith('hgh-single-')) {
    pattern = 'hgh-singles';
  }
  
  if (!patterns.has(pattern)) {
    patterns.set(pattern, []);
  }
  
  patterns.get(pattern).push({
    feed,
    title: album.title,
    track: album.tracks[0]?.title
  });
});

console.log('📋 Patterns found:');
patterns.forEach((items, pattern) => {
  console.log(`\n${pattern}: ${items.length} singles`);
  items.slice(0, 5).forEach(item => {
    console.log(`  - "${item.title}" - "${item.track}"`);
  });
  if (items.length > 5) {
    console.log(`  ... and ${items.length - 5} more`);
  }
});

console.log('\n' + '='.repeat(60));

// Also check Nate Johnivan
const nateJohnivan = parsedFeeds.feeds.filter(feed => 
  feed.parseStatus === 'success' && 
  feed.parsedData?.album?.artist?.toLowerCase().includes('nate johnivan')
);

console.log(`\n📊 Nate Johnivan analysis (${nateJohnivan.length} found):`);
nateJohnivan.slice(0, 5).forEach((feed, index) => {
  const album = feed.parsedData.album;
  console.log(`${index + 1}. "${album.title}" - "${album.tracks[0]?.title}"`);
  console.log(`   Feed ID: ${feed.id}`);
  if (feed.feedUrl && feed.feedUrl.includes('wavlake')) {
    console.log(`   Wavlake album - might be legitimately separate releases`);
  }
  console.log('');
});

console.log('\n💡 Analysis complete. This helps determine if consolidation is needed.');