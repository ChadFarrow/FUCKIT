#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function analyzeArtworkAndDuration() {
    console.log('🎨 Analyzing Artwork and Duration Coverage\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    const totalTracks = musicData.musicTracks.length;
    console.log(`📊 Total tracks in database: ${totalTracks}\n`);
    
    // Analyze artwork coverage
    let hasArtwork = 0;
    let hasPlaceholderArt = 0;
    let noArtwork = 0;
    let hasValidArtwork = 0;
    
    // Analyze duration coverage
    let hasDuration = 0;
    let noDuration = 0;
    let hasValidDuration = 0;
    
    // Analyze both
    let hasBoth = 0;
    let hasNeither = 0;
    
    const exampleMissingArt = [];
    const exampleMissingDuration = [];
    
    musicData.musicTracks.forEach(track => {
        // Artwork analysis
        if (track.artwork) {
            hasArtwork++;
            if (track.artwork === '/api/placeholder/300/300') {
                hasPlaceholderArt++;
            } else if (track.artwork.startsWith('http')) {
                hasValidArtwork++;
            }
        } else {
            noArtwork++;
            if (exampleMissingArt.length < 5) {
                exampleMissingArt.push({
                    title: track.title,
                    artist: track.artist,
                    source: track.source
                });
            }
        }
        
        // Duration analysis
        if (track.duration && track.duration > 0) {
            hasDuration++;
            hasValidDuration++;
        } else {
            noDuration++;
            if (exampleMissingDuration.length < 5) {
                exampleMissingDuration.push({
                    title: track.title,
                    artist: track.artist,
                    source: track.source,
                    duration: track.duration || 'undefined'
                });
            }
        }
        
        // Combined analysis
        const validArt = track.artwork && track.artwork !== '/api/placeholder/300/300' && track.artwork.startsWith('http');
        const validDuration = track.duration && track.duration > 0;
        
        if (validArt && validDuration) {
            hasBoth++;
        } else if (!validArt && !validDuration) {
            hasNeither++;
        }
    });
    
    // Report results
    console.log('🎨 ARTWORK ANALYSIS:');
    console.log(`  ✅ Has artwork: ${hasArtwork} (${(hasArtwork/totalTracks*100).toFixed(1)}%)`);
    console.log(`    📷 Valid artwork URLs: ${hasValidArtwork} (${(hasValidArtwork/totalTracks*100).toFixed(1)}%)`);
    console.log(`    🖼️  Placeholder artwork: ${hasPlaceholderArt} (${(hasPlaceholderArt/totalTracks*100).toFixed(1)}%)`);
    console.log(`  ❌ No artwork: ${noArtwork} (${(noArtwork/totalTracks*100).toFixed(1)}%)\n`);
    
    console.log('⏱️  DURATION ANALYSIS:');
    console.log(`  ✅ Has duration: ${hasValidDuration} (${(hasValidDuration/totalTracks*100).toFixed(1)}%)`);
    console.log(`  ❌ No duration: ${noDuration} (${(noDuration/totalTracks*100).toFixed(1)}%)\n`);
    
    console.log('🎯 COMBINED ANALYSIS:');
    console.log(`  ✅ Has both artwork & duration: ${hasBoth} (${(hasBoth/totalTracks*100).toFixed(1)}%)`);
    console.log(`  ❌ Missing both: ${hasNeither} (${(hasNeither/totalTracks*100).toFixed(1)}%)\n`);
    
    if (exampleMissingArt.length > 0) {
        console.log('🖼️  EXAMPLES MISSING ARTWORK:');
        exampleMissingArt.forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by ${track.artist} (${track.source})`);
        });
        console.log('');
    }
    
    if (exampleMissingDuration.length > 0) {
        console.log('⏱️  EXAMPLES MISSING DURATION:');
        exampleMissingDuration.forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by ${track.artist} (${track.source}) - Duration: ${track.duration}`);
        });
        console.log('');
    }
    
    // Breakdown by source
    const sourceStats = {};
    musicData.musicTracks.forEach(track => {
        const source = track.source || 'Unknown';
        if (!sourceStats[source]) {
            sourceStats[source] = {
                total: 0,
                hasArt: 0,
                hasDuration: 0,
                hasBoth: 0
            };
        }
        
        sourceStats[source].total++;
        
        const validArt = track.artwork && track.artwork !== '/api/placeholder/300/300' && track.artwork.startsWith('http');
        const validDuration = track.duration && track.duration > 0;
        
        if (validArt) sourceStats[source].hasArt++;
        if (validDuration) sourceStats[source].hasDuration++;
        if (validArt && validDuration) sourceStats[source].hasBoth++;
    });
    
    console.log('📊 BREAKDOWN BY SOURCE:');
    Object.entries(sourceStats)
        .sort(([,a], [,b]) => b.total - a.total)
        .forEach(([source, stats]) => {
            const artPct = (stats.hasArt/stats.total*100).toFixed(0);
            const durPct = (stats.hasDuration/stats.total*100).toFixed(0);
            const bothPct = (stats.hasBoth/stats.total*100).toFixed(0);
            console.log(`  ${source}: ${stats.total} tracks`);
            console.log(`    🎨 Art: ${artPct}% | ⏱️  Duration: ${durPct}% | 🎯 Both: ${bothPct}%`);
        });
    
    console.log('\n' + '=' .repeat(50));
    
    const overallCompleteness = (hasBoth/totalTracks*100).toFixed(1);
    if (overallCompleteness >= 80) {
        console.log(`✅ GOOD: ${overallCompleteness}% of tracks have both artwork and duration`);
    } else if (overallCompleteness >= 60) {
        console.log(`⚠️  FAIR: ${overallCompleteness}% of tracks have both artwork and duration`);
    } else {
        console.log(`❌ NEEDS WORK: Only ${overallCompleteness}% of tracks have both artwork and duration`);
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (noArtwork > 0) {
        console.log(`  📷 ${noArtwork} tracks need artwork resolution`);
    }
    if (noDuration > 0) {
        console.log(`  ⏱️  ${noDuration} tracks need duration information`);
    }
    if (hasPlaceholderArt > 0) {
        console.log(`  🖼️  ${hasPlaceholderArt} tracks have placeholder artwork that could be improved`);
    }
}

// Run the analysis
analyzeArtworkAndDuration();