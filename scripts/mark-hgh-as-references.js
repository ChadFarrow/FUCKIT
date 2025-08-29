#!/usr/bin/env node

/**
 * Mark HGH tracks as music references with appropriate metadata
 */

const fs = require('fs');
const path = require('path');

async function markHGHAsReferences() {
    try {
        console.log('🔍 Marking HGH tracks as music references...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find HGH tracks
        const hghTracks = musicData.musicTracks.filter(track => 
            track.source && track.source.includes('HGH')
        );
        
        console.log(`Found ${hghTracks.length} HGH reference tracks\n`);
        
        if (hghTracks.length === 0) {
            console.log('✅ No HGH tracks to process');
            return;
        }
        
        const updatedTracks = [];
        let updatedCount = 0;
        
        hghTracks.forEach(track => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            
            // Update HGH track with proper reference metadata
            const updatedTrack = {
                ...track,
                feedArtist: 'Homegrown Hits Music Reference',
                feedTitle: 'Music Reference from Homegrown Hits Playlist',
                feedDescription: 'This track is a music reference from the Homegrown Hits podcast playlist. The original feed is no longer available.',
                feedUrl: 'https://homegrownhits.xyz',
                isReference: true,
                referenceSource: 'homegrown-hits-playlist',
                referenceNote: 'Original music feed no longer accessible',
                updatedAt: new Date().toISOString()
            };
            
            updatedTracks.push({
                originalIndex,
                updated: updatedTrack
            });
            updatedCount++;
        });
        
        console.log(`📊 Update Results:`);
        console.log(`Updated HGH reference tracks: ${updatedCount}\n`);
        
        console.log(`✅ Sample updated tracks:`);
        updatedTracks.slice(0, 10).forEach((item, i) => {
            const track = item.updated;
            console.log(`  ${i + 1}. "${track.title}"`);
            console.log(`     Artist: "${track.feedArtist}"`);
            console.log(`     Album: "${track.feedTitle}"`);
            console.log(`     Reference: ${track.isReference}`);
            console.log();
        });
        
        // Apply updates to the database
        console.log('💾 Applying reference metadata to database...');
        updatedTracks.forEach(({ originalIndex, updated }) => {
            musicData.musicTracks[originalIndex] = updated;
        });
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            hghReferenceUpdate: {
                date: new Date().toISOString(),
                updatedTracks: updatedCount,
                note: 'HGH tracks marked as music references due to inaccessible original feeds'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-hgh-references-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log('✅ Database updated with HGH reference metadata');
        
    } catch (error) {
        console.error('❌ Error marking HGH as references:', error);
    }
}

// Run the update
markHGHAsReferences();