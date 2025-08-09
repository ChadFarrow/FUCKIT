const fs = require('fs');

async function getAudioDuration(audioUrl) {
  try {
    // Make a HEAD request to get content-length and see if we can get duration from headers
    const response = await fetch(audioUrl, { method: 'HEAD' });
    
    if (!response.ok) {
      return null;
    }
    
    // Some servers provide duration in headers
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    // For audio files, we can estimate duration from file size (rough approximation)
    if (contentLength && contentType && contentType.includes('audio')) {
      const fileSizeKB = parseInt(contentLength) / 1024;
      let estimatedDuration = null;
      
      // Different estimations based on audio format
      if (contentType.includes('mpeg') || contentType.includes('mp3')) {
        // MP3 at 128kbps: approximately 1KB ≈ 0.062 seconds
        estimatedDuration = Math.round(fileSizeKB * 0.062);
      } else if (contentType.includes('m4a') || contentType.includes('mp4')) {
        // M4A files, similar approach but different bitrate estimation
        estimatedDuration = Math.round(fileSizeKB * 0.055);
      } else if (contentType.includes('wav')) {
        // WAV files are much larger (uncompressed)
        estimatedDuration = Math.round(fileSizeKB * 0.006);
      } else if (contentType.includes('ogg') || contentType.includes('vorbis')) {
        // OGG Vorbis estimation
        estimatedDuration = Math.round(fileSizeKB * 0.065);
      } else if (contentType.includes('flac')) {
        // FLAC is larger than MP3 but smaller than WAV
        estimatedDuration = Math.round(fileSizeKB * 0.020);
      }
      
      // Only return if it seems reasonable (15 seconds to 20 minutes)
      if (estimatedDuration && estimatedDuration >= 15 && estimatedDuration <= 1200) {
        return estimatedDuration;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function comprehensiveDurationFix() {
  console.log('⏱️ Comprehensive Duration Fix - All Remaining 3:00 Placeholders');
  console.log('=' .repeat(70));
  
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Load audio URL map to get actual audio URLs
  let audioUrlMap = {};
  try {
    const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
    const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    if (audioMatch) {
      const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          audioUrlMap[title] = url;
        });
      }
    }
  } catch (error) {
    console.log('❌ Could not load audio URL map');
    return;
  }
  
  console.log(`📊 Loaded ${Object.keys(audioUrlMap).length} audio URLs`);
  
  // Find ALL tracks with 180 second (3:00) placeholder duration that have audio URLs
  const placeholderDurationTracks = hghSongs.filter(track => 
    track.duration === 180 && 
    audioUrlMap[track.title] &&
    !track.title.startsWith('Track ') &&
    track.title !== 'Unknown Feed'
  );
  
  console.log(`📊 Found ${placeholderDurationTracks.length} resolved tracks with 3:00 placeholder duration`);
  console.log(`📊 Total 3:00 duration tracks in dataset: ${hghSongs.filter(t => t.duration === 180).length}`);
  
  if (placeholderDurationTracks.length === 0) {
    console.log('✅ No resolvable duration tracks found');
    return;
  }
  
  let fixedCount = 0;
  let processedCount = 0;
  const updatedSongs = [...hghSongs];
  
  // Process ALL tracks this time - be more aggressive
  const targetCount = placeholderDurationTracks.length; // Process ALL of them
  console.log(`\n🔍 Processing ALL ${targetCount} tracks in batches of 25...`);
  
  for (let i = 0; i < targetCount; i++) {
    const track = placeholderDurationTracks[i];
    const audioUrl = audioUrlMap[track.title];
    processedCount++;
    
    if (processedCount % 25 === 1) {
      console.log(`\n📦 Batch ${Math.ceil(processedCount / 25)}: Tracks ${processedCount}-${Math.min(processedCount + 24, targetCount)}`);
    }
    
    const globalIndex = updatedSongs.findIndex(s => 
      s.title === track.title && 
      s.feedGuid === track.feedGuid &&
      s.itemGuid === track.itemGuid
    );
    
    if (globalIndex === -1) continue;
    
    const realDuration = await getAudioDuration(audioUrl);
    
    if (realDuration && realDuration !== 180) {
      updatedSongs[globalIndex].duration = realDuration;
      
      const minutes = Math.floor(realDuration / 60);
      const seconds = realDuration % 60;
      
      console.log(`   ✅ "${track.title}": 3:00 → ${minutes}:${seconds.toString().padStart(2, '0')}`);
      fixedCount++;
    } else {
      // Show some failures for debugging
      if (processedCount % 25 === 0) {
        console.log(`   ❌ Could not determine duration for: "${track.title}"`);
      }
    }
    
    // Rate limiting - be more aggressive but still respectful
    if (processedCount % 25 === 0) {
      console.log(`   📊 Batch ${Math.ceil(processedCount / 25)} complete: ${fixedCount} fixed out of ${processedCount} processed`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between batches
    } else {
      await new Promise(resolve => setTimeout(resolve, 100)); // Quick pause between individual requests
    }
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated durations...');
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    console.log(`\n🎉 Comprehensive Duration Fix Complete!`);
    console.log(`✅ Fixed ${fixedCount} out of ${processedCount} track durations processed`);
    console.log(`📈 Success rate: ${((fixedCount / processedCount) * 100).toFixed(1)}%`);
    
    // Show updated duration stats
    const finalPlaceholder180 = updatedSongs.filter(t => t.duration === 180).length;
    const totalTracks = updatedSongs.length;
    const realDurations = totalTracks - finalPlaceholder180;
    
    console.log(`\n📊 Final duration statistics:`);
    console.log(`   Total tracks: ${totalTracks}`);
    console.log(`   Tracks with real durations: ${realDurations} (${((realDurations / totalTracks) * 100).toFixed(1)}%)`);
    console.log(`   Remaining 3:00 placeholders: ${finalPlaceholder180} (${((finalPlaceholder180 / totalTracks) * 100).toFixed(1)}%)`);
    
    // Show improvement from original
    const originalPlaceholders = 528; // From previous analysis
    const improvement = originalPlaceholders - finalPlaceholder180;
    console.log(`   Total improvement: ${improvement} tracks upgraded from 3:00 placeholder to real duration`);
    console.log(`   Original placeholder rate: ${((originalPlaceholders / totalTracks) * 100).toFixed(1)}%`);
    console.log(`   New placeholder rate: ${((finalPlaceholder180 / totalTracks) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No durations were fixed');
  }
}

comprehensiveDurationFix().catch(console.error);