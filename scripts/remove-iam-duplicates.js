#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function removeDuplicatesAndFixMetadata() {
    console.log('🔍 Removing IAM Playlist Duplicates and Fixing Metadata\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-dedup-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    const originalCount = musicData.musicTracks.length;
    console.log(`📊 Original track count: ${originalCount}\n`);
    
    // Group tracks by artist and title to find duplicates
    const trackGroups = {};
    
    musicData.musicTracks.forEach(track => {
        const key = `${track.artist}|||${track.title}`.toLowerCase();
        if (!trackGroups[key]) {
            trackGroups[key] = [];
        }
        trackGroups[key].push(track);
    });
    
    // Find duplicates
    const duplicateGroups = Object.entries(trackGroups).filter(([key, tracks]) => tracks.length > 1);
    console.log(`🔍 Found ${duplicateGroups.length} groups with duplicates:\n`);
    
    let removedCount = 0;
    let updatedCount = 0;
    const tracksToKeep = [];
    const processedKeys = new Set();
    
    // Process each track
    musicData.musicTracks.forEach(track => {
        const key = `${track.artist}|||${track.title}`.toLowerCase();
        
        if (processedKeys.has(key)) {
            // Already processed this group
            return;
        }
        
        const duplicates = trackGroups[key];
        
        if (duplicates.length === 1) {
            // No duplicates, keep the track
            tracksToKeep.push(track);
        } else {
            // Handle duplicates
            console.log(`🎵 Processing duplicates for: "${track.title}" by ${track.artist}`);
            
            // Separate IAM imports from originals
            const iamTracks = duplicates.filter(t => t.source === 'IAM Playlist Import');
            const originalTracks = duplicates.filter(t => t.source !== 'IAM Playlist Import');
            
            let trackToKeep = null;
            
            if (originalTracks.length > 0) {
                // Keep the original track, merge any missing metadata from IAM
                trackToKeep = originalTracks[0]; // Use first original
                
                // Check if IAM track has better metadata
                if (iamTracks.length > 0) {
                    const iamTrack = iamTracks[0];
                    
                    // Merge missing metadata from IAM track
                    if (!trackToKeep.artwork && iamTrack.artwork && iamTrack.artwork !== '/api/placeholder/300/300') {
                        trackToKeep.artwork = iamTrack.artwork;
                        console.log(`    📷 Updated artwork from IAM track`);
                    }
                    
                    if (!trackToKeep.audioUrl && iamTrack.audioUrl) {
                        trackToKeep.audioUrl = iamTrack.audioUrl;
                        console.log(`    🎧 Updated audio URL from IAM track`);
                    }
                    
                    if ((!trackToKeep.duration || trackToKeep.duration === 0) && iamTrack.duration) {
                        trackToKeep.duration = iamTrack.duration;
                        console.log(`    ⏱️  Updated duration from IAM track`);
                    }
                    
                    if (!trackToKeep.feedId && iamTrack.feedId) {
                        trackToKeep.feedId = iamTrack.feedId;
                        trackToKeep.feedTitle = iamTrack.feedTitle;
                        trackToKeep.feedUrl = iamTrack.feedUrl;
                        console.log(`    📡 Updated feed info from IAM track`);
                    }
                    
                    if (!trackToKeep.value && iamTrack.value) {
                        trackToKeep.value = iamTrack.value;
                        console.log(`    💰 Updated V4V info from IAM track`);
                    }
                }
                
                console.log(`    ✅ Keeping original track, removing ${iamTracks.length} IAM duplicates`);
                removedCount += iamTracks.length;
                
                if (iamTracks.length > 0) {
                    updatedCount++;
                }
            } else {
                // No original track, keep the first IAM track
                trackToKeep = iamTracks[0];
                console.log(`    ✅ Keeping IAM track (no original found), removing ${iamTracks.length - 1} duplicates`);
                removedCount += iamTracks.length - 1;
            }
            
            tracksToKeep.push(trackToKeep);
        }
        
        processedKeys.add(key);
    });
    
    // Update the music data
    musicData.musicTracks = tracksToKeep;
    
    // Update metadata
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.lastUpdated = new Date().toISOString();
    musicData.metadata.lastDeduplication = {
        date: new Date().toISOString(),
        originalCount: originalCount,
        finalCount: tracksToKeep.length,
        removedCount: removedCount,
        updatedCount: updatedCount
    };
    
    // Save the cleaned data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Deduplication Summary:');
    console.log(`  🔢 Original tracks: ${originalCount}`);
    console.log(`  🗑️  Removed duplicates: ${removedCount}`);
    console.log(`  📝 Updated with metadata: ${updatedCount}`);
    console.log(`  ✅ Final track count: ${tracksToKeep.length}`);
    console.log(`  💾 Saved ${originalCount - tracksToKeep.length} database entries`);
    
    console.log('\n✨ Database cleanup complete!');
    console.log('🎵 All tracks should now display properly without duplicates.');
}

// Run the deduplication
removeDuplicatesAndFixMetadata();