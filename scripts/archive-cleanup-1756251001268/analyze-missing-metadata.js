#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function analyzeMissingMetadata() {
    console.log('🔍 Analyzing Remaining Missing Metadata\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    const totalTracks = musicData.musicTracks.length;
    
    // Find tracks missing artwork
    const missingArtwork = musicData.musicTracks.filter(track => 
        !track.artwork || 
        track.artwork === '' || 
        track.artwork === '/api/placeholder/300/300'
    );
    
    // Find tracks missing duration
    const missingDuration = musicData.musicTracks.filter(track => 
        !track.duration || 
        track.duration === 0 || 
        track.duration === '0'
    );
    
    console.log(`📊 REMAINING GAPS:`);
    console.log(`  🎨 Missing artwork: ${missingArtwork.length} tracks`);
    console.log(`  ⏱️  Missing duration: ${missingDuration.length} tracks\n`);
    
    // Analyze by source
    console.log('📋 MISSING ARTWORK BY SOURCE:');
    const artworkBySource = {};
    missingArtwork.forEach(track => {
        const source = track.source || 'Unknown';
        if (!artworkBySource[source]) artworkBySource[source] = [];
        artworkBySource[source].push(track);
    });
    
    Object.entries(artworkBySource)
        .sort(([,a], [,b]) => b.length - a.length)
        .forEach(([source, tracks]) => {
            console.log(`  ${source}: ${tracks.length} tracks`);
            if (tracks.length <= 5) {
                tracks.forEach(track => {
                    console.log(`    - "${track.title}" by ${track.artist}`);
                });
            } else {
                tracks.slice(0, 3).forEach(track => {
                    console.log(`    - "${track.title}" by ${track.artist}`);
                });
                console.log(`    ... and ${tracks.length - 3} more`);
            }
        });
    
    console.log('\n📋 MISSING DURATION BY SOURCE:');
    const durationBySource = {};
    missingDuration.forEach(track => {
        const source = track.source || 'Unknown';
        if (!durationBySource[source]) durationBySource[source] = [];
        durationBySource[source].push(track);
    });
    
    Object.entries(durationBySource)
        .sort(([,a], [,b]) => b.length - a.length)
        .forEach(([source, tracks]) => {
            console.log(`  ${source}: ${tracks.length} tracks`);
            if (tracks.length <= 5) {
                tracks.forEach(track => {
                    console.log(`    - "${track.title}" by ${track.artist}`);
                });
            } else {
                tracks.slice(0, 3).forEach(track => {
                    console.log(`    - "${track.title}" by ${track.artist}`);
                });
                console.log(`    ... and ${tracks.length - 3} more`);
            }
        });
    
    // Analyze what data we DO have for missing items
    console.log('\n🔍 AVAILABLE DATA FOR MISSING ITEMS:');
    
    const missingArtworkWithAudio = missingArtwork.filter(track => track.audioUrl);
    const missingArtworkWithFeed = missingArtwork.filter(track => track.feedGuid || track.feedId);
    
    console.log(`\n🎨 MISSING ARTWORK - Available Resources:`);
    console.log(`  🎧 Have audio URLs: ${missingArtworkWithAudio.length}/${missingArtwork.length}`);
    console.log(`  📡 Have feed info: ${missingArtworkWithFeed.length}/${missingArtwork.length}`);
    
    const missingDurationWithAudio = missingDuration.filter(track => track.audioUrl);
    const missingDurationWithFeed = missingDuration.filter(track => track.feedGuid || track.feedId);
    
    console.log(`\n⏱️  MISSING DURATION - Available Resources:`);
    console.log(`  🎧 Have audio URLs: ${missingDurationWithAudio.length}/${missingDuration.length}`);
    console.log(`  📡 Have feed info: ${missingDurationWithFeed.length}/${missingDuration.length}`);
    
    // Identify resolution strategies
    console.log('\n🎯 RESOLUTION STRATEGIES:\n');
    
    console.log('1️⃣ **AUDIO FILE ANALYSIS** (Most Promising):');
    console.log(`   🎧 ${missingDurationWithAudio.length} tracks have audio URLs for duration extraction`);
    console.log(`   🎨 ${missingArtworkWithAudio.length} tracks have audio URLs that might contain embedded artwork`);
    
    console.log('\n2️⃣ **FEED RE-INDEXING**:');
    console.log(`   📡 ${missingArtworkWithFeed.length} tracks with feed info could have updated artwork`);
    console.log(`   ⏱️  ${missingDurationWithFeed.length} tracks with feed info could have updated duration`);
    
    console.log('\n3️⃣ **SEARCH & MATCH**:');
    const tracksWithoutFeedInfo = missingArtwork.filter(track => !track.feedGuid && !track.feedId);
    console.log(`   🔍 ${tracksWithoutFeedInfo.length} tracks need title/artist search matching`);
    
    console.log('\n4️⃣ **EXTERNAL SOURCES**:');
    console.log(`   🌐 MusicBrainz, Last.fm, Spotify Web API for artwork`);
    console.log(`   📱 YouTube, SoundCloud for duration estimation`);
    
    // Sample tracks for each strategy
    console.log('\n📝 SAMPLE TRACKS FOR EACH STRATEGY:\n');
    
    if (missingDurationWithAudio.length > 0) {
        console.log('🎧 AUDIO FILE ANALYSIS CANDIDATES:');
        missingDurationWithAudio.slice(0, 5).forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by ${track.artist}`);
            console.log(`     Audio: ${track.audioUrl?.substring(0, 50)}...`);
        });
    }
    
    if (missingArtworkWithFeed.length > 0) {
        console.log('\n📡 FEED RE-INDEXING CANDIDATES:');
        missingArtworkWithFeed.slice(0, 5).forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by ${track.artist}`);
            console.log(`     Feed: ${track.feedGuid || track.feedId}`);
        });
    }
    
    const unknownSourceTracks = [...missingArtwork, ...missingDuration]
        .filter(track => track.source === 'Unknown' || !track.source)
        .filter((track, index, self) => self.findIndex(t => t.title === track.title && t.artist === track.artist) === index);
    
    if (unknownSourceTracks.length > 0) {
        console.log('\n🔍 SEARCH & MATCH CANDIDATES:');
        unknownSourceTracks.slice(0, 5).forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by ${track.artist}`);
            console.log(`     Source: ${track.source || 'Unknown'}`);
        });
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🚀 NEXT STEPS RECOMMENDATIONS:\n');
    
    const strategies = [
        {
            name: 'Audio File Duration Analysis',
            tracks: missingDurationWithAudio.length,
            priority: 'HIGH',
            description: 'Download audio file headers to extract duration'
        },
        {
            name: 'Feed Metadata Re-scan',
            tracks: Math.max(missingArtworkWithFeed.length, missingDurationWithFeed.length),
            priority: 'HIGH',
            description: 'Re-check feeds for updated artwork/duration data'
        },
        {
            name: 'Audio File Artwork Extraction',
            tracks: missingArtworkWithAudio.length,
            priority: 'MEDIUM',
            description: 'Extract embedded artwork from audio files'
        },
        {
            name: 'External API Integration',
            tracks: unknownSourceTracks.length,
            priority: 'MEDIUM',
            description: 'Query MusicBrainz, Last.fm for missing metadata'
        },
        {
            name: 'Manual Resolution',
            tracks: Math.min(missingArtwork.length, missingDuration.length),
            priority: 'LOW',
            description: 'Manually resolve remaining difficult cases'
        }
    ];
    
    strategies.forEach((strategy, i) => {
        console.log(`${i+1}. **${strategy.name}** [${strategy.priority}]`);
        console.log(`   Potential tracks: ${strategy.tracks}`);
        console.log(`   ${strategy.description}\n`);
    });
    
    console.log('💡 Would you like me to implement any of these strategies?');
}

// Run the analysis
analyzeMissingMetadata();