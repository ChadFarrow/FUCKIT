#!/usr/bin/env node

/**
 * Remove Duplicate HGH Singles
 * 
 * This script checks if any HGH singles (tracks we added) are already
 * part of existing albums on the main page, and removes the duplicate singles.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Checking for HGH singles that are already in existing albums...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
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

// Create a map of all tracks in original albums (title + artist)
const originalTracks = new Map();

originalAlbums.forEach(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks) {
    const album = feed.parsedData.album;
    
    album.tracks.forEach(track => {
      const trackKey = `${track.title}|${album.artist}`.toLowerCase().trim();
      
      if (!originalTracks.has(trackKey)) {
        originalTracks.set(trackKey, {
          albumTitle: album.title,
          artist: album.artist,
          feedId: feed.id,
          trackTitle: track.title
        });
      }
    });
  }
});

console.log(`📊 Found ${originalTracks.size} tracks in original albums`);

// Check which HGH singles are duplicates
const duplicateSingles = [];
const uniqueSingles = [];

hghSingles.forEach(single => {
  if (single.parseStatus === 'success' && single.parsedData?.album?.tracks?.[0]) {
    const singleTrack = single.parsedData.album.tracks[0];
    const singleArtist = single.parsedData.album.artist;
    
    const trackKey = `${singleTrack.title}|${singleArtist}`.toLowerCase().trim();
    
    if (originalTracks.has(trackKey)) {
      const originalLocation = originalTracks.get(trackKey);
      duplicateSingles.push({
        single,
        singleTitle: singleTrack.title,
        singleArtist: singleArtist,
        originalAlbum: originalLocation.albumTitle,
        originalArtist: originalLocation.artist
      });
    } else {
      uniqueSingles.push(single);
    }
  }
});

console.log(`\n🔍 Analysis Results:`);
console.log(`  ✅ Unique HGH singles: ${uniqueSingles.length}`);
console.log(`  🔄 Duplicate singles (already in albums): ${duplicateSingles.length}`);

if (duplicateSingles.length === 0) {
  console.log('\n✅ No duplicate singles found! All HGH singles are unique.');
  process.exit(0);
}

// Show some examples of duplicates
console.log(`\n📋 Examples of duplicate singles to be removed:`);
duplicateSingles.slice(0, 10).forEach((dup, index) => {
  console.log(`${index + 1}. "${dup.singleTitle}" by ${dup.singleArtist}`);
  console.log(`   Already in: "${dup.originalAlbum}" by ${dup.originalArtist}`);
});

if (duplicateSingles.length > 10) {
  console.log(`   ... and ${duplicateSingles.length - 10} more`);
}

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

console.log(`\n✅ Successfully removed ${duplicateSingles.length} duplicate singles!`);
console.log(`📊 Final count: ${parsedFeeds.feeds.length} album feeds`);
console.log(`  - ${originalAlbums.length} original albums`);
console.log(`  - ${uniqueSingles.length} unique HGH singles`);
console.log(`\n🎉 Database cleaned! No more duplicate tracks between albums and singles.`);