#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));

const noUrlTracks = data.musicTracks.filter(t => !t.feedUrl);
console.log('Tracks without feedUrl:', noUrlTracks.length);

if (noUrlTracks.length > 0) {
  console.log('\nSample tracks without feedUrl:');
  noUrlTracks.slice(0, 10).forEach((t, i) => {
    console.log(`  ${i + 1}. "${t.title}" - Album: "${t.feedTitle || '(no title)'}"`);
    console.log(`      Added: ${t.addedDate || t.discoveredAt || '(unknown)'}`);
    console.log(`      Source: ${t.source || t.extractionMethod || '(unknown)'}`);
    console.log();
  });
}

// Check what sources these tracks come from
const sourceCount = new Map();
noUrlTracks.forEach(track => {
  const source = track.source || track.extractionMethod || 'unknown';
  sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
});

console.log('Sources of tracks without feedUrl:');
[...sourceCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
  console.log(`  ${source}: ${count} tracks`);
});