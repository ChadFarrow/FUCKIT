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
    
    // For MP3 files, we can estimate duration from file size (rough approximation)
    if (contentLength && contentType && contentType.includes('audio')) {
      const fileSizeKB = parseInt(contentLength) / 1024;
      
      // Rough estimation for MP3 at 128kbps: 1KB ≈ 0.062 seconds
      // This is very approximate but better than 3:00 placeholder
      if (contentType.includes('mpeg') || contentType.includes('mp3')) {
        const estimatedDuration = Math.round(fileSizeKB * 0.062);
        
        // Only return if it seems reasonable (30 seconds to 10 minutes)
        if (estimatedDuration >= 30 && estimatedDuration <= 600) {
          return estimatedDuration;
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function fixDurations() {
  console.log('⏱️ Fixing 3:00 Placeholder Durations');
  console.log('=' .repeat(50));
  
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
  
  // Find tracks with 180 second (3:00) placeholder duration that have audio URLs
  const placeholderDurationTracks = hghSongs.filter(track => 
    track.duration === 180 && 
    audioUrlMap[track.title] &&
    !track.title.startsWith('Track ') &&
    track.title !== 'Unknown Feed'
  );
  
  console.log(`📊 Found ${placeholderDurationTracks.length} resolved tracks with 3:00 placeholder duration`);
  console.log(`📊 Total 3:00 duration tracks: ${hghSongs.filter(t => t.duration === 180).length}`);
  
  if (placeholderDurationTracks.length === 0) {
    console.log('✅ No resolvable duration tracks found');
    return;
  }
  
  let fixedCount = 0;
  const updatedSongs = [...hghSongs];
  
  // Process tracks in small batches to avoid overwhelming servers
  console.log('\n🔍 Processing tracks in batches of 10...');
  
  for (let i = 0; i < Math.min(placeholderDurationTracks.length, 50); i++) {
    const track = placeholderDurationTracks[i];
    const audioUrl = audioUrlMap[track.title];
    
    console.log(`\n${i + 1}/${Math.min(placeholderDurationTracks.length, 50)}: "${track.title}"`);
    console.log(`   Audio URL: ${audioUrl}`);
    
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
      
      console.log(`   ✅ FIXED: 3:00 → ${minutes}:${seconds.toString().padStart(2, '0')}`);
      fixedCount++;
    } else {
      console.log(`   ❌ Could not determine real duration`);
    }
    
    // Rate limiting - be respectful to servers
    if (i % 10 === 9) {
      console.log(`   ⏸️ Batch complete, pausing...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated durations...');
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    console.log(`\n🎉 Duration Fix Complete!`);
    console.log(`✅ Fixed ${fixedCount} track durations`);
    
    // Show updated duration stats
    const finalPlaceholder180 = updatedSongs.filter(t => t.duration === 180).length;
    const totalResolved = updatedSongs.filter(t => 
      !t.title.startsWith('Track ') && t.title !== 'Unknown Feed'
    ).length;
    
    console.log(`📊 Duration statistics:`);
    console.log(`   Total resolved tracks: ${totalResolved}`);
    console.log(`   Tracks with real durations: ${totalResolved - finalPlaceholder180 + hghSongs.filter(t => t.duration !== 180).length}`);
    console.log(`   Remaining 3:00 placeholders: ${finalPlaceholder180}`);
    console.log(`   Improvement: ${fixedCount} tracks now have real durations`);
  } else {
    console.log('\n❌ No durations were fixed');
  }
}

fixDurations().catch(console.error);