#!/usr/bin/env node

/**
 * Fix HGH Tracks as Individual Singles
 * 
 * This script removes the fake HGH "albums" and replaces them with individual
 * single-track entries for each unique HGH track, treating them as singles.
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

console.log('🔧 Converting HGH tracks to individual singles...');

// Read existing data
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

// Create backup
const backupPath = `${PARSED_FEEDS_PATH}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`💾 Created backup at: ${backupPath}`);

// Remove all existing HGH albums (they were fake albums with duplicates)
console.log('\n🗑️ Removing existing HGH albums...');
const originalCount = parsedFeeds.feeds.length;
parsedFeeds.feeds = parsedFeeds.feeds.filter(feed => !feed.id || !feed.id.startsWith('hgh-'));
const removedCount = originalCount - parsedFeeds.feeds.length;
console.log(`🧹 Removed ${removedCount} HGH albums`);

// Create individual singles for each unique HGH track
console.log('\n🎵 Creating individual singles for unique HGH tracks...');

// Track unique songs by title + artist combination
const uniqueTracks = new Map();

hghTracks.forEach(track => {
  const trackKey = `${track.title}|${track.artist}`.toLowerCase().trim();
  
  if (!uniqueTracks.has(trackKey)) {
    uniqueTracks.set(trackKey, {
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      feedUrl: track.feedUrl,
      feedGuid: track.feedGuid,
      feedTitle: track.feedTitle,
      itemGuid: track.itemGuid
    });
  }
});

console.log(`📊 Found ${uniqueTracks.size} unique HGH tracks (from ${hghTracks.length} playlist entries)`);

// Create single-track albums for each unique track
let newSinglesCount = 0;

uniqueTracks.forEach((track, trackKey) => {
  const singleId = generateAlbumSlug(`${track.title} ${track.artist}`);
  const feedId = `hgh-single-${singleId}`;
  
  // Format duration
  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  const newSingle = {
    id: feedId,
    originalUrl: track.feedUrl,
    lastParsed: new Date().toISOString(),
    parseStatus: 'success',
    parsedData: {
      album: {
        title: track.title, // Use track title as album title for singles
        artist: track.artist,
        description: `${track.title} by ${track.artist}`,
        summary: '',
        subtitle: '',
        coverArt: '', // Will need to be resolved later
        releaseDate: new Date().toISOString(),
        explicit: false,
        tracks: [{
          title: track.title,
          duration: formatDuration(track.duration) || '0:00',
          url: '', // HGH tracks don't have direct URLs yet
          trackNumber: 1, // Always track 1 for singles
          subtitle: '',
          summary: '',
          image: '',
          explicit: false,
          keywords: [],
          itemGuid: track.itemGuid
        }],
        podroll: null,
        publisher: {
          name: 'Home Grown Hits Playlist',
          url: 'https://podcastindex.org',
          feedUrl: track.feedUrl || ''
        },
        funding: null,
        feedGuid: track.feedGuid,
        feedTitle: track.feedTitle
      }
    }
  };
  
  parsedFeeds.feeds.push(newSingle);
  newSinglesCount++;
});

// Write updated database
console.log('\n💾 Writing updated database...');
fs.writeFileSync(PARSED_FEEDS_PATH, JSON.stringify(parsedFeeds, null, 2));

console.log(`\n✅ Successfully created ${newSinglesCount} HGH singles!`);
console.log(`📊 New total: ${parsedFeeds.feeds.length} album feeds`);
console.log(`🎉 HGH tracks are now properly represented as individual singles!`);

console.log(`\n📝 Summary:`);
console.log(`  - Removed: ${removedCount} fake HGH albums with duplicate tracks`);
console.log(`  - Created: ${newSinglesCount} individual HGH singles`);
console.log(`  - Each HGH track now appears as a single with 1 track`);