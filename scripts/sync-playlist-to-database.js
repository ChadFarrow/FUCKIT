#!/usr/bin/env node

/**
 * Sync Playlist Items to Main Database
 * 
 * This script checks if HGH playlist items exist in the main database (parsed-feeds.json).
 * If they don't exist, it creates proper album entries for them and adds them to the database.
 * This ensures that everything shown on the home page has working detail pages.
 */

const fs = require('fs');
const path = require('path');

// Simple slug generator (copied from url-utils to avoid import issues)
function generateAlbumSlug(title) {
  if (!title || typeof title !== 'string') return 'unknown-album';
  
  return title
    .toLowerCase()
    .trim()
    // Remove special characters but preserve spaces
    .replace(/[^\w\s-]/g, '')
    // Replace spaces and multiple hyphens with single hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');
const HGH_RESOLVED_PATH = path.join(DATA_DIR, 'hgh-resolved-songs.json');

// Read existing data
console.log('📖 Reading existing data files...');

let parsedFeeds;
let hghTracks;

try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  hghTracks = JSON.parse(fs.readFileSync(HGH_RESOLVED_PATH, 'utf-8'));
  
  console.log(`✅ Found ${parsedFeeds.feeds.length} existing album feeds`);
  console.log(`✅ Found ${hghTracks.length} HGH playlist tracks`);
} catch (error) {
  console.error('❌ Error reading data files:', error.message);
  process.exit(1);
}

// Get existing album titles from the main database
const existingAlbums = new Set();
parsedFeeds.feeds.forEach(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album?.title) {
    const title = feed.parsedData.album.title.toLowerCase().trim();
    existingAlbums.add(title);
  }
});

console.log(`📊 Found ${existingAlbums.size} existing albums in database`);

// Group HGH tracks by album (feedTitle + artist combination)
const albumGroups = new Map();

hghTracks.forEach(track => {
  // Use feedTitle as the album name, or fall back to a generated name
  let albumTitle = track.feedTitle || `${track.artist} - Songs`;
  
  // Special case: if the track title and artist are the same, it's likely a single/EP
  if (track.title === track.artist) {
    albumTitle = track.title; // Use just the track title as album name
  }
  
  const albumKey = `${albumTitle}|${track.artist}`.toLowerCase().trim();
  
  if (!albumGroups.has(albumKey)) {
    albumGroups.set(albumKey, {
      title: albumTitle,
      artist: track.artist,
      tracks: [],
      feedUrl: track.feedUrl,
      feedGuid: track.feedGuid,
      feedTitle: track.feedTitle
    });
  }
  
  albumGroups.get(albumKey).tracks.push({
    title: track.title,
    duration: track.duration ? formatDuration(track.duration) : '0:00',
    url: '', // HGH tracks don't have direct URLs yet
    trackNumber: albumGroups.get(albumKey).tracks.length + 1,
    subtitle: '',
    summary: '',
    image: '', // Will need to be resolved
    explicit: false,
    keywords: [],
    itemGuid: track.itemGuid
  });
});

console.log(`🎵 Grouped HGH tracks into ${albumGroups.size} potential albums`);

// Check which albums are missing from the main database
const missingAlbums = [];
albumGroups.forEach((album, albumKey) => {
  const titleToCheck = album.title.toLowerCase().trim();
  if (!existingAlbums.has(titleToCheck)) {
    missingAlbums.push(album);
  }
});

console.log(`🔍 Found ${missingAlbums.length} albums missing from main database`);

if (missingAlbums.length === 0) {
  console.log('✅ All HGH playlist items are already in the database!');
  process.exit(0);
}

// Show what we're about to add
console.log('\\n📋 Albums to be added:');
missingAlbums.forEach((album, index) => {
  console.log(`${index + 1}. "${album.title}" by ${album.artist} (${album.tracks.length} tracks)`);
});

// Create new feed entries for missing albums
console.log('\\n🔨 Creating new feed entries...');

missingAlbums.forEach(album => {
  const albumId = generateAlbumSlug(album.title);
  const feedId = `hgh-${albumId}`;
  
  const newFeed = {
    id: feedId,
    originalUrl: album.feedUrl,
    lastParsed: new Date().toISOString(),
    parseStatus: 'success',
    parsedData: {
      album: {
        title: album.title,
        artist: album.artist,
        description: `${album.title} by ${album.artist}`,
        summary: '',
        subtitle: '',
        coverArt: '', // Will need to be resolved later
        releaseDate: new Date().toISOString(),
        explicit: false,
        tracks: album.tracks,
        podroll: null,
        publisher: {
          name: 'Home Grown Hits Playlist',
          url: 'https://podcastindex.org',
          feedUrl: album.feedUrl || ''
        },
        funding: null,
        feedGuid: album.feedGuid,
        feedTitle: album.feedTitle
      }
    }
  };
  
  parsedFeeds.feeds.push(newFeed);
});

// Create backup of original file
const backupPath = `${PARSED_FEEDS_PATH}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`💾 Created backup at: ${backupPath}`);

// Write updated database
console.log('💾 Writing updated database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`✅ Successfully added ${missingAlbums.length} albums to the database!`);
console.log(`📊 New total: ${parsedFeeds.feeds.length} album feeds`);

console.log('\\n🎉 Sync complete! All HGH playlist items now have album pages.');

/**
 * Helper function to format duration from seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}