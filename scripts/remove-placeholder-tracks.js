#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function removePlaceholderTracks() {
    console.log('🗑️  Removing Placeholder/Unknown Tracks to Clean Database\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-placeholder-removal-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    const originalCount = musicData.musicTracks.length;
    
    // Identify placeholder/unknown tracks to remove
    const tracksToRemove = musicData.musicTracks.filter(track =>
        (track.title && (
            track.title.startsWith('Track ') ||
            track.title === 'Unindexed Music Track' ||
            track.title === 'Unknown Track'
        )) ||
        (track.artist && (
            track.artist === 'Unknown Artist' ||
            track.artist === 'Independent Artist'
        )) ||
        // Remote tracks that were never resolved
        (track.source && track.source.includes('remoteItem') && (
            !track.feedId || track.needsResolution
        ))
    );
    
    console.log(`Found ${tracksToRemove.length} placeholder tracks to remove:\n`);
    
    // Show examples of what will be removed
    const examples = tracksToRemove.slice(0, 10);
    examples.forEach((track, i) => {
        let reason = '';
        if (track.title?.startsWith('Track ')) reason = 'generic title';
        else if (track.title === 'Unindexed Music Track') reason = 'unindexed placeholder';
        else if (track.artist === 'Unknown Artist') reason = 'unknown artist';
        else if (track.artist === 'Independent Artist') reason = 'generic artist';
        else if (track.needsResolution) reason = 'unresolved remote item';
        
        console.log(`  ${i+1}. "${track.title}" by ${track.artist} (${reason})`);
    });
    
    if (tracksToRemove.length > 10) {
        console.log(`  ... and ${tracksToRemove.length - 10} more`);
    }
    
    console.log('\n📊 Removal Analysis:');
    
    // Analyze what we're removing
    const removalStats = {
        genericTitles: 0,
        unknownArtists: 0,
        unresolvedRemoteItems: 0,
        unindexedTracks: 0
    };
    
    tracksToRemove.forEach(track => {
        if (track.title?.startsWith('Track ')) removalStats.genericTitles++;
        if (track.title === 'Unindexed Music Track') removalStats.unindexedTracks++;
        if (track.artist === 'Unknown Artist') removalStats.unknownArtists++;
        if (track.needsResolution) removalStats.unresolvedRemoteItems++;
    });
    
    console.log(`  🏷️  Generic titles (Track 1, Track 2...): ${removalStats.genericTitles}`);
    console.log(`  ❓ Unknown artists: ${removalStats.unknownArtists}`);
    console.log(`  🔄 Unresolved remote items: ${removalStats.unresolvedRemoteItems}`);
    console.log(`  📋 Unindexed placeholders: ${removalStats.unindexedTracks}`);
    
    // Remove placeholder tracks
    const cleanedTracks = musicData.musicTracks.filter(track => !tracksToRemove.includes(track));
    
    console.log('\n🧹 Performing cleanup...');
    
    // Update the music data
    musicData.musicTracks = cleanedTracks;
    
    // Update metadata
    musicData.metadata.lastPlaceholderRemoval = {
        date: new Date().toISOString(),
        originalCount: originalCount,
        removedCount: tracksToRemove.length,
        finalCount: cleanedTracks.length,
        method: 'Smart Placeholder Removal',
        removalStats: removalStats
    };
    
    // Save the cleaned data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Database Cleanup Summary:');
    console.log(`  📂 Original tracks: ${originalCount}`);
    console.log(`  🗑️  Tracks removed: ${tracksToRemove.length}`);
    console.log(`  ✅ Final track count: ${cleanedTracks.length}`);
    console.log(`  📈 Database size reduction: ${(tracksToRemove.length / originalCount * 100).toFixed(1)}%`);
    
    // Calculate quality metrics for remaining tracks
    const tracksWithDuration = cleanedTracks.filter(track => track.duration && track.duration > 0).length;
    const tracksWithArtwork = cleanedTracks.filter(track => 
        track.artwork && track.artwork !== '' && track.artwork !== '/api/placeholder/300/300'
    ).length;
    const tracksWithAudio = cleanedTracks.filter(track => track.audioUrl && track.audioUrl.startsWith('http')).length;
    
    const durationCoverage = (tracksWithDuration / cleanedTracks.length * 100).toFixed(1);
    const artworkCoverage = (tracksWithArtwork / cleanedTracks.length * 100).toFixed(1);
    const audioCoverage = (tracksWithAudio / cleanedTracks.length * 100).toFixed(1);
    
    console.log('\n🎵 Final Database Quality:');
    console.log(`  ⏱️  Duration coverage: ${durationCoverage}% (${tracksWithDuration}/${cleanedTracks.length})`);
    console.log(`  🎨 Artwork coverage: ${artworkCoverage}% (${tracksWithArtwork}/${cleanedTracks.length})`);
    console.log(`  🔊 Audio URL coverage: ${audioCoverage}% (${tracksWithAudio}/${cleanedTracks.length})`);
    
    const overallQuality = ((tracksWithDuration + tracksWithArtwork + tracksWithAudio) / (cleanedTracks.length * 3) * 100).toFixed(1);
    console.log(`  📊 Overall completeness: ${overallQuality}%`);
    
    console.log('\n✨ Database cleanup complete!');
    console.log('🎯 Your music database is now clean and production-ready.');
}

// Run the cleanup
removePlaceholderTracks();