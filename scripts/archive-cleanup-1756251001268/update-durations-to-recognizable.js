#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateDurationsToRecognizable() {
    console.log('⏱️  Updating Default Durations to Recognizable Pattern (2:22)\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-duration-update-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with default assigned duration (180 seconds = 3:00)
    const tracksWithDefaultDuration = musicData.musicTracks.filter(track => 
        track.duration === 180 &&
        track.durationSource &&
        track.durationSource.method === 'default-assignment'
    );
    
    console.log(`Found ${tracksWithDefaultDuration.length} tracks with default 3:00 duration to update\n`);
    
    if (tracksWithDefaultDuration.length === 0) {
        console.log('✅ No tracks with default duration found');
        return;
    }
    
    let updatedCount = 0;
    
    // Update to 2:22 (142 seconds) for easy recognition
    for (const track of tracksWithDefaultDuration) {
        track.duration = 142; // 2:22 in seconds
        track.durationSource = {
            method: 'placeholder-duration',
            reason: 'recognizable placeholder (2:22)',
            assignedDate: new Date().toISOString(),
            note: 'This duration indicates missing/estimated metadata'
        };
        
        updatedCount++;
        console.log(`🔄 "${track.title}" by ${track.artist}: updated to 2:22 (placeholder)`);
    }
    
    // Update metadata
    musicData.metadata.lastDurationUpdate = {
        date: new Date().toISOString(),
        tracksUpdated: updatedCount,
        method: 'Placeholder Duration Pattern',
        newDuration: '2:22 (142 seconds)',
        purpose: 'Easy identification of estimated durations'
    };
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Duration Update Summary:');
    console.log(`  🔄 Tracks updated: ${updatedCount}`);
    console.log(`  ⏱️  New duration: 2:22 (easily recognizable as placeholder)`);
    console.log(`  🎯 Purpose: Identify tracks that need real duration metadata`);
    
    // Calculate coverage with new pattern
    const totalTracks = musicData.musicTracks.length;
    const tracksWithDuration = musicData.musicTracks.filter(track => track.duration && track.duration > 0).length;
    const tracksWithRealDuration = musicData.musicTracks.filter(track => 
        track.duration && track.duration > 0 && track.duration !== 142
    ).length;
    const tracksWithPlaceholder = musicData.musicTracks.filter(track => track.duration === 142).length;
    
    console.log('\n📊 Duration Coverage Breakdown:');
    console.log(`  ✅ Real durations: ${tracksWithRealDuration} tracks`);
    console.log(`  🔄 Placeholder (2:22): ${tracksWithPlaceholder} tracks`);
    console.log(`  ❌ No duration: ${totalTracks - tracksWithDuration} tracks`);
    console.log(`  📈 Total coverage: ${((tracksWithDuration / totalTracks) * 100).toFixed(1)}%`);
    
    console.log('\n✨ Duration pattern update complete!');
    console.log('🎯 All tracks showing 2:22 duration need real metadata.');
}

// Run the update
updateDurationsToRecognizable();