#!/usr/bin/env node

/**
 * Advanced HGH Deduplication
 * 
 * This script does more sophisticated deduplication by checking if HGH single 
 * track titles exist in original albums, even if the artist names don't match exactly.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Advanced deduplication of HGH singles...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
}

// Helper function to normalize text for comparison
function normalize(text) {
  if (!text) return '';
  return text.toLowerCase().trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

// Separate HGH singles from original albums
const hghSingles = parsedFeeds.feeds.filter(feed => 
  feed.id && feed.id.startsWith('hgh-single-')
);

const originalAlbums = parsedFeeds.feeds.filter(feed => 
  !feed.id || !feed.id.startsWith('hgh-')
);

console.log(`📊 Found ${originalAlbums.length} original albums`);
console.log(`🎵 Found ${hghSingles.length} HGH singles`);

// Create a map of all track titles in original albums (just by track title, ignoring artist)
const originalTrackTitles = new Map();

originalAlbums.forEach(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks) {
    const album = feed.parsedData.album;
    
    album.tracks.forEach(track => {
      const normalizedTitle = normalize(track.title);
      
      if (normalizedTitle && !originalTrackTitles.has(normalizedTitle)) {
        originalTrackTitles.set(normalizedTitle, {
          albumTitle: album.title,
          albumArtist: album.artist,
          feedId: feed.id,
          trackTitle: track.title,
          originalTitle: normalizedTitle
        });
      }
    });
  }
});

console.log(`📊 Found ${originalTrackTitles.size} unique track titles in original albums`);

// Check which HGH singles have track titles that match original album tracks
const duplicateSingles = [];
const uniqueSingles = [];

hghSingles.forEach(single => {
  if (single.parseStatus === 'success' && single.parsedData?.album?.tracks?.[0]) {
    const singleTrack = single.parsedData.album.tracks[0];
    const singleArtist = single.parsedData.album.artist;
    const normalizedSingleTitle = normalize(singleTrack.title);
    
    if (originalTrackTitles.has(normalizedSingleTitle)) {
      const originalLocation = originalTrackTitles.get(normalizedSingleTitle);
      duplicateSingles.push({
        single,
        singleTitle: singleTrack.title,
        singleArtist: singleArtist,
        originalAlbum: originalLocation.albumTitle,
        originalArtist: originalLocation.albumArtist,
        normalizedTitle: normalizedSingleTitle
      });
    } else {
      uniqueSingles.push(single);
    }
  }
});

console.log(`\n🔍 Advanced Analysis Results:`);
console.log(`  ✅ Unique HGH singles: ${uniqueSingles.length}`);
console.log(`  🔄 Duplicate singles (track titles found in albums): ${duplicateSingles.length}`);

if (duplicateSingles.length === 0) {
  console.log('\n✅ No more duplicate singles found! All HGH singles are unique.');
  process.exit(0);
}

// Show examples of duplicates found
console.log(`\n📋 Duplicate singles to be removed:`);
duplicateSingles.forEach((dup, index) => {
  console.log(`${index + 1}. "${dup.singleTitle}" by ${dup.singleArtist}`);
  console.log(`   Found in: "${dup.originalAlbum}" by ${dup.originalArtist}`);
});

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Remove duplicate singles and keep only unique ones + original albums
const cleanedFeeds = [...originalAlbums, ...uniqueSingles];

console.log(`\n🧹 Removing ${duplicateSingles.length} duplicate singles...`);
console.log(`📊 Database will go from ${parsedFeeds.feeds.length} -> ${cleanedFeeds.length} feeds`);

// Update the feeds array
parsedFeeds.feeds = cleanedFeeds;

// Write updated database
console.log('\n💾 Writing cleaned database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Successfully removed ${duplicateSingles.length} more duplicate singles!`);
console.log(`📊 Final count: ${parsedFeeds.feeds.length} album feeds`);
console.log(`  - ${originalAlbums.length} original albums`);
console.log(`  - ${uniqueSingles.length} unique HGH singles`);
console.log(`\n🎉 Advanced deduplication complete! No track should appear both as single and in album.`);