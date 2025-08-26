#!/usr/bin/env node

/**
 * Final Deduplication Pass
 * 
 * This script catches remaining duplicates including:
 * - Track titles with variations like "(reprise)", "- Single", etc.
 * - Tracks that appear both as singles and in multi-track albums
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Final deduplication pass - catching remaining duplicates...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
}

// Helper function to normalize track titles for comparison
function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase().trim()
    .replace(/\s*\(reprise\)\s*/gi, '') // Remove (reprise)
    .replace(/\s*-\s*single\s*$/gi, '') // Remove "- Single" at end
    .replace(/\s*\(single\)\s*$/gi, '') // Remove "(Single)" at end
    .replace(/\s*\(remix\)\s*$/gi, '')  // Remove "(remix)" at end
    .replace(/\s*\(edit\)\s*$/gi, '')   // Remove "(edit)" at end
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
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

// Create a comprehensive map of all tracks in multi-track albums
const multiTrackAlbumTracks = new Map();

multiTrackAlbums.forEach(feed => {
  const album = feed.parsedData.album;
  album.tracks.forEach(track => {
    const normalizedTitle = normalizeTitle(track.title);
    if (normalizedTitle) {
      // Store all variations we find
      if (!multiTrackAlbumTracks.has(normalizedTitle)) {
        multiTrackAlbumTracks.set(normalizedTitle, []);
      }
      multiTrackAlbumTracks.get(normalizedTitle).push({
        albumTitle: album.title,
        albumArtist: album.artist,
        trackTitle: track.title,
        feedId: feed.id,
        feedTitle: feed.title
      });
    }
  });
});

console.log(`📊 Found ${multiTrackAlbumTracks.size} unique normalized track titles in multi-track albums`);

// Find singles that match tracks in multi-track albums
const duplicateSingles = [];
const uniqueSingles = [];

singles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const singleAlbum = singleFeed.parsedData.album;
  const normalizedSingleTitle = normalizeTitle(singleTrack.title);
  
  if (multiTrackAlbumTracks.has(normalizedSingleTitle)) {
    const matchingAlbumTracks = multiTrackAlbumTracks.get(normalizedSingleTitle);
    duplicateSingles.push({
      single: singleFeed,
      singleTitle: singleTrack.title,
      singleArtist: singleAlbum.artist,
      singleAlbumTitle: singleAlbum.title,
      normalizedTitle: normalizedSingleTitle,
      matchingTracks: matchingAlbumTracks
    });
  } else {
    uniqueSingles.push(singleFeed);
  }
});

// Also check for duplicate singles (singles with very similar titles)
const singleTitleMap = new Map();
const additionalDuplicates = [];

uniqueSingles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const normalizedTitle = normalizeTitle(singleTrack.title);
  
  if (singleTitleMap.has(normalizedTitle)) {
    // This is a duplicate single
    const existing = singleTitleMap.get(normalizedTitle);
    additionalDuplicates.push({
      duplicate: singleFeed,
      duplicateTitle: singleTrack.title,
      duplicateArtist: singleFeed.parsedData.album.artist,
      original: existing,
      originalTitle: existing.parsedData.album.tracks[0].title,
      originalArtist: existing.parsedData.album.artist,
      normalizedTitle: normalizedTitle
    });
  } else {
    singleTitleMap.set(normalizedTitle, singleFeed);
  }
});

// Remove additional duplicates from uniqueSingles
const finalUniqueSingles = uniqueSingles.filter(single => {
  return !additionalDuplicates.some(dup => dup.duplicate.id === single.id);
});

console.log(`\n🔍 Final Deduplication Results:`);
console.log(`  ✅ Unique singles: ${finalUniqueSingles.length}`);
console.log(`  🔄 Singles matching multi-track albums: ${duplicateSingles.length}`);
console.log(`  🔄 Duplicate singles: ${additionalDuplicates.length}`);
console.log(`  📊 Multi-track albums: ${multiTrackAlbums.length}`);

const totalToRemove = duplicateSingles.length + additionalDuplicates.length;

if (totalToRemove === 0) {
  console.log('\n✅ No more duplicates found! Database is fully deduplicated.');
  process.exit(0);
}

// Show examples of what will be removed
console.log(`\n📋 Singles to be removed (matching multi-track albums):`);
duplicateSingles.slice(0, 10).forEach((dup, index) => {
  console.log(`${index + 1}. "${dup.singleTitle}" by ${dup.singleArtist} (single: "${dup.singleAlbumTitle}")`);
  console.log(`   Found in album: "${dup.matchingTracks[0].albumTitle}" by ${dup.matchingTracks[0].albumArtist}`);
});

if (additionalDuplicates.length > 0) {
  console.log(`\n📋 Duplicate singles to be removed:`);
  additionalDuplicates.forEach((dup, index) => {
    console.log(`${index + 1}. "${dup.duplicateTitle}" by ${dup.duplicateArtist}`);
    console.log(`   Keeping: "${dup.originalTitle}" by ${dup.originalArtist}`);
  });
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Create final cleaned database
const cleanedFeeds = [...multiTrackAlbums, ...finalUniqueSingles];

console.log(`\n🧹 Removing ${totalToRemove} duplicate feeds...`);
console.log(`📊 Database will go from ${parsedFeeds.feeds.length} -> ${cleanedFeeds.length} feeds`);

// Update the feeds array
parsedFeeds.feeds = cleanedFeeds;

// Write final cleaned database
console.log('\n💾 Writing final cleaned database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Final deduplication complete!`);
console.log(`📊 Final count: ${parsedFeeds.feeds.length} album feeds`);
console.log(`  - ${multiTrackAlbums.length} multi-track albums`);
console.log(`  - ${finalUniqueSingles.length} unique singles`);
console.log(`\n🎉 Database is now fully deduplicated! No duplicates should remain.`);