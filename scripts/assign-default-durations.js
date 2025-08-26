#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function assignDefaultDurations() {
    console.log('⏱️  Assigning Default Durations to Real Tracks\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-duration-assignment-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find real tracks missing duration
    const tracksNeedingDuration = musicData.musicTracks.filter(track => 
        (!track.duration || track.duration === 0) &&
        track.title && 
        track.artist &&
        track.artist !== 'Unknown Artist' &&
        track.artist !== 'Independent Artist' &&
        !track.title.startsWith('Track ') &&
        !track.title.startsWith('Unindexed') &&
        track.title !== 'Unknown Track'
    );
    
    console.log(`Found ${tracksNeedingDuration.length} real tracks missing duration\n`);
    
    if (tracksNeedingDuration.length === 0) {
        console.log('✅ All real tracks already have duration');
        return;
    }
    
    let assignedCount = 0;
    
    // Assign durations based on track characteristics
    for (const track of tracksNeedingDuration) {
        let defaultDuration = 0;
        let reason = '';
        
        // Check for duration hints in title
        const durationRegex = /\((\d{1,2}):(\d{2})\)/;
        const match = track.title.match(durationRegex);
        
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            defaultDuration = minutes * 60 + seconds;
            reason = 'extracted from title';
        }
        // Special cases based on title keywords
        else if (track.title.toLowerCase().includes('intro') || 
                 track.title.toLowerCase().includes('interlude')) {
            defaultDuration = 45; // 45 seconds
            reason = 'intro/interlude estimate';
        }
        else if (track.title.toLowerCase().includes('outro')) {
            defaultDuration = 90; // 1.5 minutes
            reason = 'outro estimate';
        }
        // Genre-based estimates
        else if (track.genre && track.genre.toLowerCase().includes('ambient')) {
            defaultDuration = 300; // 5 minutes for ambient
            reason = 'ambient music estimate';
        }
        else if (track.genre && track.genre.toLowerCase().includes('classical')) {
            defaultDuration = 240; // 4 minutes for classical
            reason = 'classical music estimate';
        }
        // Default music track duration
        else {
            defaultDuration = 180; // 3 minutes
            reason = 'standard track estimate';
        }
        
        // Sanity check
        if (defaultDuration < 15 || defaultDuration > 1800) {
            defaultDuration = 180; // Fall back to 3 minutes
            reason = 'fallback estimate';
        }
        
        track.duration = defaultDuration;
        track.durationSource = {
            method: 'default-assignment',
            reason: reason,
            assignedDate: new Date().toISOString()
        };
        
        assignedCount++;
        
        console.log(`✅ "${track.title}" by ${track.artist}: ${Math.floor(defaultDuration / 60)}:${String(defaultDuration % 60).padStart(2, '0')} (${reason})`);
    }
    
    // Update metadata
    musicData.metadata.lastDurationAssignment = {
        date: new Date().toISOString(),
        tracksProcessed: assignedCount,
        method: 'Smart Default Assignment',
        averageDuration: Math.round(tracksNeedingDuration.reduce((sum, track) => sum + track.duration, 0) / tracksNeedingDuration.length)
    };
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Duration Assignment Summary:');
    console.log(`  ✅ Tracks assigned duration: ${assignedCount}`);
    console.log(`  ⏱️  Average assigned duration: ${Math.floor(musicData.metadata.lastDurationAssignment.averageDuration / 60)}:${String(musicData.metadata.lastDurationAssignment.averageDuration % 60).padStart(2, '0')}`);
    
    // Calculate new coverage
    const totalTracks = musicData.musicTracks.length;
    const tracksWithDuration = musicData.musicTracks.filter(track => track.duration && track.duration > 0).length;
    const durationCoverage = (tracksWithDuration / totalTracks * 100).toFixed(1);
    
    console.log(`  📈 New duration coverage: ${durationCoverage}% (${tracksWithDuration}/${totalTracks})`);
    
    console.log('\n✨ Default duration assignment complete!');
}

// Run the assignment
assignDefaultDurations();