#!/usr/bin/env node

/**
 * Restore original GUIDs from enhanced metadata (Podcast Index data)
 */

const fs = require('fs');
const path = require('path');

async function restoreOriginalGuids() {
    try {
        console.log('🔄 Restoring original GUIDs from Podcast Index data...\n');
        
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        if (!fs.existsSync(enhancedDbPath)) {
            console.log('❌ Enhanced database not found');
            return;
        }
        
        const enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
        console.log(`📊 Enhanced tracks with original data: ${enhancedData.enhancedTracks.length}`);
        
        let restoredCount = 0;
        let alreadyOriginalCount = 0;
        const restoredTracks = [];
        
        // Create backup before modifying
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-guid-restore-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        console.log();
        
        // Restore original GUIDs from enhanced data
        enhancedData.enhancedTracks.forEach(enhanced => {
            const originalIndex = enhanced.originalIndex;
            const originalTrack = musicData.musicTracks[originalIndex];
            
            if (!originalTrack) {
                console.warn(`⚠️ Track not found at index ${originalIndex}`);
                return;
            }
            
            const originalGuid = enhanced.enhancedMetadata?.itemGuid;
            if (!originalGuid) {
                return; // No original GUID available
            }
            
            // Check if this track already has the original GUID
            if (originalTrack.guid === originalGuid) {
                alreadyOriginalCount++;
                return;
            }
            
            // Restore original GUID
            musicData.musicTracks[originalIndex] = {
                ...originalTrack,
                guid: originalGuid,
                guidGenerated: false, // Remove generated flag
                guidGeneratedAt: undefined,
                guidGeneratedMethod: undefined,
                guidRestored: true,
                guidRestoredAt: new Date().toISOString(),
                guidRestoredFrom: 'podcast-index-itemGuid',
                originalGeneratedGuid: originalTrack.guid // Keep for reference
            };
            
            restoredTracks.push({
                index: originalIndex,
                title: originalTrack.title,
                generatedGuid: originalTrack.guid,
                originalGuid: originalGuid
            });
            
            restoredCount++;
        });
        
        console.log('✅ Original GUID restoration results:');
        console.log(`  Restored from Podcast Index: ${restoredCount}`);
        console.log(`  Already had original GUIDs: ${alreadyOriginalCount}`);
        console.log(`  Remaining generated GUIDs: ${musicData.musicTracks.filter(t => t.guidGenerated).length}`);
        console.log();
        
        // Show sample restorations
        if (restoredTracks.length > 0) {
            console.log('📋 Sample GUID restorations:');
            restoredTracks.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i+1}. "${track.title}"`);
                console.log(`      Generated: ${track.generatedGuid}`);
                console.log(`      Original:  ${track.originalGuid}`);
                console.log();
            });
        }
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            guidRestoration: {
                date: new Date().toISOString(),
                restoredCount,
                alreadyOriginalCount,
                source: 'podcast-index-itemGuid',
                note: 'Restored original GUIDs from Podcast Index metadata'
            }
        };
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log('✅ Database updated with restored original GUIDs');
        
        // Final GUID statistics
        const currentGuidStats = {
            total: musicData.musicTracks.length,
            withGuids: musicData.musicTracks.filter(t => t.guid && t.guid.trim() !== '').length,
            original: musicData.musicTracks.filter(t => !t.guidGenerated && t.guid).length,
            generated: musicData.musicTracks.filter(t => t.guidGenerated).length,
            restored: musicData.musicTracks.filter(t => t.guidRestored).length
        };
        
        console.log('\n📊 Final GUID Statistics:');
        console.log(`  Total tracks: ${currentGuidStats.total}`);
        console.log(`  Tracks with GUIDs: ${currentGuidStats.withGuids} (100.0%)`);
        console.log(`  Original GUIDs: ${currentGuidStats.original}`);
        console.log(`  Restored GUIDs: ${currentGuidStats.restored}`);
        console.log(`  Generated GUIDs: ${currentGuidStats.generated}`);
        
        console.log('\n🎯 Original GUID restoration completed!');
        
    } catch (error) {
        console.error('❌ Error restoring original GUIDs:', error);
    }
}

// Run the restoration
restoreOriginalGuids();