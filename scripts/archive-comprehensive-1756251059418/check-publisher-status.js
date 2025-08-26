#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');

async function main() {
  console.log('🔍 Checking Publisher Data Status');
  console.log('');
  
  try {
    // Read music tracks
    const musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📀 Loaded ${musicTracks.length} tracks`);
    console.log('');
    
    // Analyze publisher data
    const withPublisher = musicTracks.filter(t => t.publisher && t.publisher.trim());
    const withoutPublisher = musicTracks.filter(t => !t.publisher || !t.publisher.trim());
    
    console.log('📊 Publisher Data Status:');
    console.log(`   ✅ Tracks with publisher: ${withPublisher.length}/${musicTracks.length} (${(withPublisher.length/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   ❌ Tracks without publisher: ${withoutPublisher.length}/${musicTracks.length} (${(withoutPublisher.length/musicTracks.length*100).toFixed(1)}%)`);
    console.log('');
    
    // Show some examples of tracks without publishers
    if (withoutPublisher.length > 0) {
      console.log('📋 Sample tracks without publishers:');
      withoutPublisher.slice(0, 10).forEach((track, i) => {
        console.log(`   ${i + 1}. ${track.title} (${track.artist || 'Unknown Artist'})`);
      });
      if (withoutPublisher.length > 10) {
        console.log(`   ... and ${withoutPublisher.length - 10} more`);
      }
    }
    
    // Show some examples of tracks with publishers
    if (withPublisher.length > 0) {
      console.log('');
      console.log('📋 Sample tracks with publishers:');
      withPublisher.slice(0, 5).forEach((track, i) => {
        console.log(`   ${i + 1}. ${track.title} - Publisher: ${track.publisher}`);
      });
    }
    
    // Check for feed URL patterns that might help identify publishers
    const uniqueFeedUrls = [...new Set(musicTracks.map(t => t.feedUrl).filter(Boolean))];
    console.log('');
    console.log(`🔗 Unique feed URLs: ${uniqueFeedUrls.length}`);
    console.log('📋 Sample feed URLs:');
    uniqueFeedUrls.slice(0, 5).forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
