#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateDurationTo9999() {
    console.log('⏱️  Updating Placeholder Durations to 99:99\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-duration-9999-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with placeholder duration (142 seconds = 2:22)
    const tracksWithPlaceholderDuration = musicData.musicTracks.filter(track => 
        track.duration === 142 &&
        track.durationSource &&
        track.durationSource.method === 'placeholder-duration'
    );
    
    console.log(`Found ${tracksWithPlaceholderDuration.length} tracks with 2:22 placeholder duration to update\n`);
    
    if (tracksWithPlaceholderDuration.length === 0) {
        console.log('✅ No tracks with placeholder duration found');
        return;
    }
    
    let updatedCount = 0;
    
    // Update to 99:99 (5999 seconds)
    for (const track of tracksWithPlaceholderDuration) {
        track.duration = 5999; // 99:59 in seconds (max for 99:99 display)
        track.durationSource = {
            method: 'placeholder-duration',
            reason: 'highly recognizable placeholder (99:99)',
            assignedDate: new Date().toISOString(),
            note: 'This duration clearly indicates missing/estimated metadata'
        };
        
        updatedCount++;
        console.log(`🔄 "${track.title}" by ${track.artist}: updated to 99:99 (placeholder)`);
    }
    
    // Update metadata
    musicData.metadata.lastDuration9999Update = {
        date: new Date().toISOString(),
        tracksUpdated: updatedCount,
        method: 'Highly Visible Placeholder Duration',
        newDuration: '99:99 (5999 seconds)',
        purpose: 'Extremely obvious indicator of missing duration metadata'
    };
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Duration Update Summary:');
    console.log(`  🔄 Tracks updated: ${updatedCount}`);
    console.log(`  ⏱️  New duration: 99:99 (impossible to miss as placeholder)`);
    console.log(`  🎯 Purpose: Highly visible indicator of tracks needing real duration`);
    
    // Calculate coverage with new pattern
    const totalTracks = musicData.musicTracks.length;
    const tracksWithDuration = musicData.musicTracks.filter(track => track.duration && track.duration > 0).length;
    const tracksWithRealDuration = musicData.musicTracks.filter(track => 
        track.duration && track.duration > 0 && track.duration !== 5999
    ).length;
    const tracksWithPlaceholder = musicData.musicTracks.filter(track => track.duration === 5999).length;
    
    console.log('\n📊 Duration Coverage Breakdown:');
    console.log(`  ✅ Real durations: ${tracksWithRealDuration} tracks`);
    console.log(`  🔄 Placeholder (99:99): ${tracksWithPlaceholder} tracks`);
    console.log(`  ❌ No duration: ${totalTracks - tracksWithDuration} tracks`);
    console.log(`  📈 Total coverage: ${((tracksWithDuration / totalTracks) * 100).toFixed(1)}%`);
    
    console.log('\n✨ Duration pattern update complete!');
    console.log('🎯 All tracks showing 99:99 duration DEFINITELY need real metadata.');
}

// Run the update
updateDurationTo9999();