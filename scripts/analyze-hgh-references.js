#!/usr/bin/env node

/**
 * Analyze HGH playlist references to understand their structure
 */

const fs = require('fs');
const path = require('path');

async function analyzeHGHReferences() {
    try {
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log('🔍 Analyzing HGH playlist references...\n');
        
        // Filter HGH tracks
        const hghTracks = musicData.musicTracks.filter(track => 
            track.source && (
                track.source.includes('HGH') || 
                track.extractionMethod === 'HGH Featured Track - Unresolved'
            )
        );
        
        console.log(`Found ${hghTracks.length} HGH-related tracks\n`);
        
        // Group by source type
        const sourceTypes = new Map();
        hghTracks.forEach(track => {
            const source = track.source || track.extractionMethod || 'unknown';
            if (!sourceTypes.has(source)) {
                sourceTypes.set(source, []);
            }
            sourceTypes.get(source).push(track);
        });
        
        console.log('📊 HGH Tracks by Source Type:');
        [...sourceTypes.entries()].forEach(([source, tracks]) => {
            console.log(`\n${source}: ${tracks.length} tracks`);
            
            // Show sample tracks
            console.log('Sample tracks:');
            tracks.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Album: "${track.feedTitle || '(empty)'}"`);
                console.log(`     Artist: "${track.feedArtist || '(empty)'}"`);
                console.log(`     GUID: ${track.itemGuid?._ || '(none)'}`);
                console.log(`     Feed GUID: ${track.feedGuid || '(none)'}`);
                console.log(`     Episode ID: ${track.episodeId || '(none)'}`);
                console.log(`     Duration: ${track.duration || '(none)'}`);
                console.log();
            });
        });
        
        // Look for any patterns in the track data
        console.log('🔍 Looking for resolution patterns...');
        
        const hghWithGuids = hghTracks.filter(track => track.feedGuid && track.itemGuid?._);
        const hghWithEpisodeId = hghTracks.filter(track => track.episodeId);
        const hghWithDuration = hghTracks.filter(track => track.duration);
        
        console.log(`Tracks with feedGuid + itemGuid: ${hghWithGuids.length}`);
        console.log(`Tracks with episodeId: ${hghWithEpisodeId.length}`);
        console.log(`Tracks with duration: ${hghWithDuration.length}`);
        
        if (hghWithGuids.length > 0) {
            console.log('\nSample HGH tracks with GUIDs (potential for resolution):');
            hghWithGuids.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Feed GUID: ${track.feedGuid}`);
                console.log(`     Item GUID: ${track.itemGuid._}`);
                console.log(`     Episode ID: ${track.episodeId || '(none)'}`);
            });
        }
        
        // Check if any HGH tracks have been enhanced
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        if (fs.existsSync(enhancedDbPath)) {
            const enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
            
            // Find HGH tracks in enhanced database
            let hghEnhancedCount = 0;
            const enhancedHghTracks = [];
            
            enhancedData.enhancedTracks.forEach(enhanced => {
                const originalIndex = enhanced.originalIndex;
                if (typeof originalIndex === 'number') {
                    const originalTrack = musicData.musicTracks[originalIndex];
                    if (originalTrack && originalTrack.source && originalTrack.source.includes('HGH')) {
                        hghEnhancedCount++;
                        enhancedHghTracks.push({
                            originalIndex,
                            original: originalTrack,
                            enhanced: enhanced
                        });
                    }
                }
            });
            
            console.log(`\n🚀 Enhanced HGH tracks: ${hghEnhancedCount}`);
            
            if (enhancedHghTracks.length > 0) {
                console.log('\nSample enhanced HGH tracks:');
                enhancedHghTracks.slice(0, 5).forEach((item, i) => {
                    console.log(`  ${i + 1}. Original: "${item.original.title}"`);
                    console.log(`     Enhanced Artist: "${item.enhanced.enhancedMetadata?.artist || '(none)'}"`);
                    console.log(`     Enhanced Album: "${item.enhanced.enhancedMetadata?.albumTitle || '(none)'}"`);
                    console.log(`     Audio URL: ${item.enhanced.enhancedMetadata?.audioUrl ? 'Yes' : 'No'}`);
                });
            }
        }
        
        console.log('\n💡 Resolution Strategy:');
        console.log(`1. HGH tracks with GUIDs (${hghWithGuids.length}) - Try enhanced RSS parsing`);
        console.log(`2. HGH tracks with episode IDs (${hghWithEpisodeId.length}) - Look up via Podcast Index API`);
        console.log(`3. Extract artist from track titles where possible`);
        console.log(`4. Manual curation for high-value tracks`);
        
    } catch (error) {
        console.error('❌ Error analyzing HGH references:', error);
    }
}

// Run the analysis
analyzeHGHReferences();