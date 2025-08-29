#!/usr/bin/env node

/**
 * Test what the albums API actually returns for deathdreams
 */

const fs = require('fs');
const path = require('path');
// Simple slug generation function
function generateAlbumSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

console.log('🔍 Testing deathdreams album API logic...\n');

// Load the data
const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Group music tracks by feedGuid to create albums
const musicAlbumGroups = new Map();

musicData.musicTracks.forEach((track) => {
  const key = track.feedGuid || 'unknown';
  if (!musicAlbumGroups.has(key)) {
    musicAlbumGroups.set(key, {
      feedGuid: track.feedGuid,
      feedTitle: track.feedTitle,
      feedImage: track.feedImage || track.image,
      feedUrl: track.feedUrl,
      tracks: []
    });
  }
  musicAlbumGroups.get(key).tracks.push(track);
});

// Find the deathdreams group
let deathDreamsGroup = null;
for (const [key, group] of musicAlbumGroups.entries()) {
  if (group.feedTitle && group.feedTitle.toLowerCase() === 'deathdreams') {
    deathDreamsGroup = group;
    break;
  }
}

if (!deathDreamsGroup) {
  console.log('❌ deathdreams group not found');
  process.exit(1);
}

console.log(`📊 Found deathdreams group with ${deathDreamsGroup.tracks.length} raw tracks`);

// Apply the same deduplication logic as the API
const deduplicatedTracks = deathDreamsGroup.tracks
  .filter((track, index, array) => {
    const title = track.title || 'Untitled';
    
    // Find all tracks with the same title
    const sameTitle = array.filter(t => (t.title || 'Untitled') === title);
    
    // If only one track with this title, keep it
    if (sameTitle.length === 1) return true;
    
    // If multiple tracks with same title, prefer the one with a URL
    const withUrl = sameTitle.find(t => t.enclosureUrl && t.enclosureUrl.trim() !== '');
    if (withUrl) {
      return track === withUrl;
    }
    
    // If none have URLs, keep the first occurrence
    return array.findIndex(t => (t.title || 'Untitled') === title) === index;
  });

console.log(`📊 After deduplication: ${deduplicatedTracks.length} tracks`);

// Convert to API format
const apiTracks = deduplicatedTracks.map((track, index) => {
  // Remove OP3.dev tracking wrapper from URLs
  let cleanUrl = track.enclosureUrl || '';
  if (cleanUrl.includes('op3.dev/')) {
    const urlMatch = cleanUrl.match(/https:\/\/op3\.dev\/[^\/]+\/(https?:\/\/.+)/);
    if (urlMatch) {
      cleanUrl = urlMatch[1];
    }
  }
  
  return {
    title: track.title || 'Untitled',
    duration: track.duration ? Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : '0:00',
    url: cleanUrl,
    trackNumber: index + 1,
    subtitle: '',
    summary: track.description || '',
    image: track.image || deathDreamsGroup.feedImage || '',
    explicit: track.explicit || false,
    keywords: []
  };
});

// Generate the album object
const albumTitle = deathDreamsGroup.feedTitle;
const artist = 'deathdreams'; // Based on the track data

const album = {
  id: generateAlbumSlug(albumTitle),
  title: albumTitle,
  artist: artist,
  description: deathDreamsGroup.tracks[0].description || '',
  coverArt: deathDreamsGroup.feedImage || deathDreamsGroup.tracks[0].image || `/api/placeholder-image?title=${encodeURIComponent(albumTitle)}&artist=${encodeURIComponent(artist)}`,
  tracks: apiTracks,
  podroll: null,
  publisher: null,
  funding: null,
  feedId: deathDreamsGroup.feedGuid || 'music-' + generateAlbumSlug(albumTitle),
  feedUrl: deathDreamsGroup.feedUrl || '',
  lastUpdated: new Date().toISOString()
};

console.log('\n🎵 Final album object:');
console.log(`ID: ${album.id}`);
console.log(`Title: ${album.title}`);
console.log(`Artist: ${album.artist}`);
console.log(`Tracks: ${album.tracks.length}`);
console.log(`Cover Art: ${album.coverArt}`);

console.log('\n📋 Track listing:');
album.tracks.forEach((track, i) => {
  console.log(`${i+1}. "${track.title}" (${track.duration}) [URL: ${track.url ? 'Yes' : 'No'}]`);
});

console.log('\n✅ This is what the API should return for the deathdreams album');