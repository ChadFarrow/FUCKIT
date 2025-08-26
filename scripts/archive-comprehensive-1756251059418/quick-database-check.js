#!/usr/bin/env node

/**
 * Quick Database Check
 * 
 * This script analyzes the music database for missing and duplicate items
 * without requiring external dependencies.
 */

const fs = require('fs');
const path = require('path');

// Database file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const MUSIC_TRACKS_FILE = path.join(DATA_DIR, 'music-tracks.json');
const ALBUMS_MISSING_ARTWORK_FILE = path.join(DATA_DIR, 'albums-missing-artwork.json');
const ALBUMS_WITHOUT_PUBLISHER_FILE = path.join(DATA_DIR, 'albums-without-publisher.json');

async function checkDatabase() {
  console.log('🔍 Quick Database Check\n');
  
  try {
    // Check if files exist
    const files = [
      { name: 'Music Tracks', path: MUSIC_TRACKS_FILE },
      { name: 'Albums Missing Artwork', path: ALBUMS_MISSING_ARTWORK_FILE },
      { name: 'Albums Without Publisher', path: ALBUMS_WITHOUT_PUBLISHER_FILE }
    ];
    
    console.log('📁 File Status:');
    files.forEach(file => {
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ ${file.name}: ${sizeMB} MB`);
      } else {
        console.log(`❌ ${file.name}: Missing`);
      }
    });
    
    console.log('\n📊 Database Analysis:');
    
    // Load music tracks
    if (fs.existsSync(MUSIC_TRACKS_FILE)) {
      const musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_FILE, 'utf8'));
      const musicTracks = musicData.musicTracks || musicData;
      console.log(`📀 Total Music Tracks: ${musicTracks.length}`);
      
      // Check for duplicates by title and artist
      const duplicates = findDuplicates(musicTracks);
      console.log(`🔄 Duplicate Tracks Found: ${duplicates.length}`);
      
      if (duplicates.length > 0) {
        console.log('\n🔄 Sample Duplicates:');
        duplicates.slice(0, 5).forEach(dup => {
          console.log(`   • ${dup.title} by ${dup.artist} (${dup.count} instances)`);
        });
      }
      
      // Check for missing artwork
      const missingArtwork = musicTracks.filter(track => 
        !track.artworkUrl || track.artworkUrl === '' || track.artworkUrl.includes('placeholder')
      );
      console.log(`🖼️  Tracks Missing Artwork: ${missingArtwork.length}`);
      
      // Check for missing publishers
      const missingPublisher = musicTracks.filter(track => 
        !track.publisher || track.publisher === '' || track.publisher === 'Unknown'
      );
      console.log(`🏢 Tracks Missing Publisher: ${missingPublisher.length}`);
      
      // Check for missing audio URLs
      const missingAudio = musicTracks.filter(track => 
        !track.audioUrl || track.audioUrl === ''
      );
      console.log(`🎵 Tracks Missing Audio URL: ${missingAudio.length}`);
      
      // Check for missing durations
      const missingDuration = musicTracks.filter(track => 
        !track.duration || track.duration === 0
      );
      console.log(`⏱️  Tracks Missing Duration: ${missingDuration.length}`);
    }
    
    // Load albums missing artwork
    if (fs.existsSync(ALBUMS_MISSING_ARTWORK_FILE)) {
      const missingArtwork = JSON.parse(fs.readFileSync(ALBUMS_MISSING_ARTWORK_FILE, 'utf8'));
      console.log(`\n🖼️  Albums Missing Artwork: ${missingArtwork.length}`);
      
      if (missingArtwork.length > 0) {
        console.log('   Sample albums:');
        missingArtwork.slice(0, 5).forEach(album => {
          console.log(`   • ${album.title} by ${album.artist}`);
        });
      }
    }
    
    // Load albums without publisher
    if (fs.existsSync(ALBUMS_WITHOUT_PUBLISHER_FILE)) {
      const missingPublisher = JSON.parse(fs.readFileSync(ALBUMS_WITHOUT_PUBLISHER_FILE, 'utf8'));
      console.log(`\n🏢 Albums Without Publisher: ${missingPublisher.length}`);
      
      if (missingPublisher.length > 0) {
        console.log('   Sample albums:');
        missingPublisher.slice(0, 5).forEach(album => {
          console.log(`   • ${album.title} by ${album.artist}`);
        });
      }
    }
    
    console.log('\n💡 Recommendations:');
    console.log('• Run deduplication scripts to remove duplicate tracks');
    console.log('• Use artwork search scripts to find missing artwork');
    console.log('• Check publisher feeds for missing publisher information');
    console.log('• Validate audio URLs and durations');
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

function findDuplicates(tracks) {
  const seen = new Map();
  const duplicates = [];
  
  tracks.forEach(track => {
    const key = `${track.title || ''}-${track.artist || ''}`.toLowerCase();
    if (seen.has(key)) {
      seen.get(key).count++;
    } else {
      seen.set(key, { title: track.title, artist: track.artist, count: 1 });
    }
  });
  
  // Return only items with count > 1
  for (const [key, value] of seen) {
    if (value.count > 1) {
      duplicates.push(value);
    }
  }
  
  return duplicates;
}

// Run the check
checkDatabase();
