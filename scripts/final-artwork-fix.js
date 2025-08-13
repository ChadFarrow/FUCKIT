#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function addPlaceholderArtwork() {
  console.log('🎨 Adding placeholder artwork for remaining tracks...');
  
  const tracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
  const backupPath = path.join(__dirname, '..', 'data', 'music-tracks-backup-before-placeholders.json');
  
  // Create backup
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tracksPath, backupPath);
    console.log('📋 Created backup:', backupPath);
  }
  
  const tracksData = JSON.parse(fs.readFileSync(tracksPath, 'utf8'));
  const tracks = tracksData.musicTracks;
  
  let updatedCount = 0;
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    
    // Check if track has no artwork URL
    if (!track.artworkUrl || track.artworkUrl === 'null' || track.artworkUrl === 'undefined' || track.artworkUrl === '') {
      // Create a custom placeholder based on the track title
      const placeholderUrl = `https://via.placeholder.com/300x300/1e40af/ffffff?text=${encodeURIComponent(track.title)}`;
      
      tracks[i].artworkUrl = placeholderUrl;
      updatedCount++;
      
      console.log(`🎨 Added placeholder for: "${track.title}" by ${track.artist || 'Unknown Artist'}`);
    }
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`📊 Processed ${i + 1}/${tracks.length} tracks...`);
    }
  }
  
  // Save updated tracks
  tracksData.musicTracks = tracks;
  fs.writeFileSync(tracksPath, JSON.stringify(tracksData, null, 2));
  
  console.log('\n🎯 Placeholder Artwork Summary:');
  console.log(`- Total tracks processed: ${tracks.length}`);
  console.log(`- Placeholders added: ${updatedCount}`);
  console.log(`- Final artwork coverage: ${tracks.length}/${tracks.length} (100%)`);
  console.log(`- Database updated: ${tracksPath}`);
  
  // Verify final coverage
  const finalCoverage = tracks.filter(t => t.artworkUrl && t.artworkUrl !== 'null' && t.artworkUrl !== 'undefined' && t.artworkUrl !== '').length;
  console.log(`✅ Verification: ${finalCoverage}/${tracks.length} tracks now have artwork URLs`);
}

// Run the fix
addPlaceholderArtwork().catch(console.error);
