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

// Find missing tracks
const nonPlaceholderTracks = hghSongs.filter(track => !track.title.startsWith('Track '));
const missingTracks = nonPlaceholderTracks.filter(track => !audioTitles.has(track.title));

console.log(`📊 Track Analysis:`);
console.log(`   Total tracks: ${hghSongs.length}`);
console.log(`   Non-placeholder tracks: ${nonPlaceholderTracks.length}`);
console.log(`   Tracks with audio URLs: ${audioTitles.size}`);
console.log(`   Missing audio URLs: ${missingTracks.length}`);
console.log('');

console.log('🔍 Sample of missing tracks:');
missingTracks.slice(0, 10).forEach((track, i) => {
  console.log(`${i+1}. "${track.title}" (Feed: ${track.feedGuid})`);
});

if (missingTracks.length > 10) {
  console.log(`... and ${missingTracks.length - 10} more`);
}

// Check for any patterns in missing tracks
console.log('\n🔎 Missing track analysis:');
const feedCounts = {};
missingTracks.forEach(track => {
  feedCounts[track.feedTitle] = (feedCounts[track.feedTitle] || 0) + 1;
});

console.log('Missing tracks by feed:');
Object.entries(feedCounts)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .forEach(([feed, count]) => {
    console.log(`  ${feed}: ${count} missing`);
  });