#!/usr/bin/env node

/**
 * Consolidate Autumn Rust singles from the same album
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Consolidating Autumn Rust singles from the same album...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Find Autumn Rust singles
const autumnRustSingles = parsedFeeds.feeds.filter(feed => 
  feed.parseStatus === 'success' && 
  feed.parsedData?.album?.artist?.toLowerCase().includes('autumn rust') &&
  feed.parsedData?.album?.tracks?.length === 1
);

console.log(`Found ${autumnRustSingles.length} Autumn Rust singles:`);
autumnRustSingles.forEach((feed, i) => {
  const album = feed.parsedData.album;
  console.log(`${i + 1}. "${album.title}" - "${album.tracks[0].title}"`);
});

// Group by album title
const albumGroups = new Map();

autumnRustSingles.forEach(feed => {
  const album = feed.parsedData.album;
  const albumTitle = album.title.trim();
  
  if (!albumGroups.has(albumTitle)) {
    albumGroups.set(albumTitle, []);
  }
  
  albumGroups.get(albumTitle).push(feed);
});

console.log(`\nGrouped into ${albumGroups.size} albums:`);

const albumsToConsolidate = [];
albumGroups.forEach((singles, albumTitle) => {
  console.log(`- "${albumTitle}": ${singles.length} singles`);
  if (singles.length > 1) {
    albumsToConsolidate.push({ albumTitle, singles });
  }
});

if (albumsToConsolidate.length === 0) {
  console.log('✅ No Autumn Rust albums need consolidation');
  process.exit(0);
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-autumn-rust-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Consolidate albums
console.log(`\n🔧 Consolidating ${albumsToConsolidate.length} albums...`);

const feedsToRemove = [];

albumsToConsolidate.forEach(({ albumTitle, singles }) => {
  console.log(`\nConsolidating "${albumTitle}":`);
  
  // Use the first single as the base album
  const baseAlbum = singles[0].parsedData.album;
  const baseFeed = singles[0];
  
  console.log(`  Base: "${baseAlbum.tracks[0].title}"`);
  
  // Add tracks from other singles
  for (let i = 1; i < singles.length; i++) {
    const additionalTrack = singles[i].parsedData.album.tracks[0];
    baseAlbum.tracks.push(additionalTrack);
    feedsToRemove.push(singles[i].id);
    console.log(`  Adding: "${additionalTrack.title}"`);
  }
  
  console.log(`  Result: ${baseAlbum.tracks.length} tracks in "${albumTitle}"`);
});

// Remove the consolidated feeds
const originalCount = parsedFeeds.feeds.length;
parsedFeeds.feeds = parsedFeeds.feeds.filter(feed => !feedsToRemove.includes(feed.id));

console.log(`\n📊 Reduced from ${originalCount} to ${parsedFeeds.feeds.length} feeds`);

// Write updated database
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log('✅ Autumn Rust consolidation complete!');

// Verify results
const remainingAutumnRust = parsedFeeds.feeds.filter(feed => 
  feed.parseStatus === 'success' && 
  feed.parsedData?.album?.artist?.toLowerCase().includes('autumn rust')
);

console.log(`\n📋 Final Autumn Rust entries (${remainingAutumnRust.length}):`);
remainingAutumnRust.forEach((feed, i) => {
  const album = feed.parsedData.album;
  console.log(`${i + 1}. "${album.title}" by ${album.artist} - ${album.tracks.length} tracks`);
});