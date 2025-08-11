#!/usr/bin/env node

/**
 * Check for tracks from the same album appearing as separate entries
 * 
 * This script identifies cases where multiple singles might be from the same album,
 * indicating potential issues with how albums were split into singles.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PARSED_FEEDS_PATH = path.join(DATA_DIR, 'parsed-feeds.json');

console.log('🔍 Checking for tracks from the same album appearing as separate entries...');

// Read existing data
let parsedFeeds;
try {
  parsedFeeds = JSON.parse(fs.readFileSync(PARSED_FEEDS_PATH, 'utf-8'));
  console.log(`✅ Found ${parsedFeeds.feeds.length} album feeds`);
} catch (error) {
  console.error('❌ Error reading parsed-feeds.json:', error.message);
  process.exit(1);
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

// Group singles by artist to identify potential albums split into singles
const singlesByArtist = new Map();

singles.forEach(singleFeed => {
  const singleAlbum = singleFeed.parsedData.album;
  const artist = singleAlbum.artist.trim();
  
  if (!singlesByArtist.has(artist)) {
    singlesByArtist.set(artist, []);
  }
  
  singlesByArtist.get(artist).push({
    feed: singleFeed,
    track: singleAlbum.tracks[0],
    albumTitle: singleAlbum.title,
    albumArtist: singleAlbum.artist
  });
});

// Look for artists with multiple singles that might be from the same album
console.log('\n🎵 Artists with multiple singles (potential split albums):');

const suspiciousArtists = [];

singlesByArtist.forEach((tracks, artist) => {
  if (tracks.length > 2) {
    // Check if any tracks have similar album titles or are clearly part of the same release
    const albumTitles = tracks.map(t => t.albumTitle.toLowerCase().trim());
    const uniqueAlbumTitles = [...new Set(albumTitles)];
    
    // If most singles have the same album title, this might be a split album
    const mostCommonTitle = albumTitles.reduce((acc, title) => {
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {});
    
    const maxCount = Math.max(...Object.values(mostCommonTitle));
    const totalTracks = tracks.length;
    
    if (maxCount > 1 || totalTracks > 5) {
      suspiciousArtists.push({
        artist,
        tracks: tracks.length,
        albumTitles: uniqueAlbumTitles,
        mostCommonTitle: Object.keys(mostCommonTitle).find(key => mostCommonTitle[key] === maxCount),
        maxCount,
        trackList: tracks
      });
    }
  }
});

// Sort by number of tracks (most suspicious first)
suspiciousArtists.sort((a, b) => b.tracks - a.tracks);

if (suspiciousArtists.length === 0) {
  console.log('✅ No obvious cases of albums split into singles found!');
} else {
  console.log(`\n📋 Found ${suspiciousArtists.length} artists with potentially split albums:\n`);
  
  suspiciousArtists.slice(0, 10).forEach((artistInfo, index) => {
    console.log(`${index + 1}. ${artistInfo.artist} - ${artistInfo.tracks} singles`);
    
    if (artistInfo.maxCount > 1) {
      console.log(`   ⚠️  ${artistInfo.maxCount} tracks from "${artistInfo.mostCommonTitle}"`);
    }
    
    console.log(`   Album titles: ${artistInfo.albumTitles.slice(0, 3).join(', ')}${artistInfo.albumTitles.length > 3 ? '...' : ''}`);
    
    // Show first few track titles
    const firstTracks = artistInfo.trackList.slice(0, 3).map(t => t.track.title);
    console.log(`   Tracks: ${firstTracks.join(', ')}${artistInfo.trackList.length > 3 ? '...' : ''}`);
    console.log('');
  });
  
  if (suspiciousArtists.length > 10) {
    console.log(`   ... and ${suspiciousArtists.length - 10} more artists`);
  }
}

// Also check for exact duplicate album titles across different feeds
console.log('\n🔍 Checking for duplicate album titles across different feeds...');

const albumTitleMap = new Map();

parsedFeeds.feeds.forEach(feed => {
  if (feed.parseStatus === 'success' && feed.parsedData?.album) {
    const album = feed.parsedData.album;
    const key = `${album.title.toLowerCase().trim()}|${album.artist.toLowerCase().trim()}`;
    
    if (!albumTitleMap.has(key)) {
      albumTitleMap.set(key, []);
    }
    
    albumTitleMap.get(key).push({
      feed,
      title: album.title,
      artist: album.artist,
      trackCount: album.tracks?.length || 0
    });
  }
});

const duplicateAlbums = [];
albumTitleMap.forEach((entries, key) => {
  if (entries.length > 1) {
    duplicateAlbums.push({
      key,
      entries,
      count: entries.length
    });
  }
});

if (duplicateAlbums.length === 0) {
  console.log('✅ No duplicate album titles found!');
} else {
  console.log(`\n📋 Found ${duplicateAlbums.length} cases of duplicate album titles:\n`);
  
  duplicateAlbums.slice(0, 10).forEach((dup, index) => {
    const firstEntry = dup.entries[0];
    console.log(`${index + 1}. "${firstEntry.title}" by ${firstEntry.artist} - ${dup.count} instances`);
    
    dup.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.trackCount} track${entry.trackCount === 1 ? '' : 's'} - ID: ${entry.feed.id || 'no-id'}`);
    });
    console.log('');
  });
  
  if (duplicateAlbums.length > 10) {
    console.log(`   ... and ${duplicateAlbums.length - 10} more duplicate albums`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`  - ${singles.length} total singles`);
console.log(`  - ${multiTrackAlbums.length} total multi-track albums`);
console.log(`  - ${suspiciousArtists.length} artists with potentially split albums`);
console.log(`  - ${duplicateAlbums.length} duplicate album titles`);

if (suspiciousArtists.length > 0 || duplicateAlbums.length > 0) {
  console.log(`\n⚠️  Manual review recommended for the items listed above.`);
} else {
  console.log(`\n✅ Database looks clean - no obvious issues found!`);
}