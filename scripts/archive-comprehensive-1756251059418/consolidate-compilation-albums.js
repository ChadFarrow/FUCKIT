#!/usr/bin/env node

/**
 * Consolidate Compilation Albums
 * 
 * This script identifies compilation albums like "Autumn Rust" and "The Satellite Skirmish"
 * that were split into individual singles and consolidates them back into proper albums.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Consolidating compilation albums...');

let parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));

// Known compilation albums that should be consolidated
const compilationAlbums = [
  'Autumn Rust',
  'The Satellite Skirmish'
];

console.log(`Looking for singles from compilation albums: ${compilationAlbums.join(', ')}`);

const albumsToConsolidate = new Map();

// Find singles from these compilation albums
parsedFeeds.feeds.forEach(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.tracks?.length === 1) {
    const album = feed.parsedData.album;
    
    // Check if this single is from a compilation album
    compilationAlbums.forEach(compilationName => {
      if (album.artist === compilationName) {
        if (!albumsToConsolidate.has(compilationName)) {
          albumsToConsolidate.set(compilationName, []);
        }
        albumsToConsolidate.get(compilationName).push(feed);
      }
    });
  }
});

console.log(`\nFound compilation album singles:`);
albumsToConsolidate.forEach((singles, albumName) => {
  console.log(`- ${albumName}: ${singles.length} singles`);
  singles.forEach((feed, i) => {
    const track = feed.parsedData.album.tracks[0];
    console.log(`  ${i + 1}. "${track.title}"`);
  });
});

if (albumsToConsolidate.size === 0) {
  console.log('✅ No compilation albums found to consolidate');
  process.exit(0);
}

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-compilation-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`\n💾 Created backup at: ${backupPath}`);

// Consolidate each compilation album
const feedsToRemove = [];
let newAlbumsCreated = 0;

albumsToConsolidate.forEach((singles, albumName) => {
  console.log(`\n🔧 Consolidating "${albumName}"...`);
  
  // Create new consolidated album using the first single as base
  const baseFeed = singles[0];
  const consolidatedAlbum = {
    ...baseFeed.parsedData.album,
    title: albumName, // Set album title to the compilation name
    artist: 'Various Artists', // Compilation albums are typically "Various Artists"
    tracks: []
  };
  
  // Add all tracks from the singles
  singles.forEach((feed, i) => {
    const originalTrack = feed.parsedData.album.tracks[0];
    const originalArtist = feed.parsedData.album.artist;
    
    // Extract the actual track info from the title
    // Format is usually "Album - Track Title" 
    let trackTitle = originalTrack.title;
    let trackArtist = originalArtist;
    
    // Try to extract artist from track title if it contains " - "
    if (trackTitle.includes(' - ')) {
      const parts = trackTitle.split(' - ');
      if (parts.length >= 2) {
        // Format might be "Album - Track" or "Artist - Track"
        // Keep the full title but note the artist
        trackTitle = originalTrack.title;
        // The artist should remain as the compilation album name for now
        trackArtist = originalArtist;
      }
    }
    
    consolidatedAlbum.tracks.push({
      ...originalTrack,
      title: trackTitle,
      // Keep original track metadata
    });
    
    console.log(`  Added: "${trackTitle}"`);
    
    // Mark this single for removal (except the first one which we'll modify)
    if (i > 0) {
      feedsToRemove.push(feed.id);
    }
  });
  
  // Update the base feed to be the consolidated album
  baseFeed.parsedData.album = consolidatedAlbum;
  baseFeed.title = albumName;
  
  console.log(`  ✅ Created "${albumName}" with ${consolidatedAlbum.tracks.length} tracks`);
  newAlbumsCreated++;
});

// Remove the individual singles (keeping the consolidated ones)
const originalCount = parsedFeeds.feeds.length;
parsedFeeds.feeds = parsedFeeds.feeds.filter(feed => !feedsToRemove.includes(feed.id));

console.log(`\n📊 Consolidated ${newAlbumsCreated} compilation albums`);
console.log(`📊 Removed ${feedsToRemove.length} individual singles`);
console.log(`📊 Database: ${originalCount} → ${parsedFeeds.feeds.length} feeds`);

// Write updated database
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));
console.log('\n💾 Database updated successfully!');

// Verify results
console.log('\n🔍 Verification - checking consolidated albums:');
compilationAlbums.forEach(albumName => {
  const found = parsedFeeds.feeds.filter(feed => 
    feed.parseStatus === 'success' && 
    feed.parsedData?.album?.title === albumName
  );
  
  if (found.length > 0) {
    const album = found[0].parsedData.album;
    console.log(`✅ "${albumName}": ${album.tracks.length} tracks`);
  } else {
    console.log(`❌ "${albumName}": not found`);
  }
});

console.log('\n🎉 Compilation album consolidation complete!');