#!/usr/bin/env node
// Analyze Lightning Thrashes track durations and resolution status

const fs = require('fs');
const path = require('path');

function analyzeLightningThrashes() {
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    // Filter Lightning Thrashes tracks
    const lightningTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.playlistInfo?.source?.includes('Lightning Thrashes')
    );
    
    console.log(`📊 Total Lightning Thrashes tracks: ${lightningTracks.length}`);
    
    // Group by duration
    const durationGroups = lightningTracks.reduce((groups, track) => {
      const duration = track.duration || 0;
      if (!groups[duration]) groups[duration] = [];
      groups[duration].push(track);
      return groups;
    }, {});
    
    console.log(`\n📊 Duration breakdown:`);
    Object.keys(durationGroups)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .forEach(duration => {
        const count = durationGroups[duration].length;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        console.log(`  ${duration}s (${mins}:${secs.toString().padStart(2, '0')}): ${count} tracks`);
      });
    
    // Analyze 5-minute tracks
    const fiveMinuteTracks = lightningTracks.filter(track => track.duration === 300);
    console.log(`\n📊 5-minute track analysis:`);
    console.log(`Total 5-minute tracks: ${fiveMinuteTracks.length}`);
    
    // Check resolution status
    const resolved = fiveMinuteTracks.filter(track => track.valueForValue?.resolved === true);
    const unfindable = fiveMinuteTracks.filter(track => track.valueForValue?.unfindable === true);
    const hasV4VData = fiveMinuteTracks.filter(track => 
      track.valueForValue?.feedGuid && 
      track.valueForValue?.itemGuid && 
      !track.valueForValue?.resolved &&
      !track.valueForValue?.unfindable
    );
    const noV4VData = fiveMinuteTracks.filter(track => 
      !track.valueForValue?.feedGuid || 
      !track.valueForValue?.itemGuid
    );
    
    console.log(`✅ Resolved (but still 300s): ${resolved.length}`);
    console.log(`🏷️ Marked as unfindable: ${unfindable.length}`);
    console.log(`🔍 Has V4V data but unresolved: ${hasV4VData.length}`);
    console.log(`❌ No V4V data: ${noV4VData.length}`);
    
    // Show sample of each category
    if (resolved.length > 0) {
      console.log(`\n✅ Sample resolved track (still 300s):`);
      const sample = resolved[0];
      console.log(`  Title: ${sample.title}`);
      console.log(`  Artist: ${sample.artist}`);
      console.log(`  Resolved Title: ${sample.valueForValue?.resolvedTitle}`);
      console.log(`  Resolved Artist: ${sample.valueForValue?.resolvedArtist}`);
      console.log(`  Duration: ${sample.duration}s (should be updated!)`);
    }
    
    if (hasV4VData.length > 0) {
      console.log(`\n🔍 Sample unresolved track with V4V data:`);
      const sample = hasV4VData[0];
      console.log(`  Title: ${sample.title}`);
      console.log(`  FeedGuid: ${sample.valueForValue?.feedGuid?.substring(0, 8)}...`);
      console.log(`  ItemGuid: ${sample.valueForValue?.itemGuid?.substring(0, 8)}...`);
    }
    
    // Check if resolved tracks have incorrect durations
    const resolvedWithWrongDuration = lightningTracks.filter(track => 
      track.valueForValue?.resolved === true && 
      track.duration === 300 &&
      track.valueForValue?.resolvedAudioUrl
    );
    
    console.log(`\n⚠️ Resolved tracks with incorrect 300s duration: ${resolvedWithWrongDuration.length}`);
    
  } catch (error) {
    console.error('❌ Error analyzing Lightning Thrashes tracks:', error);
  }
}

analyzeLightningThrashes();