#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseDurationString(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0;
    
    // Handle HH:MM:SS or MM:SS format
    const parts = durationStr.split(':').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 1) {
        return parts[0]; // Just seconds
    }
    
    return 0;
}

function parseDurationStrings() {
    console.log('⏱️  Parsing String Duration Values\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-parse-durations-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with string durations
    const stringDurationTracks = musicData.musicTracks.filter(track => 
        track.duration && typeof track.duration === 'string' && track.duration.includes(':')
    );
    
    console.log(`Found ${stringDurationTracks.length} tracks with string durations to parse\n`);
    
    if (stringDurationTracks.length === 0) {
        console.log('✅ No string durations need parsing');
        return;
    }
    
    let parsedCount = 0;
    let failedCount = 0;
    
    stringDurationTracks.forEach((track, index) => {
        const originalDuration = track.duration;
        const parsedDuration = parseDurationString(track.duration);
        
        console.log(`[${index + 1}/${stringDurationTracks.length}] "${track.title}" by ${track.artist}`);
        console.log(`   Duration: "${originalDuration}" -> ${parsedDuration} seconds`);
        
        if (parsedDuration > 0) {
            track.duration = parsedDuration;
            parsedCount++;
            console.log(`   ✅ Parsed successfully`);
        } else {
            failedCount++;
            console.log(`   ❌ Failed to parse`);
        }
        console.log('');
    });
    
    // Update metadata
    musicData.metadata.lastDurationParsing = {
        date: new Date().toISOString(),
        parsed: parsedCount,
        failed: failedCount,
        source: 'Duration String Parsing'
    };
    
    musicData.metadata.lastUpdated = new Date().toISOString();
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('=' .repeat(50));
    console.log('📊 Duration Parsing Summary:');
    console.log(`  ✅ Successfully parsed: ${parsedCount} tracks`);
    console.log(`  ❌ Failed to parse: ${failedCount} tracks`);
    console.log(`  📚 Total tracks in database: ${musicData.musicTracks.length}`);
    
    const successRate = (parsedCount / stringDurationTracks.length * 100).toFixed(1);
    console.log(`  📈 Success rate: ${successRate}%`);
    
    console.log('\n✨ Duration parsing complete!');
    console.log('⏱️  String durations have been converted to numeric seconds.');
}

// Run the parsing
parseDurationStrings();