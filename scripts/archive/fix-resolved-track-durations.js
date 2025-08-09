#!/usr/bin/env node
// Fix durations for resolved Lightning Thrashes tracks that still show 300 seconds

const fs = require('fs');
const path = require('path');

async function getAudioDuration(audioUrl) {
  try {
    if (!audioUrl || audioUrl === '') return null;
    
    // Make a HEAD request to get content-length and try to estimate duration
    const response = await fetch(audioUrl, { method: 'HEAD' });
    
    if (!response.ok) return null;
    
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    // If it's not an audio file, skip
    if (!contentType || !contentType.includes('audio')) return null;
    
    // For MP3 files, estimate duration based on file size
    // Average MP3 bitrate is around 128 kbps = 16 KB/s
    if (contentLength && contentType.includes('mp3')) {
      const sizeInBytes = parseInt(contentLength);
      const estimatedDuration = Math.round(sizeInBytes / 16000); // rough estimate
      
      // Only accept reasonable durations (30 seconds to 30 minutes)
      if (estimatedDuration >= 30 && estimatedDuration <= 1800) {
        return estimatedDuration;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`⚠️ Could not get duration for ${audioUrl}: ${error.message}`);
    return null;
  }
}

async function fixResolvedTrackDurations() {
  console.log('🔧 Fixing durations for resolved Lightning Thrashes tracks...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    // Find resolved Lightning Thrashes tracks with 300s duration
    const resolvedTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.duration === 300 &&
      track.valueForValue?.resolved === true &&
      track.valueForValue?.resolvedAudioUrl &&
      track.valueForValue?.resolvedAudioUrl !== ''
    );
    
    console.log(`📊 Found ${resolvedTracks.length} resolved tracks with 300s duration to fix`);
    
    if (resolvedTracks.length === 0) {
      console.log('✅ No tracks need duration fixes');
      return;
    }
    
    let fixedCount = 0;
    let failedCount = 0;
    
    // Process tracks in batches to avoid overwhelming servers
    for (let i = 0; i < resolvedTracks.length; i += 5) {
      const batch = resolvedTracks.slice(i, i + 5);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/5) + 1}/${Math.ceil(resolvedTracks.length/5)}`);
      
      const batchPromises = batch.map(async (track) => {
        console.log(`🔍 Checking duration for: "${track.valueForValue.resolvedTitle}" by "${track.valueForValue.resolvedArtist}"`);
        
        const actualDuration = await getAudioDuration(track.valueForValue.resolvedAudioUrl);
        
        if (actualDuration && actualDuration !== 300) {
          // Update the track in the data
          const trackIndex = musicTracksData.findIndex(t => t.id === track.id);
          if (trackIndex !== -1) {
            musicTracksData[trackIndex].duration = actualDuration;
            musicTracksData[trackIndex].endTime = actualDuration;
            
            fixedCount++;
            const mins = Math.floor(actualDuration / 60);
            const secs = actualDuration % 60;
            console.log(`✅ Updated duration: ${mins}:${secs.toString().padStart(2, '0')} (was 5:00)`);
          }
        } else {
          failedCount++;
          console.log(`❌ Could not determine duration`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait between batches to be respectful to servers
      if (i + 5 < resolvedTracks.length) {
        console.log('⏳ Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Save the updated data
    if (fixedCount > 0) {
      const updatedData = {
        musicTracks: musicTracksData
      };
      fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
      console.log('✅ Saved updated music-tracks.json');
    }
    
    console.log(`\n🎯 Duration fix complete!`);
    console.log(`✅ Fixed: ${fixedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    console.log(`📊 Remaining 5:00 tracks should be significantly reduced`);
    
  } catch (error) {
    console.error('❌ Error fixing track durations:', error);
  }
}

fixResolvedTrackDurations().catch(console.error);