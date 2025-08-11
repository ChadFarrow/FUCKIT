#!/usr/bin/env node

/**
 * Find singles that have the same album title and should be consolidated into albums
 * 
 * This identifies cases like "Polar Embrace" where multiple tracks from the same album
 * are showing as separate singles instead of being grouped together.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Finding singles with the same album title...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Get all singles
const singles = parsedFeeds.feeds.filter(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks) {
    return feed.parsedData.album.tracks.length === 1;
  }
  return false;
});

console.log(`📊 Analyzing ${singles.length} singles for duplicate album titles...`);

// Group by album title + artist
const albumGroups = new Map();

singles.forEach(singleFeed => {
  const album = singleFeed.parsedData.album;
  const key = `${album.title.trim()}|${album.artist.trim()}`.toLowerCase();
  
  if (!albumGroups.has(key)) {
    albumGroups.set(key, {
      title: album.title,
      artist: album.artist,
      singles: []
    });
  }
  
  albumGroups.get(key).singles.push({
    feed: singleFeed,
    track: album.tracks[0]
  });
});

// Find groups with multiple singles (same album title)
const duplicateAlbums = [];

albumGroups.forEach((group, key) => {
  if (group.singles.length > 1) {
    duplicateAlbums.push(group);
  }
});

// Sort by number of singles (most problematic first)
duplicateAlbums.sort((a, b) => b.singles.length - a.singles.length);

if (duplicateAlbums.length === 0) {
  console.log('✅ No singles with duplicate album titles found!');
} else {
  console.log(`\n📋 Found ${duplicateAlbums.length} albums split into separate singles:\n`);
  
  duplicateAlbums.forEach((album, index) => {
    console.log(`${index + 1}. "${album.title}" by ${album.artist} - ${album.singles.length} singles`);
    
    album.singles.forEach((single, i) => {
      console.log(`   ${i + 1}. "${single.track.title}"`);
    });
    
    console.log('');
  });
  
  // Calculate totals
  const totalSingles = duplicateAlbums.reduce((sum, album) => sum + album.singles.length, 0);
  const albumsToCreate = duplicateAlbums.length;
  
  console.log(`📊 Summary:`);
  console.log(`  - ${duplicateAlbums.length} albums split into singles`);
  console.log(`  - ${totalSingles} singles that should be consolidated`);
  console.log(`  - This would reduce singles by ${totalSingles - albumsToCreate} items`);
  
  console.log(`\n💡 These singles should be consolidated into proper albums with multiple tracks.`);
}

// Also show first few for manual verification
if (duplicateAlbums.length > 0) {
  console.log(`\n🔍 First few examples for verification:`);
  
  duplicateAlbums.slice(0, 3).forEach((album, index) => {
    console.log(`\n${index + 1}. "${album.title}" by ${album.artist}:`);
    console.log(`   Should become 1 album with ${album.singles.length} tracks:`);
    
    album.singles.forEach((single, i) => {
      console.log(`     Track ${i + 1}: "${single.track.title}"`);
      console.log(`       Feed ID: ${single.feed.id}`);
    });
  });
}