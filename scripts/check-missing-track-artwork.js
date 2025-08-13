#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function checkMissingTrackArtwork() {
  console.log('🎨 Checking for missing track artwork across all tracks...\n');
  
  const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
  
  if (!fs.existsSync(musicTracksPath)) {
    console.error('❌ music-tracks.json not found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  const tracks = data.musicTracks || [];
  
  console.log(`📊 Checking ${tracks.length} total tracks for missing artwork...\n`);
  
  let missingArtwork = [];
  let emptyArtwork = [];
  let validArtwork = 0;
  
  // Group tracks by artist for better organization
  const tracksByArtist = {};
  
  tracks.forEach(track => {
    const artist = track.artist || 'Unknown Artist';
    if (!tracksByArtist[artist]) {
      tracksByArtist[artist] = [];
    }
    tracksByArtist[artist].push(track);
    
    // Check artwork status
    if (!track.image) {
      missingArtwork.push(track);
    } else if (track.image.trim() === '') {
      emptyArtwork.push(track);
    } else {
      validArtwork++;
    }
  });
  
  // Report missing artwork by artist
  if (missingArtwork.length > 0) {
    console.log(`❌ ${missingArtwork.length} tracks missing artwork:`);
    const missingByArtist = {};
    missingArtwork.forEach(track => {
      const artist = track.artist || 'Unknown Artist';
      if (!missingByArtist[artist]) {
        missingByArtist[artist] = [];
      }
      missingByArtist[artist].push(track);
    });
    
    Object.entries(missingByArtist).forEach(([artist, tracks]) => {
      console.log(`\n  🎤 ${artist}:`);
      tracks.forEach(track => {
        console.log(`    📀 "${track.title}" (Album: ${track.album || 'Unknown'})`);
      });
    });
  }
  
  // Report empty artwork
  if (emptyArtwork.length > 0) {
    console.log(`\n⚠️  ${emptyArtwork.length} tracks with empty artwork:`);
    const emptyByArtist = {};
    emptyArtwork.forEach(track => {
      const artist = track.artist || 'Unknown Artist';
      if (!emptyByArtist[artist]) {
        emptyByArtist[artist] = [];
      }
      emptyByArtist[artist].push(track);
    });
    
    Object.entries(emptyByArtist).forEach(([artist, tracks]) => {
      console.log(`\n  🎤 ${artist}:`);
      tracks.forEach(track => {
        console.log(`    📀 "${track.title}" (Album: ${track.album || 'Unknown'})`);
      });
    });
  }
  
  // Summary statistics
  console.log(`\n📊 Artwork Summary:`);
  console.log(`✅ Valid artwork: ${validArtwork}`);
  console.log(`❌ Missing artwork: ${missingArtwork.length}`);
  console.log(`⚠️  Empty artwork: ${emptyArtwork.length}`);
  console.log(`📈 Coverage: ${((validArtwork / tracks.length) * 100).toFixed(1)}%`);
  
  // Artist breakdown
  console.log(`\n🎤 Artists with tracks:`);
  Object.entries(tracksByArtist)
    .sort(([,a], [,b]) => b.length - a.length)
    .forEach(([artist, tracks]) => {
      const missing = tracks.filter(t => !t.image || t.image.trim() === '').length;
      const coverage = tracks.length > 0 ? ((tracks.length - missing) / tracks.length * 100).toFixed(0) : 0;
      console.log(`  ${artist}: ${tracks.length} tracks (${coverage}% artwork coverage)`);
    });
  
  // Special focus on Nate Johnivan
  if (tracksByArtist['Nate Johnivan']) {
    const nateTracks = tracksByArtist['Nate Johnivan'];
    console.log(`\n🎯 Nate Johnivan Analysis:`);
    console.log(`📀 Total tracks: ${nateTracks.length}`);
    
    const nateAlbums = [...new Set(nateTracks.map(t => t.album))];
    console.log(`💿 Albums: ${nateAlbums.length}`);
    nateAlbums.forEach(album => {
      const albumTracks = nateTracks.filter(t => t.album === album);
      const missingInAlbum = albumTracks.filter(t => !t.image || t.image.trim() === '').length;
      console.log(`   "${album}": ${albumTracks.length} tracks (${albumTracks.length - missingInAlbum}/${albumTracks.length} with artwork)`);
    });
  }
  
  return {
    total: tracks.length,
    valid: validArtwork,
    missing: missingArtwork.length,
    empty: emptyArtwork.length,
    missingTracks: missingArtwork,
    emptyTracks: emptyArtwork
  };
}

if (require.main === module) {
  checkMissingTrackArtwork().catch(console.error);
}

module.exports = { checkMissingTrackArtwork };