const fs = require('fs');

// Load the original parsed HGH data to see episode information
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');

// Extract existing audio URLs
const audioTitles = new Set();
const audioMatch = audioModule.match(/"([^"]+)":\s*"[^"]+"/g);
if (audioMatch) {
  audioMatch.forEach(entry => {
    const [, title] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
    audioTitles.add(title);
  });
}

// Find missing tracks
const missingTracks = hghSongs.filter(track => 
  !track.title.startsWith('Track ') && 
  !audioTitles.has(track.title)
);

console.log('🔍 Analyzing Missing Tracks by Episode Position');
console.log('=' .repeat(60));

// Since the tracks are in order from the RSS feed, we can infer episode structure
// HGH typically has multiple tracks per episode
console.log(`📊 Missing Tracks Analysis:`);
console.log(`Total missing: ${missingTracks.length}`);
console.log('');

// Group by approximate position to understand which episodes they're from
const tracksPerEpisode = 8; // Rough estimate based on typical HGH episode structure
missingTracks.forEach((track, index) => {
  const originalIndex = hghSongs.findIndex(s => 
    s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid
  );
  
  const approximateEpisode = Math.floor(originalIndex / tracksPerEpisode) + 1;
  const positionInEpisode = (originalIndex % tracksPerEpisode) + 1;
  
  console.log(`${index + 1}. "${track.title}"`);
  console.log(`   Position: Track ${originalIndex + 1} of 1119 total`);
  console.log(`   Estimated Episode: ~${approximateEpisode} (position ${positionInEpisode})`);
  console.log(`   Feed GUID: ${track.feedGuid}`);
  console.log(`   Duration: ${track.duration}s`);
  console.log('');
});

// Analysis by position ranges
console.log('📈 Missing Tracks Distribution:');
const positionRanges = {
  'Early (1-300)': 0,
  'Mid-Early (301-600)': 0,
  'Mid-Late (601-900)': 0,
  'Late (901-1119)': 0
};

missingTracks.forEach(track => {
  const originalIndex = hghSongs.findIndex(s => 
    s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid
  );
  
  if (originalIndex < 300) positionRanges['Early (1-300)']++;
  else if (originalIndex < 600) positionRanges['Mid-Early (301-600)']++;
  else if (originalIndex < 900) positionRanges['Mid-Late (601-900)']++;
  else positionRanges['Late (901-1119)']++;
});

Object.entries(positionRanges).forEach(([range, count]) => {
  console.log(`${range}: ${count} tracks`);
});

// Check for specific patterns in feed GUIDs
console.log('\n🔍 Feed GUID Patterns:');
const guidCounts = {};
missingTracks.forEach(track => {
  guidCounts[track.feedGuid] = (guidCounts[track.feedGuid] || 0) + 1;
});

Object.entries(guidCounts)
  .sort(([,a], [,b]) => b - a)
  .forEach(([guid, count]) => {
    console.log(`${guid}: ${count} track${count > 1 ? 's' : ''}`);
  });