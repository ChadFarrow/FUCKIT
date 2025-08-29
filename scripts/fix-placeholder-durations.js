#!/usr/bin/env node

/**
 * Replace placeholder durations with realistic values
 */

const fs = require('fs');
const path = require('path');

async function fixPlaceholderDurations() {
    try {
        console.log('🔍 Fixing placeholder durations...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log(`Total tracks: ${musicData.musicTracks.length}`);
        
        // Find tracks with placeholder durations
        const placeholderTracks = musicData.musicTracks.filter(track => 
            track.duration === 5999 || // 99:59 placeholder
            track.duration === 0      // Zero duration
        );
        
        console.log(`Found ${placeholderTracks.length} tracks with placeholder durations\n`);
        
        if (placeholderTracks.length === 0) {
            console.log('✅ No placeholder durations found');
            return;
        }
        
        const fixedTracks = [];
        let fixedCount = 0;
        
        placeholderTracks.forEach(track => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            const newDuration = generateRealisticDuration(track);
            
            const fixedTrack = {
                ...track,
                duration: newDuration,
                durationFixed: true,
                durationFixedAt: new Date().toISOString(),
                originalDuration: track.duration,
                durationFixMethod: getDurationFixMethod(track, newDuration)
            };
            
            fixedTracks.push({
                originalIndex,
                fixed: fixedTrack,
                originalDuration: track.duration,
                newDuration
            });
            fixedCount++;
        });
        
        console.log(`📊 Duration Fix Results:`);
        console.log(`Fixed ${fixedCount} placeholder durations\n`);
        
        // Show sample fixes
        console.log('✅ Sample duration fixes:');
        fixedTracks.slice(0, 15).forEach((item, i) => {
            const track = item.fixed;
            console.log(`  ${i + 1}. "${track.title}"`);
            console.log(`     Artist: "${track.feedArtist || 'Unknown'}"`);
            console.log(`     Duration: ${item.originalDuration}s → ${item.newDuration}s (${formatDuration(item.newDuration)})`);
            console.log(`     Method: ${track.durationFixMethod}`);
            console.log();
        });
        
        // Duration distribution of fixes
        const fixMethodCounts = new Map();
        fixedTracks.forEach(({ fixed }) => {
            const method = fixed.durationFixMethod;
            fixMethodCounts.set(method, (fixMethodCounts.get(method) || 0) + 1);
        });
        
        console.log('📈 Fix Methods Used:');
        [...fixMethodCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
            console.log(`  ${method}: ${count} tracks`);
        });
        console.log();
        
        // Apply fixes to the database
        console.log('💾 Applying duration fixes to database...');
        fixedTracks.forEach(({ originalIndex, fixed }) => {
            musicData.musicTracks[originalIndex] = fixed;
        });
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            durationPlaceholderFix: {
                date: new Date().toISOString(),
                fixedTracks: fixedCount,
                fixMethods: Object.fromEntries(fixMethodCounts),
                note: 'Replaced placeholder durations with realistic estimates'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-duration-fix-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log('✅ Database updated with realistic durations');
        
        // Show new statistics
        const allDurations = musicData.musicTracks
            .map(t => t.duration)
            .filter(d => d && d > 0)
            .sort((a, b) => a - b);
        
        const newAverage = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
        const newMedian = allDurations[Math.floor(allDurations.length / 2)];
        
        console.log('\n📊 Updated Duration Statistics:');
        console.log(`  Average: ${Math.round(newAverage)} seconds (${formatDuration(newAverage)})`);
        console.log(`  Median: ${newMedian} seconds (${formatDuration(newMedian)})`);
        console.log(`  Range: ${allDurations[0]}s to ${allDurations[allDurations.length - 1]}s`);
        
    } catch (error) {
        console.error('❌ Error fixing placeholder durations:', error);
    }
}

/**
 * Generate a realistic duration based on track characteristics
 */
function generateRealisticDuration(track) {
    const title = (track.title || '').toLowerCase();
    const artist = (track.feedArtist || '').toLowerCase();
    const album = (track.feedTitle || '').toLowerCase();
    
    // HGH reference tracks - use shorter reference durations
    if (track.source && track.source.includes('HGH')) {
        return getRandomDuration(120, 300); // 2-5 minutes for references
    }
    
    // Zero duration track - check if it's a special case
    if (track.duration === 0) {
        // Long podcast/interview title suggests longer duration
        if (title.includes('presents') || title.includes('royale') || title.includes('interview')) {
            return getRandomDuration(1800, 3600); // 30-60 minutes
        }
    }
    
    // Genre-based duration estimation
    if (title.includes('intro') || title.includes('outro')) {
        return getRandomDuration(30, 90); // 30 seconds - 1.5 minutes
    }
    
    if (title.includes('interlude') || title.includes('skit')) {
        return getRandomDuration(60, 120); // 1-2 minutes
    }
    
    if (title.includes('demo') || title.includes('snippet')) {
        return getRandomDuration(90, 180); // 1.5-3 minutes
    }
    
    // Music genre hints
    if (artist.includes('country') || album.includes('country')) {
        return getRandomDuration(180, 300); // 3-5 minutes
    }
    
    if (artist.includes('folk') || album.includes('folk')) {
        return getRandomDuration(200, 350); // 3.5-6 minutes
    }
    
    if (artist.includes('electronic') || title.includes('beat')) {
        return getRandomDuration(150, 280); // 2.5-4.5 minutes
    }
    
    // Default pop/rock song duration
    return getRandomDuration(180, 330); // 3-5.5 minutes
}

/**
 * Get random duration between min and max seconds
 */
function getRandomDuration(minSeconds, maxSeconds) {
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
}

/**
 * Get description of fix method used
 */
function getDurationFixMethod(track, newDuration) {
    const title = (track.title || '').toLowerCase();
    
    if (track.source && track.source.includes('HGH')) {
        return 'hgh-reference-estimate';
    }
    
    if (track.duration === 0) {
        if (title.includes('presents') || title.includes('royale')) {
            return 'long-form-content-estimate';
        }
        return 'zero-duration-fix';
    }
    
    if (title.includes('intro') || title.includes('outro')) {
        return 'intro-outro-estimate';
    }
    
    if (title.includes('demo') || title.includes('snippet')) {
        return 'demo-snippet-estimate';
    }
    
    return 'standard-song-estimate';
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
fixPlaceholderDurations();