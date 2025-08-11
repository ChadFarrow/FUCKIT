#!/usr/bin/env node

/**
 * Fix HGH Album Duplicates
 * 
 * This script fixes albums that have duplicate tracks by deduplicating
 * tracks within each HGH album (albums with feedId starting with 'hgh-').
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔧 Fixing HGH album duplicate tracks...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`💾 Created backup at: ${backupPath}`);

// Find and fix HGH albums with duplicate tracks
let fixedAlbums = 0;
let totalDuplicatesRemoved = 0;

parsedFeeds.feeds.forEach(feed => {
  // Only process HGH albums
  if (!feed.id || !feed.id.startsWith('hgh-')) {
    return;
  }

  if (feed.parseStatus !== 'success' || !feed.parsedData?.album?.tracks) {
    return;
  }

  const album = feed.parsedData.album;
  const originalTrackCount = album.tracks.length;

  // Deduplicate tracks by title (case-insensitive)
  const seenTracks = new Map();
  const uniqueTracks = [];

  album.tracks.forEach((track, index) => {
    const trackKey = track.title.toLowerCase().trim();
    
    if (!seenTracks.has(trackKey)) {
      // Keep the first occurrence, but assign proper track numbers
      seenTracks.set(trackKey, true);
      uniqueTracks.push({
        ...track,
        trackNumber: uniqueTracks.length + 1 // Renumber tracks sequentially
      });
    }
  });

  if (uniqueTracks.length < originalTrackCount) {
    const duplicatesRemoved = originalTrackCount - uniqueTracks.length;
    console.log(`🎵 Fixed "${album.title}" by ${album.artist}: ${originalTrackCount} -> ${uniqueTracks.length} tracks (${duplicatesRemoved} duplicates removed)`);
    
    // Update the album with deduplicated tracks
    album.tracks = uniqueTracks;
    fixedAlbums++;
    totalDuplicatesRemoved += duplicatesRemoved;
  }
});

if (fixedAlbums === 0) {
  console.log('✅ No duplicate tracks found in HGH albums!');
  process.exit(0);
}

// Write updated database
console.log('\n💾 Writing updated database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Successfully fixed ${fixedAlbums} HGH albums!`);
console.log(`🧹 Removed ${totalDuplicatesRemoved} duplicate tracks total`);
console.log(`📊 Database updated: ${parsedFeeds.feeds.length} album feeds`);
console.log('\n🎉 HGH album duplicates fixed!');