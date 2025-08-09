#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATABASE_FILE = path.join(__dirname, '../data/music-tracks.json');

try {
  console.log('📖 Reading database file...');
  const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
  
  console.log(`📊 Total tracks: ${data.musicTracks.length}`);
  
  // Count tracks by source
  const sourceCounts = {};
  data.musicTracks.forEach(track => {
    const source = track.source || 'unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  
  console.log('📈 Tracks by source:');
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  // Show first few rss-playlist tracks
  const rssTracks = data.musicTracks.filter(track => track.source === 'rss-playlist');
  console.log(`\n🎵 First 3 RSS playlist tracks:`);
  rssTracks.slice(0, 3).forEach((track, i) => {
    console.log(`  ${i + 1}. ${track.title} (${track.artist})`);
  });
  
} catch (error) {
  console.error('❌ Error reading database:', error);
} 