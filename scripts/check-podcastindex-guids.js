#!/usr/bin/env node

/**
 * Check Podcast Index API for original track GUIDs
 */

const fs = require('fs');
const path = require('path');

async function checkPodcastIndexGuids() {
    try {
        console.log('🔍 Checking for original GUIDs from Podcast Index data...\n');
        
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Check enhanced database for original GUID data
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        if (fs.existsSync(enhancedDbPath)) {
            const enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
            console.log(`📊 Enhanced tracks available: ${enhancedData.enhancedTracks.length}`);
            
            // Check what GUID fields are available in enhanced data
            const guidFields = new Set();
            let tracksWithOriginalGuids = 0;
            
            enhancedData.enhancedTracks.forEach(track => {
                const metadata = track.enhancedMetadata || {};
                
                Object.keys(metadata).forEach(key => {
                    if (key.toLowerCase().includes('guid') || key.toLowerCase().includes('id')) {
                        guidFields.add(key);
                    }
                });
                
                // Check for actual GUID values
                if (metadata.guid || metadata.id || metadata.episodeId) {
                    tracksWithOriginalGuids++;
                }
            });
            
            console.log('🔍 GUID-related fields in enhanced data:');
            [...guidFields].forEach(field => {
                console.log(`  - ${field}`);
            });
            console.log(`📊 Enhanced tracks with original GUIDs: ${tracksWithOriginalGuids}`);
            console.log();
            
            // Sample enhanced tracks with GUIDs
            const samplesWithGuids = enhancedData.enhancedTracks
                .filter(t => t.enhancedMetadata?.guid || t.enhancedMetadata?.id)
                .slice(0, 5);
                
            if (samplesWithGuids.length > 0) {
                console.log('📋 Sample original GUIDs from enhanced data:');
                samplesWithGuids.forEach((track, i) => {
                    const guid = track.enhancedMetadata.guid || track.enhancedMetadata.id;
                    const originalTrack = musicData.musicTracks[track.originalIndex];
                    console.log(`  ${i+1}. Original GUID: ${guid}`);
                    console.log(`      Generated GUID: ${originalTrack?.guid}`);
                    console.log(`      Track: "${originalTrack?.title}"`);
                    console.log();
                });
            }
        } else {
            console.log('❌ No enhanced database found');
        }
        
        // Check if we should prioritize original RSS parsing for GUIDs
        console.log('💡 Recommendations:');
        console.log('1. Re-parse RSS feeds directly to get original <guid> elements');
        console.log('2. Use enhanced RSS parser on feeds missing GUIDs');
        console.log('3. Check if Podcast Index episode lookup provides GUIDs');
        console.log('4. Keep generated GUIDs as fallback for truly missing ones');
        console.log();
        
        // Check what feeds we should re-parse
        const generatedGuidTracks = musicData.musicTracks.filter(t => t.guidGenerated);
        const feedUrls = new Set(generatedGuidTracks.map(t => t.feedUrl));
        
        console.log(`📊 Feeds to re-parse for original GUIDs: ${feedUrls.size}`);
        console.log('Top feeds by track count:');
        
        const feedCounts = new Map();
        generatedGuidTracks.forEach(track => {
            feedCounts.set(track.feedUrl, (feedCounts.get(track.feedUrl) || 0) + 1);
        });
        
        [...feedCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([feedUrl, count]) => {
                try {
                    const domain = new URL(feedUrl).hostname;
                    console.log(`  ${domain}: ${count} tracks`);
                } catch (e) {
                    console.log(`  ${feedUrl}: ${count} tracks`);
                }
            });
        
        console.log('\n✅ Podcast Index GUID check completed');
        
    } catch (error) {
        console.error('❌ Error checking Podcast Index GUIDs:', error);
    }
}

// Run the check
checkPodcastIndexGuids();