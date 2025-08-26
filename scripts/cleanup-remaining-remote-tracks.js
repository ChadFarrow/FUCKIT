#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupRemainingRemoteTracks() {
    console.log('🧹 Cleaning Up Remaining Remote Tracks\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-cleanup-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find remaining remote tracks
    const remainingRemoteTracks = musicData.musicTracks.filter(track => 
        track.title && (
            track.title.includes('Remote Track') || 
            track.title === 'Unresolved Remote Track'
        )
    );
    
    console.log(`Found ${remainingRemoteTracks.length} remaining remote tracks\n`);
    
    if (remainingRemoteTracks.length === 0) {
        console.log('✅ No remote tracks to clean up');
        return;
    }
    
    let removedCount = 0;
    let updatedCount = 0;
    
    // Process each remaining remote track
    remainingRemoteTracks.forEach((track, index) => {
        console.log(`🎵 [${index + 1}/${remainingRemoteTracks.length}] Processing: ${track.title}`);
        console.log(`   Feed GUID: ${track.feedGuid || 'None'}`);
        console.log(`   Source: ${track.source || 'Unknown'}`);
        
        // Decision logic for cleanup
        if (!track.feedGuid || track.feedGuid === 'Unknown' || 
            !track.itemGuid || track.itemGuid === 'Unknown') {
            // Remove tracks with no valid identifiers
            const trackIndex = musicData.musicTracks.indexOf(track);
            musicData.musicTracks.splice(trackIndex, 1);
            console.log(`   ❌ Removed (no valid identifiers)\n`);
            removedCount++;
        } else {
            // Update with generic but clean information
            const itemGuid = typeof track.itemGuid === 'string' ? track.itemGuid : track.itemGuid?._ || 'unknown';
            track.title = `Unindexed Music Track`;
            track.artist = 'Independent Artist';
            track.album = 'Independent Release';
            track.description = 'This track is from an independent artist not yet indexed in the Podcast Index.';
            
            // Mark for potential future resolution
            track.requiresManualResolution = true;
            track.lastCleanup = new Date().toISOString();
            
            // Remove resolution flags
            delete track.needsResolution;
            delete track.resolutionFailed;
            
            console.log(`   ✅ Updated to generic format\n`);
            updatedCount++;
        }
    });
    
    // Update metadata
    musicData.metadata.lastCleanup = {
        date: new Date().toISOString(),
        removedTracks: removedCount,
        updatedTracks: updatedCount,
        source: 'Remote Tracks Cleanup'
    };
    
    musicData.metadata.lastUpdated = new Date().toISOString();
    
    // Save the cleaned data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('=' .repeat(50));
    console.log('📊 Cleanup Summary:');
    console.log(`  ❌ Removed tracks: ${removedCount}`);
    console.log(`  ✅ Updated tracks: ${updatedCount}`);
    console.log(`  📚 Total tracks remaining: ${musicData.musicTracks.length}`);
    
    console.log('\n✨ Cleanup complete!');
    console.log('🎵 All "Remote Track [GUID]" entries have been resolved or cleaned up.');
    console.log('💡 Use the smart-remote-item-importer.js for future imports to avoid this issue.');
}

// Run the cleanup
cleanupRemainingRemoteTracks();