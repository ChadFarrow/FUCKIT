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
const missingTracks = hghSongs.filter(track => 
  !track.title.startsWith('Track ') && 
  !audioTitles.has(track.title)
);

console.log('🔍 Recalculated Episode Analysis');
console.log('=' .repeat(50));
console.log('📺 Current RSS feed shows episodes 86-97 (12 episodes)');
console.log('📊 But we have 1,119 tracks total from the HGH playlist');
console.log('💡 This means the playlist contains historical data from episodes 1-97');
console.log('');

// Since we have 1,119 tracks and episodes go from 1-97, let's estimate tracks per episode
const totalEpisodes = 97;
const tracksPerEpisode = Math.round(1119 / totalEpisodes); // ~11-12 tracks per episode

console.log(`📈 Estimated: ~${tracksPerEpisode} tracks per episode across 97 total episodes`);
console.log('');

console.log('🎵 Missing Tracks by Actual Episode:');
console.log('=====================================');

missingTracks.forEach((track, index) => {
  const originalIndex = hghSongs.findIndex(s => 
    s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid
  );
  
  // Calculate actual episode (episodes 1-97)
  const actualEpisode = Math.floor(originalIndex / tracksPerEpisode) + 1;
  const positionInEpisode = (originalIndex % tracksPerEpisode) + 1;
  
  // Determine if this episode is in current feed (86-97) or historical (1-85)
  const episodeStatus = actualEpisode >= 86 ? 'CURRENT' : 'HISTORICAL';
  
  console.log(`${index + 1}. "${track.title}"`);
  console.log(`   Episode: ${actualEpisode} (${episodeStatus}) - Track ${positionInEpisode}`);
  console.log(`   Overall position: ${originalIndex + 1} of 1119`);
  console.log(`   Feed GUID: ${track.feedGuid}`);
  console.log('');
});

// Analyze by episode ranges
console.log('📊 Missing Tracks by Episode Range:');
const episodeRanges = {
  'Episodes 1-20 (Early)': 0,
  'Episodes 21-40 (Early-Mid)': 0,
  'Episodes 41-60 (Mid)': 0,
  'Episodes 61-85 (Historical)': 0,
  'Episodes 86-97 (Current Feed)': 0
};

missingTracks.forEach(track => {
  const originalIndex = hghSongs.findIndex(s => 
    s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid
  );
  const actualEpisode = Math.floor(originalIndex / tracksPerEpisode) + 1;
  
  if (actualEpisode <= 20) episodeRanges['Episodes 1-20 (Early)']++;
  else if (actualEpisode <= 40) episodeRanges['Episodes 21-40 (Early-Mid)']++;
  else if (actualEpisode <= 60) episodeRanges['Episodes 41-60 (Mid)']++;
  else if (actualEpisode <= 85) episodeRanges['Episodes 61-85 (Historical)']++;
  else episodeRanges['Episodes 86-97 (Current Feed)']++;
});

Object.entries(episodeRanges).forEach(([range, count]) => {
  console.log(`${range}: ${count} tracks`);
});

// Most important finding
const currentFeedMissing = missingTracks.filter(track => {
  const originalIndex = hghSongs.findIndex(s => 
    s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid
  );
  const actualEpisode = Math.floor(originalIndex / tracksPerEpisode) + 1;
  return actualEpisode >= 86;
}).length;

console.log('');
console.log('🎯 Key Insight:');
console.log(`   Missing from CURRENT episodes (86-97): ${currentFeedMissing} tracks`);
console.log(`   Missing from HISTORICAL episodes (1-85): ${31 - currentFeedMissing} tracks`);
console.log('');
console.log('💡 This explains why some feeds are missing - they may be from');
console.log('   historical episodes that are no longer in the current RSS feed!');