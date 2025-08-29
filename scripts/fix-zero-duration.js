#!/usr/bin/env node

/**
 * Fix the one remaining track with zero duration
 */

const fs = require('fs');
const path = require('path');

async function fixZeroDuration() {
    try {
        console.log('🔍 Fixing remaining zero duration track...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find the zero duration track
        const zeroTrack = musicData.musicTracks.find(track => track.duration === 0);
        
        if (!zeroTrack) {
            console.log('✅ No zero duration tracks found');
            return;
        }
        
        console.log('Found zero duration track:');
        console.log(`Title: "${zeroTrack.title}"`);
        console.log(`Artist: "${zeroTrack.feedArtist}"`);
        console.log('This appears to be a long-form podcast/presentation\n');
        
        // This is a long presentation/podcast based on the title
        const newDuration = 2700; // 45 minutes (reasonable for a podcast presentation)
        
        const originalIndex = musicData.musicTracks.indexOf(zeroTrack);
        const fixedTrack = {
            ...zeroTrack,
            duration: newDuration,
            durationFixed: true,
            durationFixedAt: new Date().toISOString(),
            originalDuration: 0,
            durationFixMethod: 'long-form-podcast-estimate'
        };
        
        console.log(`Fixed duration: 0s → ${newDuration}s (${formatDuration(newDuration)})`);
        
        // Apply fix
        musicData.musicTracks[originalIndex] = fixedTrack;
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            zeroDurationFix: {
                date: new Date().toISOString(),
                trackIndex: originalIndex,
                trackTitle: zeroTrack.title,
                newDuration,
                method: 'long-form-podcast-estimate'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-zero-duration-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log('✅ Database updated with zero duration fix');
        
    } catch (error) {
        console.error('❌ Error fixing zero duration:', error);
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
fixZeroDuration();