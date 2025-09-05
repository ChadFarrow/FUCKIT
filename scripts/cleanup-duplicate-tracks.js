#!/usr/bin/env node

/**
 * Cleanup duplicate tracks and fix invalid IDs in the music database
 * This script handles:
 * 1. Exact duplicates (same feedGuid + itemGuid)
 * 2. Invalid IDs (null, undefined, NaN)
 * 3. Potential duplicates (similar title + artist)
 */

const fs = require('fs');
const path = require('path');

function cleanupDatabase() {
  try {
    console.log('🧹 Starting database cleanup...\n');
    
    // Create backup first
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const backupPath = musicDbPath + `.backup-cleanup-${Date.now()}`;
    console.log(`💾 Creating backup at ${path.basename(backupPath)}`);
    fs.copyFileSync(musicDbPath, backupPath);
    
    // Load the database
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    const originalCount = musicData.musicTracks.length;
    
    console.log(`📊 Original database: ${originalCount} tracks\n`);
    
    // Step 1: Remove exact duplicates (same feedGuid + itemGuid)
    console.log('🔄 Step 1: Removing exact duplicates...');
    const guidMap = new Map();
    const exactDuplicatesRemoved = [];
    
    musicData.musicTracks = musicData.musicTracks.filter((track, index) => {
      if (track.feedGuid && track.itemGuid) {
        const key = `${track.feedGuid}:${track.itemGuid}`;
        
        if (guidMap.has(key)) {
          const existing = guidMap.get(key);
          
          // Keep the one with more complete data
          const currentComplete = getCompletenessScore(track);
          const existingComplete = getCompletenessScore(existing);
          
          if (currentComplete > existingComplete) {
            // Current track is better, replace the existing one
            exactDuplicatesRemoved.push(existing);
            const existingIndex = musicData.musicTracks.findIndex(t => t === existing);
            musicData.musicTracks[existingIndex] = track;
            guidMap.set(key, track);
            return false; // Remove current from this position
          } else {
            // Existing is better or equal, merge sources
            mergeSources(existing, track);
            exactDuplicatesRemoved.push(track);
            return false; // Remove current track
          }
        } else {
          guidMap.set(key, track);
          return true; // Keep this track
        }
      }
      return true; // Keep tracks without feedGuid/itemGuid
    });
    
    console.log(`   ✅ Removed ${exactDuplicatesRemoved.length} exact duplicates`);
    
    // Step 2: Fix invalid IDs
    console.log('\n🔧 Step 2: Fixing invalid IDs...');
    let nextValidId = Math.max(...musicData.musicTracks
      .map(track => typeof track.id === 'number' ? track.id : 0)
      .filter(id => !isNaN(id)), 0) + 1;
    
    let fixedIds = 0;
    
    musicData.musicTracks.forEach(track => {
      const hasInvalidId = track.id === null || track.id === undefined || 
        (typeof track.id === 'string' && (track.id.includes('null') || track.id.includes('NaN') || track.id === 'undefined')) ||
        (typeof track.id === 'number' && isNaN(track.id));
      
      if (hasInvalidId) {
        track.id = nextValidId++;
        fixedIds++;
      }
    });
    
    console.log(`   ✅ Fixed ${fixedIds} invalid IDs`);
    
    // Step 3: Handle potential duplicates (similar title + artist)
    console.log('\n🔍 Step 3: Merging potential duplicates...');
    const titleArtistMap = new Map();
    const potentialDuplicatesRemoved = [];
    
    musicData.musicTracks = musicData.musicTracks.filter(track => {
      if (track.title && track.title !== 'Unknown' && track.title.length > 3 && 
          track.artist && track.artist !== 'Unknown Artist' && track.artist.length > 2) {
        
        const normalizedTitle = track.title.toLowerCase().trim()
          .replace(/[^a-z0-9]/g, '')
          .replace(/feat.*$/, '') // Remove featuring parts
          .replace(/remix.*$/, '') // Remove remix info
          .replace(/live.*$/, ''); // Remove live info
        const normalizedArtist = track.artist.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const key = `${normalizedArtist}:${normalizedTitle}`;
        
        if (titleArtistMap.has(key)) {
          const existing = titleArtistMap.get(key);
          
          // Only merge if they're not the same exact track (different feedGuid/itemGuid)
          const sameSource = track.feedGuid === existing.feedGuid && track.itemGuid === existing.itemGuid;
          if (!sameSource) {
            const currentComplete = getCompletenessScore(track);
            const existingComplete = getCompletenessScore(existing);
            
            if (currentComplete > existingComplete) {
              // Current is better, replace existing
              const existingIndex = musicData.musicTracks.findIndex(t => t === existing);
              mergeSources(track, existing);
              musicData.musicTracks[existingIndex] = track;
              titleArtistMap.set(key, track);
              potentialDuplicatesRemoved.push(existing);
              return false; // Remove current from this position
            } else {
              // Existing is better, merge sources
              mergeSources(existing, track);
              potentialDuplicatesRemoved.push(track);
              return false; // Remove current track
            }
          }
        } else {
          titleArtistMap.set(key, track);
        }
      }
      return true; // Keep this track
    });
    
    console.log(`   ✅ Merged ${potentialDuplicatesRemoved.length} potential duplicates`);
    
    // Step 4: Clean up and reindex
    console.log('\n🧹 Step 4: Final cleanup...');
    
    // Remove any remaining tracks with critical issues
    const beforeCleanup = musicData.musicTracks.length;
    musicData.musicTracks = musicData.musicTracks.filter(track => {
      // Remove tracks that are clearly broken
      return track.title && track.title.trim().length > 0 && track.title !== 'null' && track.title !== 'undefined';
    });
    const cleanupRemoved = beforeCleanup - musicData.musicTracks.length;
    
    if (cleanupRemoved > 0) {
      console.log(`   ✅ Removed ${cleanupRemoved} tracks with critical data issues`);
    }
    
    // Update metadata
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.totalTracks = musicData.musicTracks.length;
    musicData.metadata.lastUpdated = new Date().toISOString();
    musicData.metadata.lastCleanup = new Date().toISOString();
    
    // Save the cleaned database
    fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
    
    // Print final summary
    const finalCount = musicData.musicTracks.length;
    const totalRemoved = originalCount - finalCount;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE CLEANUP COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY:`);
    console.log(`   📚 Original tracks: ${originalCount.toLocaleString()}`);
    console.log(`   ✅ Final tracks: ${finalCount.toLocaleString()}`);
    console.log(`   🗑️  Total removed: ${totalRemoved.toLocaleString()}`);
    console.log(`   📈 Reduction: ${Math.round((totalRemoved / originalCount) * 100)}%`);
    console.log('');
    console.log('📋 BREAKDOWN:');
    console.log(`   🔄 Exact duplicates: ${exactDuplicatesRemoved.length}`);
    console.log(`   🔧 Fixed invalid IDs: ${fixedIds}`);
    console.log(`   🔍 Merged similar tracks: ${potentialDuplicatesRemoved.length}`);
    console.log(`   🧹 Critical issues: ${cleanupRemoved}`);
    console.log('='.repeat(60));
    
    // Verify final database integrity
    console.log('\n🔍 Verifying database integrity...');
    const finalCheck = verifyDatabase(musicData.musicTracks);
    
    if (finalCheck.issues === 0) {
      console.log('✅ Database integrity verified - no issues found!');
    } else {
      console.log(`⚠️  Found ${finalCheck.issues} remaining issues to address manually`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Helper function to calculate completeness score
function getCompletenessScore(track) {
  let score = 0;
  
  if (track.title && track.title !== 'Unknown' && track.title.length > 3) score += 2;
  if (track.artist && track.artist !== 'Unknown Artist' && track.artist.length > 2) score += 2;
  if (track.album && track.album !== 'Unknown Album') score += 1;
  if (track.audioUrl && track.audioUrl.length > 10) score += 3;
  if (track.artwork || track.image) score += 1;
  if (track.duration && track.duration > 0) score += 1;
  if (track.publishDate) score += 1;
  if (track.feedTitle && track.feedTitle.length > 2) score += 1;
  if (!track.needsResolution) score += 2; // Resolved tracks are more complete
  
  return score;
}

// Helper function to merge sources
function mergeSources(keepTrack, removeTrack) {
  if (removeTrack.source) {
    const keepSources = keepTrack.source ? keepTrack.source.split(', ') : [];
    const removeSources = removeTrack.source.split(', ');
    
    // Add unique sources
    removeSources.forEach(source => {
      if (!keepSources.includes(source.trim())) {
        keepSources.push(source.trim());
      }
    });
    
    keepTrack.source = keepSources.join(', ');
  }
  
  // Also merge any missing data
  if (!keepTrack.audioUrl && removeTrack.audioUrl) keepTrack.audioUrl = removeTrack.audioUrl;
  if (!keepTrack.artwork && removeTrack.artwork) keepTrack.artwork = removeTrack.artwork;
  if (!keepTrack.image && removeTrack.image) keepTrack.image = removeTrack.image;
  if (!keepTrack.duration && removeTrack.duration) keepTrack.duration = removeTrack.duration;
  if (!keepTrack.publishDate && removeTrack.publishDate) keepTrack.publishDate = removeTrack.publishDate;
}

// Helper function to verify database integrity
function verifyDatabase(tracks) {
  let issues = 0;
  
  // Check for remaining invalid IDs
  const invalidIds = tracks.filter(track => 
    track.id === null || track.id === undefined || 
    (typeof track.id === 'number' && isNaN(track.id))
  );
  issues += invalidIds.length;
  
  // Check for remaining exact duplicates
  const guidMap = new Set();
  const duplicates = tracks.filter(track => {
    if (track.feedGuid && track.itemGuid) {
      const key = `${track.feedGuid}:${track.itemGuid}`;
      if (guidMap.has(key)) {
        return true;
      }
      guidMap.add(key);
    }
    return false;
  });
  issues += duplicates.length;
  
  return { issues, invalidIds: invalidIds.length, duplicates: duplicates.length };
}

// Run the cleanup
if (require.main === module) {
  cleanupDatabase();
}

module.exports = { cleanupDatabase };