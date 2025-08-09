#!/usr/bin/env node
// Fix duration field for already-resolved V4V tracks

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  source: '',
  dryRun: false
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    switch(key) {
      case '--source':
        CONFIG.source = value;
        break;
      case '--dry-run':
        CONFIG.dryRun = true;
        break;
    }
  });
  
  if (!CONFIG.source) {
    console.error('❌ Error: --source is required');
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔧 Fix Resolved Track Durations

Usage: node fix-resolved-track-durations.js [options]

Required options:
  --source=<name>    Playlist source name (e.g., "Lightning Thrashes RSS Playlist")

Optional options:
  --dry-run          Show what would be fixed without saving

Examples:
  node fix-resolved-track-durations.js --source="Lightning Thrashes RSS Playlist"
  node fix-resolved-track-durations.js --source="ITDV RSS Playlist" --dry-run
`);
}

// Parse duration from various formats to seconds
function parseDurationToSeconds(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    return 300; // Default 5 minutes
  }
  
  // Handle format like "3:45" or "1:23:45"
  const parts = durationStr.split(':').map(p => parseInt(p) || 0);
  
  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 1) {
    // Just seconds
    return parts[0];
  }
  
  return 300; // Default if unparseable
}

async function fixResolvedTrackDurations() {
  console.log(`🔧 Fixing durations for resolved tracks from: ${CONFIG.source}`);
  
  try {
    const dataPath = path.join(__dirname, '..', 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks in database: ${musicTracksData.length}`);
    
    // Find resolved tracks from specified source that still have 300 second duration
    const tracksToFix = musicTracksData.filter(track => 
      track.playlistInfo?.source === CONFIG.source &&
      track.valueForValue?.resolved === true &&
      track.duration === 300
    );
    
    console.log(`📊 Found ${tracksToFix.length} resolved tracks with 300s duration needing fix`);
    
    if (tracksToFix.length === 0) {
      console.log('✅ No tracks need duration fixes!');
      return;
    }
    
    if (CONFIG.dryRun) {
      console.log(`\n🔍 DRY RUN - Would fix durations for ${tracksToFix.length} tracks:`);
      tracksToFix.slice(0, 10).forEach(track => {
        console.log(`  - "${track.valueForValue.resolvedTitle || track.title}" (currently 5:00)`);
      });
      if (tracksToFix.length > 10) {
        console.log(`  ... and ${tracksToFix.length - 10} more tracks`);
      }
      return;
    }
    
    let fixedCount = 0;
    let couldNotFixCount = 0;
    
    // Fix each track
    tracksToFix.forEach(track => {
      const trackIndex = musicTracksData.findIndex(t => t.id === track.id);
      if (trackIndex === -1) return;
      
      // Try to get duration from resolved V4V data first, then other sources
      let newDuration = 300; // Default
      let durationSource = 'default';
      
      // Check if we have actual duration data from resolution
      if (track.resolvedDuration && track.resolvedDuration !== 300) {
        newDuration = track.resolvedDuration;
        durationSource = 'resolvedDuration';
      } else if (track.valueForValue?.resolvedDuration && track.valueForValue.resolvedDuration !== 300) {
        newDuration = track.valueForValue.resolvedDuration;
        durationSource = 'valueForValue.resolvedDuration';
      } else {
        // Try to extract duration from resolved audio URL or other metadata
        // For now, keep as 300 since we don't have better data
        couldNotFixCount++;
        console.log(`⚠️ Could not determine better duration for: ${track.valueForValue.resolvedTitle || track.title}`);
        return;
      }
      
      if (newDuration !== 300) {
        musicTracksData[trackIndex].duration = newDuration;
        fixedCount++;
        const mins = Math.floor(newDuration / 60);
        const secs = newDuration % 60;
        console.log(`✅ Fixed "${track.valueForValue.resolvedTitle || track.title}" -> ${mins}:${secs.toString().padStart(2, '0')} (from ${durationSource})`);
      }
    });
    
    if (fixedCount > 0) {
      // Write the updated data back to the file
      const updatedData = {
        musicTracks: musicTracksData
      };
      fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
      console.log('✅ Saved updated music-tracks.json');
    }
    
    console.log(`\n🎯 Duration fix complete!`);
    console.log(`✅ Fixed: ${fixedCount} tracks`);
    console.log(`⚠️ Could not fix: ${couldNotFixCount} tracks (no better duration data available)`);
    console.log(`📝 Remaining tracks with 5:00 duration: ${tracksToFix.length - fixedCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main execution
async function main() {
  parseArgs();
  await fixResolvedTrackDurations();
}

main().catch(console.error);