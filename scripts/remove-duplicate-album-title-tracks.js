#!/usr/bin/env node

/**
 * Remove duplicate tracks that have the same title as the album/feed
 * These are often placeholder tracks without audio URLs
 */

const fs = require('fs');
const path = require('path');

function removeDuplicateAlbumTitleTracks() {
    console.log('🔍 Removing duplicate album-title tracks...\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    const originalCount = musicData.musicTracks.length;
    let removedTracks = [];
    
    // Group tracks by feedGuid/feedTitle
    const albumGroups = new Map();
    
    musicData.musicTracks.forEach((track, index) => {
        const key = track.feedGuid || track.feedTitle || 'unknown';
        if (!albumGroups.has(key)) {
            albumGroups.set(key, {
                feedTitle: track.feedTitle,
                feedGuid: track.feedGuid,
                trackIndices: []
            });
        }
        albumGroups.get(key).trackIndices.push(index);
    });
    
    // Find and mark tracks for removal
    const indicesToRemove = new Set();
    
    albumGroups.forEach(album => {
        const albumTracks = album.trackIndices.map(i => ({
            index: i,
            track: musicData.musicTracks[i]
        }));
        
        // For singles (1-2 tracks), remove duplicate without URL
        if (albumTracks.length === 2) {
            const track1 = albumTracks[0].track;
            const track2 = albumTracks[1].track;
            
            // Check if one is titled like the album and has no URL
            if (track1.title === album.feedTitle && !track1.enclosureUrl && track2.enclosureUrl) {
                indicesToRemove.add(albumTracks[0].index);
                removedTracks.push({
                    title: track1.title,
                    album: album.feedTitle,
                    reason: 'Single: album-title track without URL'
                });
            } else if (track2.title === album.feedTitle && !track2.enclosureUrl && track1.enclosureUrl) {
                indicesToRemove.add(albumTracks[1].index);
                removedTracks.push({
                    title: track2.title,
                    album: album.feedTitle,
                    reason: 'Single: album-title track without URL'
                });
            }
        }
        
        // For any album, remove duplicates where one has no URL
        const titleGroups = {};
        albumTracks.forEach(({ index, track }) => {
            const title = track.title;
            if (!titleGroups[title]) titleGroups[title] = [];
            titleGroups[title].push({ index, track });
        });
        
        Object.entries(titleGroups).forEach(([title, tracks]) => {
            if (tracks.length > 1) {
                // Multiple tracks with same title
                const withUrl = tracks.filter(t => t.track.enclosureUrl);
                const withoutUrl = tracks.filter(t => !t.track.enclosureUrl);
                
                // If we have both versions, remove the ones without URLs
                if (withUrl.length > 0 && withoutUrl.length > 0) {
                    withoutUrl.forEach(({ index, track }) => {
                        indicesToRemove.add(index);
                        removedTracks.push({
                            title: track.title,
                            album: album.feedTitle,
                            reason: 'Duplicate without URL'
                        });
                    });
                }
                // If multiple without URLs and title matches album, keep only first
                else if (withoutUrl.length > 1 && title === album.feedTitle) {
                    withoutUrl.slice(1).forEach(({ index, track }) => {
                        indicesToRemove.add(index);
                        removedTracks.push({
                            title: track.title,
                            album: album.feedTitle,
                            reason: 'Multiple album-title tracks without URLs'
                        });
                    });
                }
            }
        });
    });
    
    console.log(`📊 Found ${indicesToRemove.size} duplicate tracks to remove\n`);
    
    if (indicesToRemove.size > 0) {
        // Show what we're removing
        console.log('🗑️ Removing duplicate tracks:');
        const sampleSize = Math.min(20, removedTracks.length);
        removedTracks.slice(0, sampleSize).forEach((track, i) => {
            console.log(`  ${i + 1}. "${track.title}" from "${track.album}" (${track.reason})`);
        });
        if (removedTracks.length > sampleSize) {
            console.log(`  ... and ${removedTracks.length - sampleSize} more`);
        }
        console.log();
        
        // Remove tracks (in reverse order to maintain indices)
        const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
        sortedIndices.forEach(index => {
            musicData.musicTracks.splice(index, 1);
        });
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            duplicateRemoval: {
                date: new Date().toISOString(),
                removedCount: indicesToRemove.size,
                originalCount,
                finalCount: musicData.musicTracks.length,
                note: 'Removed duplicate album-title tracks and tracks without URLs'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-duplicate-removal-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated: ${originalCount} → ${musicData.musicTracks.length} tracks`);
        console.log(`   Removed ${indicesToRemove.size} duplicate tracks`);
    } else {
        console.log('ℹ️ No duplicate tracks found to remove');
    }
}

// Run the cleanup
removeDuplicateAlbumTitleTracks();