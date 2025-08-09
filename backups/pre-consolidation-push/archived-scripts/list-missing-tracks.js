const fs = require('fs');

// Load data
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

// Find all tracks without audio URLs (excluding placeholders)
const nonPlaceholderTracks = hghSongs.filter(track => !track.title.startsWith('Track '));
const missingTracks = nonPlaceholderTracks.filter(track => !audioTitles.has(track.title));

console.log(`📊 Missing Audio URLs Summary:`);
console.log(`   Total tracks: ${hghSongs.length}`);
console.log(`   Non-placeholder tracks: ${nonPlaceholderTracks.length}`);
console.log(`   Tracks with audio URLs: ${audioTitles.size}`);
console.log(`   Missing audio URLs: ${missingTracks.length}`);
console.log('');

console.log('🔍 All tracks missing audio URLs:');
console.log('=====================================');

// Group by title for easier analysis
const trackGroups = {};
missingTracks.forEach(track => {
  if (!trackGroups[track.title]) {
    trackGroups[track.title] = [];
  }
  trackGroups[track.title].push(track);
});

Object.entries(trackGroups)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([title, tracks], index) => {
    console.log(`${index + 1}. "${title}" - ${tracks.length} track${tracks.length > 1 ? 's' : ''}`);
    tracks.forEach((track, i) => {
      console.log(`   ${i + 1}. Artist: ${track.artist || track.feedTitle} | Duration: ${track.duration}s`);
      console.log(`      Feed GUID: ${track.feedGuid}`);
      console.log(`      Item GUID: ${track.itemGuid}`);
    });
    console.log('');
  });

// Also check placeholder tracks
const placeholderTracks = hghSongs.filter(track => track.title.startsWith('Track '));
if (placeholderTracks.length > 0) {
  console.log(`📋 Placeholder tracks (never resolved): ${placeholderTracks.length}`);
  placeholderTracks.slice(0, 5).forEach((track, i) => {
    console.log(`${i + 1}. ${track.title} (Feed: ${track.feedGuid})`);
  });
  if (placeholderTracks.length > 5) {
    console.log(`... and ${placeholderTracks.length - 5} more placeholder tracks`);
  }
}