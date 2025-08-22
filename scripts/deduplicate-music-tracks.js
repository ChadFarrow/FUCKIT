#!/usr/bin/env node

/**
 * Music Tracks Deduplication
 * 
 * Removes duplicate tracks from music-tracks.json based on title and artist
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MUSIC_TRACKS_PATH = path.join(DATA_DIR, 'music-tracks.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

console.log('🔍 Music Tracks Deduplication\n');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `music-tracks-backup-${timestamp}.json`);
fs.copyFileSync(MUSIC_TRACKS_PATH, backupPath);
console.log(`✅ Created backup: ${backupPath}`);

// Read music tracks
let musicData;
try {
  musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
  const musicTracks = musicData.musicTracks || musicData;
  console.log(`📀 Loaded ${musicTracks.length} tracks`);
} catch (error) {
  console.error('❌ Error reading music-tracks.json:', error.message);
  process.exit(1);
}

const musicTracks = musicData.musicTracks || musicData;

// Find duplicates
const seen = new Map();
const duplicates = [];
const uniqueTracks = [];

musicTracks.forEach((track, index) => {
  const title = (track.title || '').trim();
  const artist = (track.artist || track.feedArtist || '').trim();
  
  if (!title || !artist) {
    // Keep tracks with missing title/artist for now
    uniqueTracks.push(track);
    return;
  }
  
  const key = `${title}|${artist}`.toLowerCase();
  
  if (seen.has(key)) {
    const existing = seen.get(key);
    duplicates.push({
      duplicate: track,
      original: existing,
      title: title,
      artist: artist,
      duplicateIndex: index,
      originalIndex: existing.index
    });
  } else {
    track.index = index; // Store original index
    seen.set(key, track);
    uniqueTracks.push(track);
  }
});

console.log(`\n📊 Duplication Analysis:`);
console.log(`   Original tracks: ${musicTracks.length}`);
console.log(`   Unique tracks: ${uniqueTracks.length}`);
console.log(`   Duplicates found: ${duplicates.length}`);
console.log(`   Tracks to remove: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log(`\n🔄 Duplicates to remove:`);
  duplicates.slice(0, 10).forEach(dup => {
    console.log(`   • "${dup.title}" by ${dup.artist} (${dup.duplicateIndex})`);
  });
  
  if (duplicates.length > 10) {
    console.log(`   ... and ${duplicates.length - 10} more`);
  }
  
  // Remove duplicates from uniqueTracks (they were added above)
  const finalUniqueTracks = uniqueTracks.filter(track => {
    return !duplicates.some(dup => dup.duplicate === track);
  });
  
  console.log(`\n✅ Final unique tracks: ${finalUniqueTracks.length}`);
  
  // Save deduplicated data
  const deduplicatedData = {
    ...musicData,
    musicTracks: finalUniqueTracks
  };
  
  fs.writeFileSync(MUSIC_TRACKS_PATH, JSON.stringify(deduplicatedData, null, 2));
  console.log(`💾 Saved deduplicated data to ${MUSIC_TRACKS_PATH}`);
  
  // Save detailed report
  const reportPath = path.join(DATA_DIR, `deduplication-report-${timestamp}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    originalCount: musicTracks.length,
    finalCount: finalUniqueTracks.length,
    duplicatesRemoved: duplicates.length,
    duplicates: duplicates.map(dup => ({
      title: dup.title,
      artist: dup.artist,
      duplicateIndex: dup.duplicateIndex,
      originalIndex: dup.originalIndex
    }))
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 Saved detailed report to ${reportPath}`);
  
} else {
  console.log(`\n✅ No duplicates found! Database is already clean.`);
}

console.log(`\n💡 Next steps:`);
console.log(`   • Run: node scripts/batch-resolve-308-optimized.js (fix missing audio URLs)`);
console.log(`   • Run: node scripts/fetch-missing-publishers.js (add publisher info)`);
console.log(`   • Run: node scripts/search-podcastindex-for-artwork.js (find missing artwork)`);
