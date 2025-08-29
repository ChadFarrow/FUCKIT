#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));

console.log('🔍 Debugging deathdreams album tracks...\n');

// Get deathdreams tracks
const deathDreamsTracks = data.musicTracks.filter(track => 
  track.feedTitle && track.feedTitle.toLowerCase() === 'deathdreams'
);

console.log('Raw deathdreams tracks:', deathDreamsTracks.length);
console.log('\nAll tracks:');
deathDreamsTracks.forEach((track, i) => {
  console.log(`${i+1}. "${track.title}" (URL: ${track.enclosureUrl ? 'Yes' : 'No'})`);
  if (track.enclosureUrl) {
    console.log(`   Audio: ${track.enclosureUrl.substring(0, 60)}...`);
  }
});

console.log('\n--- Simulating deduplication logic ---');

// Simulate the deduplication logic
const deduplicated = deathDreamsTracks.filter((track, index, array) => {
  const title = track.title || 'Untitled';
  
  // Find all tracks with the same title
  const sameTitle = array.filter(t => (t.title || 'Untitled') === title);
  
  console.log(`\nTrack "${title}": ${sameTitle.length} tracks with same title`);
  
  // If only one track with this title, keep it
  if (sameTitle.length === 1) {
    console.log(`  -> Unique title, keeping`);
    return true;
  }
  
  // If multiple tracks with same title, prefer the one with a URL
  const withUrl = sameTitle.find(t => t.enclosureUrl && t.enclosureUrl.trim() !== '');
  if (withUrl) {
    const keep = track === withUrl;
    console.log(`  -> Multiple with same title, keeping one with URL (this one: ${keep})`);
    return keep;
  }
  
  // If none have URLs, keep the first occurrence
  const keep = array.findIndex(t => (t.title || 'Untitled') === title) === index;
  console.log(`  -> No URLs found, keeping first occurrence (this one: ${keep})`);
  return keep;
});

console.log('\n📊 Final result after deduplication:');
console.log('Tracks kept:', deduplicated.length);
deduplicated.forEach((track, i) => {
  console.log(`${i+1}. "${track.title}" (URL: ${track.enclosureUrl ? 'Yes' : 'No'})`);
});

// Check for patterns in the duplicates
console.log('\n🔍 Analyzing track title patterns:');
const titleCounts = new Map();
deathDreamsTracks.forEach(track => {
  const title = track.title || 'Untitled';
  titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
});

[...titleCounts.entries()].forEach(([title, count]) => {
  if (count > 1) {
    console.log(`"${title}": ${count} duplicates`);
  }
});