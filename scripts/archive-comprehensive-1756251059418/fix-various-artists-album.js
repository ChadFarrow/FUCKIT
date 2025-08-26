#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Fixing Various Artists album...');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Find the Various Artists album
const variousArtistsAlbum = parsedFeedsData.feeds.find(feed => 
  feed.id === 'hgh-various-artists' || 
  (feed.parsedData && feed.parsedData.album && feed.parsedData.album.title === 'Various Artists')
);

if (!variousArtistsAlbum) {
  console.error('❌ Various Artists album not found in parsed-feeds.json');
  process.exit(1);
}

console.log('📀 Found Various Artists album');
console.log('   Current title:', variousArtistsAlbum.parsedData.album.title);
console.log('   Current artist:', variousArtistsAlbum.parsedData.album.artist);
console.log('   Feed GUID:', variousArtistsAlbum.parsedData.album.feedGuid);
console.log('   Track count:', variousArtistsAlbum.parsedData.album.tracks.length);

// Check track titles
const genericTracks = variousArtistsAlbum.parsedData.album.tracks.filter(track => 
  track.title.match(/^Track \d+$/)
);

console.log(`   Generic track titles: ${genericTracks.length}/${variousArtistsAlbum.parsedData.album.tracks.length}`);

// Create backup
const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-various-artists-fix-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);

// Option 1: Update to "Church of the Redeemer" as suggested
console.log('\n🎨 Updating album information...');

// Update album metadata
variousArtistsAlbum.parsedData.album.title = 'Church of the Redeemer';
variousArtistsAlbum.parsedData.album.artist = 'Church of the Redeemer';
variousArtistsAlbum.parsedData.album.description = 'Church of the Redeemer by Church of the Redeemer';
variousArtistsAlbum.parsedData.album.feedTitle = 'Church of the Redeemer';

// The generic track titles should probably be kept until we can resolve actual track names
// But we should flag this album as needing proper track information

console.log('   ✅ Updated album title to: Church of the Redeemer');
console.log('   ⚠️  Note: Track titles remain generic (Track 149, etc.) - needs proper track names');

// Save the updated data
fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
console.log('\n💾 Updated parsed-feeds.json');

// Also update music-tracks.json if it exists
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
if (fs.existsSync(musicTracksPath)) {
  const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  let updatedCount = 0;
  
  musicTracksData.musicTracks.forEach(track => {
    if (track.albumTitle === 'Various Artists' && track.artist === 'Homegrown Hits Artist') {
      track.albumTitle = 'Church of the Redeemer';
      track.artist = 'Church of the Redeemer';
      updatedCount++;
    }
  });
  
  if (updatedCount > 0) {
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
    console.log(`💾 Updated ${updatedCount} tracks in music-tracks.json`);
  }
}

console.log('\n✅ Fix complete!');
console.log('   Album renamed to: Church of the Redeemer');
console.log('   ⚠️  Track titles still need proper names (currently generic)');