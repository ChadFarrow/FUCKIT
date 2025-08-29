#!/usr/bin/env node

/**
 * Check for tracks missing duration information
 */

const fs = require('fs');
const path = require('path');

async function checkMissingDurations() {
    try {
        console.log('🔍 Checking for tracks missing duration information...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Load enhanced database if available
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        let enhancedData = null;
        if (fs.existsSync(enhancedDbPath)) {
            enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
        }
        
        console.log(`Total tracks in database: ${musicData.musicTracks.length}`);
        
        // Create enhanced lookup map
        const enhancedMap = new Map();
        if (enhancedData) {
            enhancedData.enhancedTracks.forEach(enhanced => {
                if (typeof enhanced.originalIndex === 'number') {
                    enhancedMap.set(enhanced.originalIndex, enhanced);
                }
            });
            console.log(`Enhanced tracks available: ${enhancedMap.size}\n`);
        }
        
        const missingDuration = [];
        const zeroDuration = [];
        const invalidDuration = [];
        const validDuration = [];
        const durationSources = new Map();
        
        musicData.musicTracks.forEach((track, index) => {
            const enhanced = enhancedMap.get(index);
            
            // Check different duration sources
            let duration = null;
            let source = 'none';
            
            // Priority order: enhanced -> track.duration -> other fields
            if (enhanced?.enhancedMetadata?.duration) {
                duration = parseTrackDuration(enhanced.enhancedMetadata.duration);
                source = 'enhanced-metadata';
            } else if (track.duration !== undefined && track.duration !== null) {
                duration = parseTrackDuration(track.duration);
                source = 'track-duration';
            } else if (track.itunes?.duration) {
                duration = parseTrackDuration(track.itunes.duration);
                source = 'itunes-duration';
            }
            
            // Count source types
            durationSources.set(source, (durationSources.get(source) || 0) + 1);
            
            // Categorize tracks
            if (duration === null || duration === undefined) {
                missingDuration.push({
                    index,
                    track,
                    enhanced: !!enhanced,
                    source
                });
            } else if (duration === 0) {
                zeroDuration.push({
                    index,
                    track,
                    duration,
                    enhanced: !!enhanced,
                    source
                });
            } else if (duration < 0 || duration > 7200) { // Negative or > 2 hours
                invalidDuration.push({
                    index,
                    track,
                    duration,
                    enhanced: !!enhanced,
                    source
                });
            } else {
                validDuration.push({
                    index,
                    track,
                    duration,
                    enhanced: !!enhanced,
                    source
                });
            }
        });
        
        console.log('📊 Duration Analysis Results:');
        console.log(`Tracks with valid durations: ${validDuration.length}`);
        console.log(`Tracks missing duration: ${missingDuration.length}`);
        console.log(`Tracks with zero duration: ${zeroDuration.length}`);
        console.log(`Tracks with invalid duration: ${invalidDuration.length}\n`);
        
        console.log('📈 Duration Sources:');
        [...durationSources.entries()].sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
            console.log(`  ${source}: ${count} tracks`);
        });
        console.log();
        
        if (missingDuration.length > 0) {
            console.log('❌ Sample tracks missing duration:');
            missingDuration.slice(0, 10).forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.index}] "${item.track.title}"`);
                console.log(`     Artist: "${item.track.feedArtist || '(unknown)'}"`);
                console.log(`     Enhanced: ${item.enhanced ? 'Yes' : 'No'}`);
                console.log(`     Feed: ${(item.track.feedUrl || '(no URL)').substring(0, 60)}...`);
                console.log();
            });
        }
        
        if (zeroDuration.length > 0) {
            console.log('⚠️ Sample tracks with zero duration:');
            zeroDuration.slice(0, 10).forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.index}] "${item.track.title}"`);
                console.log(`     Artist: "${item.track.feedArtist || '(unknown)'}"`);
                console.log(`     Duration: ${item.duration} (${item.source})`);
                console.log(`     Enhanced: ${item.enhanced ? 'Yes' : 'No'}`);
                console.log();
            });
        }
        
        if (invalidDuration.length > 0) {
            console.log('⚠️ Sample tracks with invalid duration:');
            invalidDuration.slice(0, 10).forEach((item, i) => {
                console.log(`  ${i + 1}. [${item.index}] "${item.track.title}"`);
                console.log(`     Artist: "${item.track.feedArtist || '(unknown)'}"`);
                console.log(`     Duration: ${item.duration} seconds (${item.source})`);
                console.log(`     Enhanced: ${item.enhanced ? 'Yes' : 'No'}`);
                console.log();
            });
        }
        
        // Duration distribution analysis
        if (validDuration.length > 0) {
            const durations = validDuration.map(item => item.duration).sort((a, b) => a - b);
            const median = durations[Math.floor(durations.length / 2)];
            const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
            const min = durations[0];
            const max = durations[durations.length - 1];
            
            console.log('📈 Valid Duration Statistics:');
            console.log(`  Average: ${Math.round(average)} seconds (${formatDuration(average)})`);
            console.log(`  Median: ${median} seconds (${formatDuration(median)})`);
            console.log(`  Range: ${min}s (${formatDuration(min)}) to ${max}s (${formatDuration(max)})`);
            console.log();
        }
        
        // Check for suspicious placeholder durations
        const suspiciousDurations = validDuration.filter(item => 
            item.duration === 5999 || // Common placeholder
            item.duration === 3600 || // Exactly 1 hour
            item.duration === 1800 || // Exactly 30 minutes
            item.duration === 600     // Exactly 10 minutes
        );
        
        if (suspiciousDurations.length > 0) {
            console.log('🤔 Tracks with potentially placeholder durations:');
            const durationCounts = new Map();
            suspiciousDurations.forEach(item => {
                const duration = item.duration;
                durationCounts.set(duration, (durationCounts.get(duration) || 0) + 1);
            });
            
            [...durationCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([duration, count]) => {
                console.log(`  ${duration}s (${formatDuration(duration)}): ${count} tracks`);
            });
            console.log();
        }
        
        const totalIssues = missingDuration.length + zeroDuration.length + invalidDuration.length;
        console.log('💡 Summary:');
        if (totalIssues === 0) {
            console.log('  ✅ All tracks have valid duration information!');
        } else {
            console.log(`  📊 ${totalIssues} tracks need duration fixes`);
            console.log(`  📈 ${((validDuration.length / musicData.musicTracks.length) * 100).toFixed(1)}% of tracks have valid durations`);
        }
        
    } catch (error) {
        console.error('❌ Error checking durations:', error);
    }
}

/**
 * Parse track duration from various formats
 */
function parseTrackDuration(duration) {
    if (duration === null || duration === undefined) return null;
    
    // If it's already a number, return it
    if (typeof duration === 'number') {
        return duration;
    }
    
    // If it's a string, try to parse it
    if (typeof duration === 'string') {
        // Handle MM:SS or HH:MM:SS format
        const timeMatch = duration.match(/^(?:(\d+):)?(\d+):(\d+)$/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1] || 0);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            return hours * 3600 + minutes * 60 + seconds;
        }
        
        // Handle numeric strings
        const numericValue = parseFloat(duration);
        if (!isNaN(numericValue)) {
            return numericValue;
        }
    }
    
    return null;
}

/**
 * Format duration in seconds to MM:SS format
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Run the check
checkMissingDurations();