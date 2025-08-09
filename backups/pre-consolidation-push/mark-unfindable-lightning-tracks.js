#!/usr/bin/env node
// Mark Lightning Thrashes tracks that can't be resolved as unfindable

const fs = require('fs');
const path = require('path');

async function markUnfindableTracks() {
  console.log('🏷️ Marking unfindable Lightning Thrashes tracks...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks: ${musicTracksData.length}`);
    
    // Find Lightning Thrashes tracks with 5-minute placeholders that failed resolution
    const unfindableTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.duration === 300 &&
      track.valueForValue?.resolved === false &&
      track.title?.includes('Lightning Thrashes Track') &&
      track.valueForValue?.feedGuid && 
      track.valueForValue?.itemGuid
    );
    
    console.log(`📊 Found ${unfindableTracks.length} unfindable Lightning Thrashes tracks:`);
    
    let updatedCount = 0;
    
    unfindableTracks.forEach(track => {
      console.log(`  🏷️ Marking as unfindable: ${track.title}`);
      
      // Find the track in the data and update it
      const trackIndex = musicTracksData.findIndex(t => t.id === track.id);
      if (trackIndex !== -1) {
        musicTracksData[trackIndex] = {
          ...musicTracksData[trackIndex],
          title: `${track.title} (Unfindable)`,
          artist: 'Unknown Artist',
          duration: 300, // Keep original duration
          valueForValue: {
            ...musicTracksData[trackIndex].valueForValue,
            resolved: false,
            unfindable: true,
            unfindableReason: 'Track not found in Podcast Index - may be from private feed or no longer available',
            lastSearchAttempt: new Date().toISOString(),
            resolvedTitle: `${track.title} (Unfindable)`,
            resolvedArtist: 'Unknown Artist'
          }
        };
        updatedCount++;
      }
    });
    
    console.log(`📊 Updated ${updatedCount} tracks as unfindable`);
    
    // Write the updated data back to the file
    const updatedData = {
      musicTracks: musicTracksData
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
    console.log('✅ Saved updated music-tracks.json');
    
    // Count Lightning Thrashes track statistics
    const lightningTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.playlistInfo?.source?.includes('Lightning Thrashes')
    );
    
    const resolvedCount = lightningTracks.filter(t => t.valueForValue?.resolved === true).length;
    const unfindableCount = lightningTracks.filter(t => t.valueForValue?.unfindable === true).length;
    const stillUnresolvedCount = lightningTracks.filter(t => 
      t.valueForValue?.resolved === false && !t.valueForValue?.unfindable
    ).length;
    
    console.log(`\n📊 Lightning Thrashes Track Statistics:`);
    console.log(`📊 Total tracks: ${lightningTracks.length}`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`🏷️ Marked as unfindable: ${unfindableCount} tracks`);
    console.log(`⚠️ Still unresolved: ${stillUnresolvedCount} tracks`);
    
  } catch (error) {
    console.error('❌ Error marking unfindable tracks:', error);
  }
}

markUnfindableTracks().catch(console.error);