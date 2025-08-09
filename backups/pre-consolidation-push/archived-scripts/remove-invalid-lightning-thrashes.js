#!/usr/bin/env node
// Remove invalid Lightning Thrashes placeholder tracks that can't be resolved

const fs = require('fs');
const path = require('path');

async function removeInvalidTracks() {
  console.log('🗑️ Removing invalid Lightning Thrashes placeholder tracks...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks before cleanup: ${musicTracksData.length}`);
    
    // Find Lightning Thrashes tracks with 5-minute placeholders that failed resolution
    const invalidTrackIds = [
      'lightning-thrashes-playlist-1754350795653-143', // Track 144
      'lightning-thrashes-playlist-1754350795653-188', // Track 189
      'lightning-thrashes-playlist-1754350795653-238', // Track 239
      'lightning-thrashes-playlist-1754350795653-252', // Track 253
      'lightning-thrashes-playlist-1754350795653-255', // Track 256
      'lightning-thrashes-playlist-1754350795653-315', // Track 316
      'lightning-thrashes-playlist-1754350795653-372', // Track 373
    ];
    
    // Also find by pattern in case IDs are different
    const placeholderTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.duration === 300 &&
      track.valueForValue?.resolved === false &&
      track.title?.includes('Lightning Thrashes Track') &&
      (track.title.includes('144') || track.title.includes('189') || 
       track.title.includes('239') || track.title.includes('253') ||
       track.title.includes('256') || track.title.includes('316') ||
       track.title.includes('373'))
    );
    
    console.log(`📊 Found ${placeholderTracks.length} invalid Lightning Thrashes tracks to remove:`);
    placeholderTracks.forEach(track => {
      console.log(`  - ${track.title} (ID: ${track.id})`);
    });
    
    // Remove the invalid tracks
    const cleanedTracks = musicTracksData.filter(track => 
      !placeholderTracks.some(invalidTrack => invalidTrack.id === track.id)
    );
    
    console.log(`📊 Tracks after cleanup: ${cleanedTracks.length}`);
    console.log(`📊 Removed: ${musicTracksData.length - cleanedTracks.length} invalid tracks`);
    
    // Write the cleaned data back to the file
    const updatedData = {
      musicTracks: cleanedTracks
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
    console.log('✅ Saved cleaned music-tracks.json');
    
    // Count remaining Lightning Thrashes tracks
    const remainingLightningTracks = cleanedTracks.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.playlistInfo?.source?.includes('Lightning Thrashes')
    );
    
    console.log(`📊 Remaining Lightning Thrashes tracks: ${remainingLightningTracks.length}`);
    
    // Count resolved vs unresolved
    const resolvedCount = remainingLightningTracks.filter(t => t.valueForValue?.resolved === true).length;
    const unresolvedCount = remainingLightningTracks.filter(t => t.valueForValue?.resolved === false).length;
    
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`⚠️ Unresolved: ${unresolvedCount} tracks`);
    
  } catch (error) {
    console.error('❌ Error removing invalid tracks:', error);
  }
}

removeInvalidTracks().catch(console.error);