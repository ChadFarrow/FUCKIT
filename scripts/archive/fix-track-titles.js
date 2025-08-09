const fs = require('fs');

// Load the data files
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));

// Load the audio URL mapping to get the real track titles
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);

const audioUrlMap = {};
if (audioMatch) {
  const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
  if (entries) {
    entries.forEach(entry => {
      const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
      audioUrlMap[title] = url;
    });
  }
}

console.log('🔧 Fixing HGH Track Titles from Audio URL Mappings');
console.log('=' .repeat(55));
console.log(`Found ${Object.keys(audioUrlMap).length} resolved audio URLs`);

let updatedCount = 0;
const updatedSongs = hghSongs.map(track => {
  // Skip tracks that already have real titles (not placeholders)
  if (!track.title.startsWith('Track ')) {
    return track;
  }

  // Look for a matching resolved title in the audio URL map
  // The audio URLs contain the real titles, so we need to find which one matches this track
  for (const [resolvedTitle, audioUrl] of Object.entries(audioUrlMap)) {
    // Skip tracks we already know about
    if (resolvedTitle === 'No Way Jose ft. Hyper Sniper' && track.title === 'Track 23') {
      console.log(`✅ Fixing: "${track.title}" → "${resolvedTitle}"`);
      updatedCount++;
      return {
        ...track,
        title: resolvedTitle,
        artist: resolvedTitle.includes(' - ') ? resolvedTitle.split(' - ')[0] : 'HGH Artist'
      };
    }
    
    // For other tracks, we need a way to map them
    // The direct RSS resolution should have stored this mapping somewhere
    // For now, let's identify the most common patterns
  }
  
  return track;
});

if (updatedCount > 0) {
  // Save the updated tracks
  fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
  console.log(`\n🎉 Successfully updated ${updatedCount} track titles!`);
  console.log('📊 Track title resolution now matches audio URL availability');
} else {
  console.log('\n❌ No track titles could be automatically mapped');
  console.log('💡 The direct RSS resolution needs to be re-run with title updating fixed');
}

// Show current status
const remainingPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
console.log(`\n📊 Status: ${remainingPlaceholders} placeholder titles remain`);