#!/usr/bin/env node

/**
 * Smart Deduplication
 * 
 * This script removes only exact duplicates and obvious variants like "- Single",
 * but preserves legitimate variations like "(reprise)", "(remix)", etc.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Smart deduplication - preserving track variations...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
}

// Helper function to normalize only for obvious duplicates
function normalizeForDuplicates(title) {
  if (!title) return '';
  return title.toLowerCase().trim()
    .replace(/\s*-\s*single\s*$/gi, '') // Remove "- Single" at end
    .replace(/\s*\(single\)\s*$/gi, '') // Remove "(Single)" at end
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

// Create map of tracks in multi-track albums (using exact titles + artist for matching)
const multiTrackAlbumTracks = new Map();

multiTrackAlbums.forEach(feed => {
  const album = feed.parsedData.album;
  album.tracks.forEach(track => {
    // Use exact title + artist for precise matching
    const trackKey = `${track.title}|${album.artist}`.toLowerCase().trim();
    // Also check normalized version for "- Single" variants
    const normalizedKey = `${normalizeForDuplicates(track.title)}|${album.artist.toLowerCase().trim()}`;
    
    if (!multiTrackAlbumTracks.has(trackKey)) {
      multiTrackAlbumTracks.set(trackKey, {
        albumTitle: album.title,
        albumArtist: album.artist,
        trackTitle: track.title,
        feedId: feed.id,
        feedTitle: feed.title
      });
    }
    
    // Also store normalized version if different
    if (normalizedKey !== trackKey && !multiTrackAlbumTracks.has(normalizedKey)) {
      multiTrackAlbumTracks.set(normalizedKey, {
        albumTitle: album.title,
        albumArtist: album.artist,
        trackTitle: track.title,
        feedId: feed.id,
        feedTitle: feed.title
      });
    }
  });
});

console.log(`📊 Found ${multiTrackAlbumTracks.size} track variations in multi-track albums`);

// Find only obvious duplicates
const duplicateSingles = [];
const uniqueSingles = [];

singles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const singleAlbum = singleFeed.parsedData.album;
  
  // Check exact match first
  const exactKey = `${singleTrack.title}|${singleAlbum.artist}`.toLowerCase().trim();
  // Check normalized version (for "- Single" variants)
  const normalizedKey = `${normalizeForDuplicates(singleTrack.title)}|${singleAlbum.artist.toLowerCase().trim()}`;
  
  if (multiTrackAlbumTracks.has(exactKey)) {
    const match = multiTrackAlbumTracks.get(exactKey);
    duplicateSingles.push({
      single: singleFeed,
      singleTitle: singleTrack.title,
      singleArtist: singleAlbum.artist,
      matchType: 'exact',
      matchingTrack: match
    });
  } else if (multiTrackAlbumTracks.has(normalizedKey)) {
    const match = multiTrackAlbumTracks.get(normalizedKey);
    // Only remove if this is clearly a "- Single" variant
    if (singleTrack.title.toLowerCase().includes('single') || 
        singleTrack.title.toLowerCase().includes('- single')) {
      duplicateSingles.push({
        single: singleFeed,
        singleTitle: singleTrack.title,
        singleArtist: singleAlbum.artist,
        matchType: 'single-variant',
        matchingTrack: match
      });
    } else {
      uniqueSingles.push(singleFeed);
    }
  } else {
    uniqueSingles.push(singleFeed);
  }
});

// Check for duplicate singles with identical normalized titles (but keep different variations)
const finalDuplicates = [];
const seenTitles = new Map();

// First pass: identify what we have
uniqueSingles.forEach(singleFeed => {
  const singleTrack = singleFeed.parsedData.album.tracks[0];
  const singleAlbum = singleFeed.parsedData.album;
  const key = `${singleTrack.title}|${singleAlbum.artist}`.toLowerCase().trim();
  
  if (seenTitles.has(key)) {
    const existing = seenTitles.get(key);
    // Only mark as duplicate if titles are exactly the same (not variations)
    if (singleTrack.title.toLowerCase() === existing.track.title.toLowerCase() &&
        singleAlbum.artist.toLowerCase() === existing.album.artist.toLowerCase()) {
      finalDuplicates.push({
        duplicate: singleFeed,
        original: existing.feed,
        reason: 'identical-single'
      });
    }
  } else {
    seenTitles.set(key, {
      feed: singleFeed,
      track: singleTrack,
      album: singleAlbum
    });
  }
});

// Remove the identified duplicates
const finalUniqueSingles = uniqueSingles.filter(single => {
  return !finalDuplicates.some(dup => dup.duplicate.id === single.id);
});

console.log(`\n🔍 Smart Deduplication Results:`);
console.log(`  ✅ Unique singles: ${finalUniqueSingles.length}`);
console.log(`  🔄 Singles matching album tracks: ${duplicateSingles.length}`);
console.log(`  🔄 Identical duplicate singles: ${finalDuplicates.length}`);
console.log(`  📊 Multi-track albums: ${multiTrackAlbums.length}`);

const totalToRemove = duplicateSingles.length + finalDuplicates.length;

if (totalToRemove === 0) {
  console.log('\n✅ No obvious duplicates found! Preserving all track variations.');
  process.exit(0);
}

// Show what will be removed
if (duplicateSingles.length > 0) {
  console.log(`\n📋 Singles to remove (found in albums):`);
  duplicateSingles.forEach((dup, index) => {
    console.log(`${index + 1}. "${dup.singleTitle}" by ${dup.singleArtist} [${dup.matchType}]`);
    console.log(`   Found in: "${dup.matchingTrack.albumTitle}" by ${dup.matchingTrack.albumArtist}`);
  });
}

if (finalDuplicates.length > 0) {
  console.log(`\n📋 Identical singles to remove:`);
  finalDuplicates.forEach((dup, index) => {
    console.log(`${index + 1}. "${dup.duplicate.parsedData.album.tracks[0].title}" by ${dup.duplicate.parsedData.album.artist}`);
  });
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-smart-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Create final cleaned database
const cleanedFeeds = [...multiTrackAlbums, ...finalUniqueSingles];

console.log(`\n🧹 Removing ${totalToRemove} obvious duplicates...`);
console.log(`📊 Database will go from ${parsedFeeds.feeds.length} -> ${cleanedFeeds.length} feeds`);

// Update the feeds array
parsedFeeds.feeds = cleanedFeeds;

// Write final database
console.log('\n💾 Writing smartly cleaned database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Smart deduplication complete!`);
console.log(`📊 Final count: ${parsedFeeds.feeds.length} album feeds`);
console.log(`  - ${multiTrackAlbums.length} multi-track albums`);
console.log(`  - ${finalUniqueSingles.length} unique singles (preserving variations like "reprise")`);
console.log(`\n🎉 Track variations like "(reprise)" have been preserved!`);