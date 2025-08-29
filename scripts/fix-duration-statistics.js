#!/usr/bin/env node

/**
 * Fix the duration statistics calculation issue
 */

const fs = require('fs');
const path = require('path');

async function fixDurationStatistics() {
    try {
        console.log('🔍 Fixing duration statistics calculation...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log(`Total tracks: ${musicData.musicTracks.length}`);
        
        // Get all valid durations
        const validDurations = musicData.musicTracks
            .map(t => t.duration)
            .filter(d => d != null && typeof d === 'number' && isFinite(d) && d >= 0)
            .sort((a, b) => a - b);
        
        console.log(`Valid durations: ${validDurations.length}`);
        
        if (validDurations.length === 0) {
            console.log('❌ No valid durations found');
            return;
        }
        
        // Calculate statistics using more precise method
        let sum = 0;
        let count = 0;
        
        // Use chunks to avoid precision issues
        const chunkSize = 100;
        for (let i = 0; i < validDurations.length; i += chunkSize) {
            const chunk = validDurations.slice(i, i + chunkSize);
            const chunkSum = chunk.reduce((s, d) => s + d, 0);
            sum += chunkSum;
            count += chunk.length;
        }
        
        const average = sum / count;
        const median = validDurations[Math.floor(validDurations.length / 2)];
        const min = validDurations[0];
        const max = validDurations[validDurations.length - 1];
        
        console.log('\n📊 Corrected Duration Statistics:');
        console.log(`  Valid tracks with duration: ${count}`);
        console.log(`  Average: ${Math.round(average)} seconds (${formatDuration(average)})`);
        console.log(`  Median: ${median} seconds (${formatDuration(median)})`);
        console.log(`  Range: ${min}s (${formatDuration(min)}) to ${max}s (${formatDuration(max)})`);
        
        // Duration distribution
        console.log('\n📈 Duration Distribution:');
        const ranges = [
            { min: 0, max: 60, label: 'Under 1 min' },
            { min: 60, max: 180, label: '1-3 minutes' },
            { min: 180, max: 300, label: '3-5 minutes' },
            { min: 300, max: 600, label: '5-10 minutes' },
            { min: 600, max: 1800, label: '10-30 minutes' },
            { min: 1800, max: Infinity, label: 'Over 30 minutes' }
        ];
        
        ranges.forEach(range => {
            const count = validDurations.filter(d => d >= range.min && d < range.max).length;
            const percentage = ((count / validDurations.length) * 100).toFixed(1);
            console.log(`  ${range.label}: ${count} tracks (${percentage}%)`);
        });
        
        // Check for issues
        console.log('\n🔍 Data Quality:');
        const totalTracks = musicData.musicTracks.length;
        const missingDuration = totalTracks - count;
        const completionRate = ((count / totalTracks) * 100).toFixed(1);
        
        console.log(`  Tracks with duration: ${count}/${totalTracks} (${completionRate}%)`);
        console.log(`  Missing duration: ${missingDuration}`);
        
        if (missingDuration > 0) {
            const missing = musicData.musicTracks.filter(t => 
                t.duration == null || !isFinite(t.duration) || t.duration < 0
            );
            console.log('\n❌ Tracks missing duration:');
            missing.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i+1}. "${track.title}" - Duration: ${track.duration}`);
            });
        }
        
        console.log('\n✅ Duration statistics calculation completed successfully');
        
    } catch (error) {
        console.error('❌ Error fixing duration statistics:', error);
    }
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

// Run the fix
fixDurationStatistics();