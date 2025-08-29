#!/usr/bin/env node

/**
 * Fix duplicate "Pour Me Some Water" track in Jimmy V - Music album
 */

const fs = require('fs');
const path = require('path');

function fixJimmyVDuplicate() {
    console.log('🔍 Fixing Jimmy V duplicate track...\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    const originalCount = musicData.musicTracks.length;
    
    // Find Jimmy V tracks
    const jimmyVTracks = musicData.musicTracks.filter(track => 
        track.feedTitle && track.feedTitle.includes('Jimmy V')
    );
    
    console.log(`📊 Found ${jimmyVTracks.length} Jimmy V tracks`);
    console.log(`Feed title: "${jimmyVTracks[0]?.feedTitle}"`);
    console.log(`Feed URL: ${jimmyVTracks[0]?.feedUrl}\n`);
    
    // Group by title to find duplicates
    const titleCounts = {};
    jimmyVTracks.forEach(track => {
        const title = track.title;
        if (!titleCounts[title]) titleCounts[title] = [];
        titleCounts[title].push(track);
    });
    
    console.log('📋 All Jimmy V tracks:');
    Object.entries(titleCounts).forEach(([title, tracks]) => {
        const status = tracks.length > 1 ? '🔴 DUPLICATE' : '✅';
        console.log(`  ${status} "${title}" (${tracks.length} copies)`);
        if (tracks.length > 1) {
            tracks.forEach((track, i) => {
                console.log(`    ${i + 1}. Audio URL: ${track.enclosureUrl ? 'Yes' : 'No'}`);
                console.log(`       Duration: ${track.duration}s`);
                console.log(`       GUID: ${track.guid}`);
            });
        }
    });
    
    // Find "Pour Me Some Water" duplicates
    const pourMeWaterTracks = titleCounts['Pour Me Some Water'] || [];
    if (pourMeWaterTracks.length > 1) {
        console.log(`\n🎯 Found ${pourMeWaterTracks.length} "Pour Me Some Water" tracks`);
        
        // Keep the one with audio URL, or the first one if both/neither have audio
        const withAudio = pourMeWaterTracks.filter(t => t.enclosureUrl);
        const trackToKeep = withAudio.length > 0 ? withAudio[0] : pourMeWaterTracks[0];
        const tracksToRemove = pourMeWaterTracks.filter(t => t !== trackToKeep);
        
        console.log(`📌 Keeping track with GUID: ${trackToKeep.guid}`);
        console.log(`🗑️ Removing ${tracksToRemove.length} duplicate(s):`);
        
        tracksToRemove.forEach(track => {
            console.log(`   - GUID: ${track.guid}, Audio: ${track.enclosureUrl ? 'Yes' : 'No'}`);
        });
        
        // Remove duplicates from database
        const guidsToRemove = tracksToRemove.map(t => t.guid);
        musicData.musicTracks = musicData.musicTracks.filter(track => 
            !guidsToRemove.includes(track.guid)
        );
        
        console.log(`\n✅ Removed ${tracksToRemove.length} duplicate "Pour Me Some Water" track(s)`);
    } else {
        console.log('\n✅ No "Pour Me Some Water" duplicates found');
    }
    
    const finalCount = musicData.musicTracks.length;
    const removedCount = originalCount - finalCount;
    
    if (removedCount > 0) {
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            jimmyVDuplicateFix: {
                date: new Date().toISOString(),
                removedTracks: removedCount,
                note: 'Removed duplicate "Pour Me Some Water" track from Jimmy V - Music album'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-jimmy-v-fix-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`💾 Database updated: ${originalCount} → ${finalCount} tracks (-${removedCount})`);
    } else {
        console.log('💫 No changes needed');
    }
}

fixJimmyVDuplicate();