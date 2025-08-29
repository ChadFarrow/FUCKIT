#!/usr/bin/env node

/**
 * Check for unknown artists and albums in the music database
 */

const fs = require('fs');
const path = require('path');

async function analyzeUnknownData() {
    try {
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Load enhanced database if available
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        let enhancedData = null;
        if (fs.existsSync(enhancedDbPath)) {
            enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
        }
        
        console.log('🔍 Analyzing music database for unknown artists and albums...\n');
        
        // Create enhanced lookup map
        const enhancedMap = new Map();
        if (enhancedData) {
            enhancedData.enhancedTracks.forEach(enhanced => {
                if (typeof enhanced.originalIndex === 'number') {
                    enhancedMap.set(enhanced.originalIndex, enhanced);
                }
            });
        }
        
        const unknownArtists = [];
        const unknownAlbums = [];
        const emptyArtists = [];
        const emptyAlbums = [];
        const artistCounts = new Map();
        const albumCounts = new Map();
        
        // Common unknown/placeholder values to check for
        const unknownValues = [
            'unknown', 'unknown artist', 'unknown album',
            'n/a', 'na', 'none', 'null', 'undefined',
            'untitled', 'no title', 'no artist', 'no album',
            'various', 'various artists', 'compilation',
            'podcast', 'episode', 'track'
        ];
        
        musicData.musicTracks.forEach((track, index) => {
            const enhanced = enhancedMap.get(index);
            
            // Get artist name (enhanced first, then legacy)
            const artistName = enhanced?.enhancedMetadata?.artist || track.feedArtist || '';
            const albumName = enhanced?.enhancedMetadata?.albumTitle || track.feedTitle || '';
            
            // Check for empty artists
            if (!artistName || artistName.trim() === '') {
                emptyArtists.push({
                    index,
                    title: track.title,
                    feedUrl: track.feedUrl,
                    enhanced: !!enhanced
                });
            }
            // Check for unknown artists
            else if (unknownValues.some(unknown => 
                artistName.toLowerCase().includes(unknown.toLowerCase()))) {
                unknownArtists.push({
                    index,
                    artist: artistName,
                    title: track.title,
                    feedUrl: track.feedUrl,
                    enhanced: !!enhanced
                });
            }
            
            // Check for empty albums
            if (!albumName || albumName.trim() === '') {
                emptyAlbums.push({
                    index,
                    title: track.title,
                    artist: artistName,
                    enhanced: !!enhanced
                });
            }
            // Check for unknown albums
            else if (unknownValues.some(unknown => 
                albumName.toLowerCase().includes(unknown.toLowerCase()))) {
                unknownAlbums.push({
                    index,
                    album: albumName,
                    artist: artistName,
                    title: track.title,
                    enhanced: !!enhanced
                });
            }
            
            // Count occurrences
            artistCounts.set(artistName, (artistCounts.get(artistName) || 0) + 1);
            albumCounts.set(albumName, (albumCounts.get(albumName) || 0) + 1);
        });
        
        // Statistics
        console.log('📊 Database Statistics:');
        console.log(`Total tracks: ${musicData.musicTracks.length}`);
        console.log(`Enhanced tracks: ${enhancedMap.size}`);
        console.log(`Unique artists: ${artistCounts.size}`);
        console.log(`Unique albums: ${albumCounts.size}\n`);
        
        // Empty values
        console.log('❌ Empty Values:');
        console.log(`Tracks with empty artists: ${emptyArtists.length}`);
        console.log(`Tracks with empty albums: ${emptyAlbums.length}\n`);
        
        // Unknown values
        console.log('❓ Unknown/Placeholder Values:');
        console.log(`Tracks with unknown artists: ${unknownArtists.length}`);
        console.log(`Tracks with unknown albums: ${unknownAlbums.length}\n`);
        
        // Show details for empty artists
        if (emptyArtists.length > 0) {
            console.log('🔍 Tracks with Empty Artists (showing first 10):');
            emptyArtists.slice(0, 10).forEach(track => {
                console.log(`  [${track.index}] "${track.title}" ${track.enhanced ? '(enhanced)' : '(legacy)'}`);
                const feedUrl = track.feedUrl || '(no URL)';
                console.log(`      Feed: ${feedUrl.length > 60 ? feedUrl.substring(0, 60) + '...' : feedUrl}`);
            });
            console.log();
        }
        
        // Show details for unknown artists
        if (unknownArtists.length > 0) {
            console.log('🔍 Tracks with Unknown Artists (showing first 10):');
            unknownArtists.slice(0, 10).forEach(track => {
                console.log(`  [${track.index}] Artist: "${track.artist}" - Track: "${track.title}" ${track.enhanced ? '(enhanced)' : '(legacy)'}`);
            });
            console.log();
        }
        
        // Show details for empty albums
        if (emptyAlbums.length > 0) {
            console.log('🔍 Tracks with Empty Albums (showing first 10):');
            emptyAlbums.slice(0, 10).forEach(track => {
                console.log(`  [${track.index}] "${track.title}" by "${track.artist}" ${track.enhanced ? '(enhanced)' : '(legacy)'}`);
            });
            console.log();
        }
        
        // Show details for unknown albums
        if (unknownAlbums.length > 0) {
            console.log('🔍 Tracks with Unknown Albums (showing first 10):');
            unknownAlbums.slice(0, 10).forEach(track => {
                console.log(`  [${track.index}] Album: "${track.album}" - Artist: "${track.artist}" - Track: "${track.title}" ${track.enhanced ? '(enhanced)' : '(legacy)'}`);
            });
            console.log();
        }
        
        // Most common artists (top 10)
        const topArtists = [...artistCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
            
        console.log('🎤 Most Common Artists:');
        topArtists.forEach(([artist, count], index) => {
            const displayArtist = artist || '(empty)';
            console.log(`  ${index + 1}. ${displayArtist}: ${count} tracks`);
        });
        console.log();
        
        // Summary recommendations
        console.log('💡 Recommendations:');
        
        if (emptyArtists.length > 0) {
            console.log(`  • ${emptyArtists.length} tracks need artist names`);
        }
        
        if (emptyAlbums.length > 0) {
            console.log(`  • ${emptyAlbums.length} tracks need album names`);
        }
        
        if (unknownArtists.length > 0) {
            console.log(`  • ${unknownArtists.length} tracks have placeholder artist names that could be improved`);
        }
        
        if (unknownAlbums.length > 0) {
            console.log(`  • ${unknownAlbums.length} tracks have placeholder album names that could be improved`);
        }
        
        const totalIssues = emptyArtists.length + emptyAlbums.length + unknownArtists.length + unknownAlbums.length;
        if (totalIssues === 0) {
            console.log('  ✅ No major artist/album issues found!');
        } else {
            console.log(`  📈 Total tracks needing attention: ${totalIssues}`);
        }
        
    } catch (error) {
        console.error('❌ Error analyzing database:', error);
    }
}

// Run the analysis
analyzeUnknownData();