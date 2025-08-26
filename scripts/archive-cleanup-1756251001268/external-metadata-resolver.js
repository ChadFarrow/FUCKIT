#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchMusicBrainz(artist, title) {
    try {
        const query = `artist:"${artist}" AND recording:"${title}"`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://musicbrainz.org/ws/2/recording?query=${encodedQuery}&limit=1&fmt=json`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'FUCKIT-Metadata-Resolver/1.0 (contact@example.com)'
            }
        });
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        
        if (data.recordings && data.recordings.length > 0) {
            const recording = data.recordings[0];
            return {
                duration: recording.length ? Math.round(recording.length / 1000) : null,
                mbid: recording.id,
                confidence: recording.score || 0
            };
        }
        
        return null;
    } catch (error) {
        console.log(`    ❌ MusicBrainz error: ${error.message}`);
        return null;
    }
}

async function searchLastFM(artist, title) {
    // Last.fm requires API key - placeholder for now
    // In a real implementation, you'd register for a Last.fm API key
    console.log(`    🔍 Last.fm search would go here for "${title}" by ${artist}`);
    return null;
}

async function estimateDurationFromTitle(title) {
    // Look for duration hints in the title
    const durationRegex = /\((\d{1,2}):(\d{2})\)/;
    const match = title.match(durationRegex);
    
    if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        return minutes * 60 + seconds;
    }
    
    // Default estimates based on common track types
    if (title.toLowerCase().includes('intro') || title.toLowerCase().includes('interlude')) {
        return 45; // 45 seconds for intros
    }
    
    if (title.toLowerCase().includes('outro')) {
        return 60; // 1 minute for outros
    }
    
    // Generic music track estimate
    return 180; // 3 minutes default
}

async function resolveWithExternalSources() {
    console.log('🌐 External Metadata Resolution\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-external-resolve-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks that need external resolution
    const tracksNeedingDuration = musicData.musicTracks.filter(track => 
        (!track.duration || track.duration === 0) &&
        track.title && track.title !== 'Unknown Track' &&
        track.artist && track.artist !== 'Unknown Artist' &&
        !track.title.startsWith('Track ') && // Skip generic placeholder titles
        !track.title.startsWith('Unindexed') &&
        track.source !== 'podcast:remoteItem (new)' // Skip completely unresolved items
    );
    
    console.log(`Found ${tracksNeedingDuration.length} tracks suitable for external resolution\n`);
    
    if (tracksNeedingDuration.length === 0) {
        console.log('✅ No tracks suitable for external resolution');
        return;
    }
    
    let resolvedCount = 0;
    let musicBrainzCount = 0;
    let estimatedCount = 0;
    let failedCount = 0;
    
    // Process each track
    for (const [index, track] of tracksNeedingDuration.entries()) {
        console.log(`🎵 [${index + 1}/${tracksNeedingDuration.length}] "${track.title}" by ${track.artist}`);
        
        let resolved = false;
        
        // Try MusicBrainz first
        console.log(`    🔍 Searching MusicBrainz...`);
        const mbResult = await searchMusicBrainz(track.artist, track.title);
        
        if (mbResult && mbResult.duration && mbResult.duration > 0) {
            track.duration = mbResult.duration;
            track.externalMetadata = {
                source: 'MusicBrainz',
                mbid: mbResult.mbid,
                confidence: mbResult.confidence,
                resolvedDate: new Date().toISOString()
            };
            
            console.log(`    ✅ Found on MusicBrainz: ${mbResult.duration}s (confidence: ${mbResult.confidence}%)`);
            musicBrainzCount++;
            resolved = true;
        } else {
            console.log(`    ❌ Not found on MusicBrainz`);
        }
        
        // If MusicBrainz failed, try title-based estimation
        if (!resolved) {
            const estimatedDuration = await estimateDurationFromTitle(track.title);
            
            if (estimatedDuration > 0) {
                track.duration = estimatedDuration;
                track.externalMetadata = {
                    source: 'Title-Based Estimation',
                    method: 'pattern-matching',
                    resolvedDate: new Date().toISOString()
                };
                
                console.log(`    ⚖️  Estimated from title: ${estimatedDuration}s`);
                estimatedCount++;
                resolved = true;
            }
        }
        
        if (resolved) {
            resolvedCount++;
        } else {
            console.log(`    ❌ Could not resolve duration`);
            failedCount++;
        }
        
        console.log('');
        
        // Save progress every 10 tracks
        if ((index + 1) % 10 === 0) {
            musicData.metadata.lastUpdated = new Date().toISOString();
            fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
            console.log(`    💾 Progress saved (${resolvedCount} resolved so far)\n`);
        }
        
        // Rate limiting for external APIs
        await delay(1000); // 1 second delay between requests
    }
    
    // Final save
    musicData.metadata.lastExternalResolution = {
        date: new Date().toISOString(),
        tracksProcessed: tracksNeedingDuration.length,
        resolved: resolvedCount,
        musicBrainzResults: musicBrainzCount,
        titleEstimations: estimatedCount,
        failed: failedCount,
        source: 'External Metadata Resolution'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('=' .repeat(60));
    console.log('📊 External Resolution Summary:');
    console.log(`  🎯 Tracks processed: ${tracksNeedingDuration.length}`);
    console.log(`  ✅ Successfully resolved: ${resolvedCount}`);
    console.log(`    🗂️  MusicBrainz: ${musicBrainzCount}`);
    console.log(`    ⚖️  Title estimation: ${estimatedCount}`);
    console.log(`  ❌ Failed to resolve: ${failedCount}`);
    console.log(`  📈 Success rate: ${(resolvedCount/tracksNeedingDuration.length*100).toFixed(1)}%`);
    
    console.log('\n✨ External metadata resolution complete!');
    if (resolvedCount > 0) {
        console.log(`🎵 ${resolvedCount} additional tracks now have duration information.`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('  - Run feed re-indexing for remaining tracks');
    console.log('  - Consider manual resolution for high-value tracks');
}

// Run the external resolution
resolveWithExternalSources().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});