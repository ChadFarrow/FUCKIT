#!/usr/bin/env node

/**
 * Normalize the music database
 * This script standardizes IDs, resolution status, and data formats
 */

const fs = require('fs');
const path = require('path');

function normalizeDatabase() {
  try {
    console.log('🔧 Starting database normalization...\n');
    
    // Create backup first
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const backupPath = musicDbPath + `.backup-normalize-${Date.now()}`;
    console.log(`💾 Creating backup at ${path.basename(backupPath)}`);
    fs.copyFileSync(musicDbPath, backupPath);
    
    // Load the database
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    const originalCount = musicData.musicTracks.length;
    
    console.log(`📊 Original database: ${originalCount} tracks\n`);
    
    // Statistics tracking
    let fixedIds = 0;
    let fixedResolutionStatus = 0;
    let normalizedTitles = 0;
    let fixedNullValues = 0;
    
    // Step 1: Normalize IDs to integers
    console.log('🔄 Step 1: Normalizing track IDs...');
    let nextId = 1;
    const usedIds = new Set();
    
    // First pass - collect existing numeric IDs to avoid conflicts
    musicData.musicTracks.forEach(track => {
      if (typeof track.id === 'number' && !isNaN(track.id)) {
        usedIds.add(track.id);
      }
    });
    
    // Find next available ID
    while (usedIds.has(nextId)) {
      nextId++;
    }
    
    // Second pass - normalize all IDs
    musicData.musicTracks.forEach(track => {
      const originalId = track.id;
      
      if (typeof track.id !== 'number' || isNaN(track.id)) {
        track.id = nextId;
        nextId++;
        fixedIds++;
      }
    });
    
    console.log(`   ✅ Fixed ${fixedIds} invalid IDs`);
    
    // Step 2: Normalize resolution status
    console.log('\n🔍 Step 2: Normalizing resolution status...');
    musicData.musicTracks.forEach(track => {
      // Fix null needsResolution values
      if (track.needsResolution === null || track.needsResolution === undefined) {
        // Determine if track is resolved based on available data
        const hasTitle = track.title && track.title !== 'Unknown' && 
                        !track.title.match(/^Track \d+$/) && 
                        track.title !== 'Track NaN';
        const hasArtist = track.artist && track.artist !== 'Unknown Artist';
        const hasAudioUrl = track.audioUrl && track.audioUrl.length > 10;
        
        // If track has good data, mark as resolved; otherwise needs resolution
        if (hasTitle && hasArtist && hasAudioUrl) {
          track.needsResolution = false;
          if (!track.resolvedAt) {
            track.resolvedAt = track.addedAt || new Date().toISOString();
          }
        } else if (track.feedGuid && track.itemGuid) {
          // Has remote item info but missing data - needs resolution
          track.needsResolution = true;
        } else {
          // No way to resolve - mark as false but incomplete
          track.needsResolution = false;
        }
        fixedResolutionStatus++;
      }
    });
    
    console.log(`   ✅ Fixed ${fixedResolutionStatus} resolution status values`);
    
    // Step 3: Clean up titles and basic data
    console.log('\n🧹 Step 3: Cleaning up track data...');
    musicData.musicTracks.forEach(track => {
      // Fix placeholder titles
      if (track.title === 'Track NaN' || track.title?.match(/^Track null$/)) {
        track.title = `Track ${track.id}`;
        normalizedTitles++;
      }
      
      // Ensure basic fields exist
      if (!track.title) {
        track.title = `Track ${track.id}`;
        fixedNullValues++;
      }
      if (!track.artist) {
        track.artist = 'Unknown Artist';
        fixedNullValues++;
      }
      if (!track.album) {
        track.album = 'Unknown Album';
        fixedNullValues++;
      }
      if (!track.addedAt) {
        track.addedAt = new Date().toISOString();
        fixedNullValues++;
      }
      if (track.duration === null || track.duration === undefined) {
        track.duration = 0;
        fixedNullValues++;
      }
    });
    
    console.log(`   ✅ Normalized ${normalizedTitles} titles`);
    console.log(`   ✅ Fixed ${fixedNullValues} null field values`);
    
    // Step 4: Update metadata
    console.log('\n📋 Step 4: Updating metadata...');
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.totalTracks = musicData.musicTracks.length;
    musicData.metadata.lastUpdated = new Date().toISOString();
    musicData.metadata.lastNormalized = new Date().toISOString();
    
    // Calculate final statistics
    const resolvedCount = musicData.musicTracks.filter(track => 
      track.needsResolution === false && 
      track.title !== `Track ${track.id}` && 
      track.artist !== 'Unknown Artist'
    ).length;
    
    const needsResolutionCount = musicData.musicTracks.filter(track => 
      track.needsResolution === true
    ).length;
    
    musicData.metadata.resolvedTracks = resolvedCount;
    musicData.metadata.pendingResolution = needsResolutionCount;
    musicData.metadata.resolutionRate = Math.round((resolvedCount / originalCount) * 100);
    
    // Save the normalized database
    fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
    
    // Print final summary
    const finalCount = musicData.musicTracks.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE NORMALIZATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY:`);
    console.log(`   📚 Total tracks: ${finalCount.toLocaleString()}`);
    console.log(`   ✅ Resolved tracks: ${resolvedCount.toLocaleString()} (${musicData.metadata.resolutionRate}%)`);
    console.log(`   ⏳ Pending resolution: ${needsResolutionCount.toLocaleString()}`);
    console.log('');
    console.log('🔧 FIXES APPLIED:');
    console.log(`   🆔 Fixed track IDs: ${fixedIds}`);
    console.log(`   ✅ Fixed resolution status: ${fixedResolutionStatus}`);
    console.log(`   📝 Normalized titles: ${normalizedTitles}`);
    console.log(`   🔧 Fixed null values: ${fixedNullValues}`);
    console.log('='.repeat(60));
    
    console.log('\n✨ Database is now normalized and consistent!');
    
  } catch (error) {
    console.error('❌ Error during normalization:', error);
    process.exit(1);
  }
}

// Run the normalization
if (require.main === module) {
  normalizeDatabase();
}

module.exports = { normalizeDatabase };