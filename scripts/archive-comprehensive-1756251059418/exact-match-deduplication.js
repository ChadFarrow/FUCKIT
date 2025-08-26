#!/usr/bin/env node

/**
 * Exact Match Deduplication
 * 
 * Only removes tracks with exactly the same title and artist.
 * Preserves variations like "(reprise)", "(remix)", "- Single", etc.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Exact match deduplication - only removing identical titles...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
}

// Separate singles from multi-track albums
const singles = parsedFeeds.feeds.filter(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks) {
    return feed.parsedData.album.tracks.length === 1;
  }
  return false;
});

const multiTrackAlbums = parsedFeeds.feeds.filter(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks) {
    return feed.parsedData.album.tracks.length > 1;
  }
  return false;
});

console.log(`📊 Found ${singles.length} singles and ${multiTrackAlbums.length} multi-track albums`);

// Create map of exact track titles in multi-track albums
const exactTrackMatches = new Set();

multiTrackAlbums.forEach(feed => {
  const album = feed.parsedData.album;
  album.tracks.forEach(track => {
    // Store exact title + artist combination (case-insensitive)
    const exactKey = `${track.title.trim()}|${album.artist.trim()}`.toLowerCase();
    exactTrackMatches.add(exactKey);
  });
});

console.log(`📊 Found ${exactTrackMatches.size} exact track+artist combinations in multi-track albums`);

// Find singles that are exact matches
const duplicateSingles = [];
const uniqueSingles = [];

singles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const singleAlbum = singleFeed.parsedData.album;
  
  // Create exact key for this single
  const exactKey = `${singleTrack.title.trim()}|${singleAlbum.artist.trim()}`.toLowerCase();
  
  if (exactTrackMatches.has(exactKey)) {
    duplicateSingles.push({
      single: singleFeed,
      title: singleTrack.title,
      artist: singleAlbum.artist,
      exactKey: exactKey
    });
  } else {
    uniqueSingles.push(singleFeed);
  }
});

// Check for duplicate singles (identical title+artist combinations)
const singleDuplicates = [];
const seenSingles = new Map();

uniqueSingles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const singleAlbum = singleFeed.parsedData.album;
  const exactKey = `${singleTrack.title.trim()}|${singleAlbum.artist.trim()}`.toLowerCase();
  
  if (seenSingles.has(exactKey)) {
    const existing = seenSingles.get(exactKey);
    singleDuplicates.push({
      duplicate: singleFeed,
      original: existing,
      title: singleTrack.title,
      artist: singleAlbum.artist
    });
  } else {
    seenSingles.set(exactKey, singleFeed);
  }
});

// Remove single duplicates from uniqueSingles
const finalUniqueSingles = uniqueSingles.filter(single => {
  return !singleDuplicates.some(dup => dup.duplicate.id === single.id);
});

console.log(`\n🔍 Exact Match Results:`);
console.log(`  ✅ Unique singles: ${finalUniqueSingles.length}`);
console.log(`  🔄 Singles exactly matching album tracks: ${duplicateSingles.length}`);
console.log(`  🔄 Duplicate identical singles: ${singleDuplicates.length}`);
console.log(`  📊 Multi-track albums: ${multiTrackAlbums.length}`);

const totalToRemove = duplicateSingles.length + singleDuplicates.length;

if (totalToRemove === 0) {
  console.log('\n✅ No exact duplicates found!');
  process.exit(0);
}

// Show what will be removed
if (duplicateSingles.length > 0) {
  console.log(`\n📋 Singles to remove (exact matches in albums):`);
  duplicateSingles.slice(0, 10).forEach((dup, index) => {
    console.log(`${index + 1}. "${dup.title}" by ${dup.artist}`);
  });
  if (duplicateSingles.length > 10) {
    console.log(`   ... and ${duplicateSingles.length - 10} more`);
  }
}

if (singleDuplicates.length > 0) {
  console.log(`\n📋 Duplicate singles to remove:`);
  singleDuplicates.forEach((dup, index) => {
    console.log(`${index + 1}. "${dup.title}" by ${dup.artist}`);
  });
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-exact-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Create final cleaned database
const cleanedFeeds = [...multiTrackAlbums, ...finalUniqueSingles];

console.log(`\n🧹 Removing ${totalToRemove} exact duplicates...`);
console.log(`📊 Database will go from ${parsedFeeds.feeds.length} -> ${cleanedFeeds.length} feeds`);

// Update the feeds array
parsedFeeds.feeds = cleanedFeeds;

// Write final database
console.log('\n💾 Writing database with exact duplicates removed...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Exact match deduplication complete!`);
console.log(`📊 Final count: ${parsedFeeds.feeds.length} album feeds`);
console.log(`  - ${multiTrackAlbums.length} multi-track albums`);
console.log(`  - ${finalUniqueSingles.length} unique singles`);
console.log(`\n🎉 Only exact duplicates removed. Variations like "(reprise)" are preserved!`);