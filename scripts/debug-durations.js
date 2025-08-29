#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));

// Find tracks with problematic durations
const problematic = data.musicTracks.filter(t => 
  !isFinite(t.duration) || t.duration < 0 || t.duration > 10000
);

console.log('Problematic durations found:', problematic.length);
if (problematic.length > 0) {
  problematic.slice(0, 10).forEach((t, i) => {
    console.log(`${i+1}. "${t.title}" - Duration: ${t.duration}`);
  });
}

// Check for null/undefined values
const nullDurations = data.musicTracks.filter(t => t.duration == null);
console.log('Null/undefined durations:', nullDurations.length);

// Calculate proper statistics
const validDurations = data.musicTracks
  .map(t => t.duration)
  .filter(d => d != null && isFinite(d) && d >= 0);

console.log('Valid durations for calculation:', validDurations.length);
if (validDurations.length > 0) {
  const avg = validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length;
  const sorted = validDurations.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  console.log('Correct average:', Math.round(avg), 'seconds');
  console.log('Median:', median, 'seconds');
  console.log('Min:', sorted[0], 'Max:', sorted[sorted.length - 1]);
}