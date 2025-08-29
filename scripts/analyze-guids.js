#!/usr/bin/env node

/**
 * Analyze existing GUIDs and develop strategy to find missing ones
 */

const fs = require('fs');
const path = require('path');

async function analyzeGuids() {
    try {
        console.log('🔍 Analyzing GUID patterns and missing data...\n');
        
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Analyze existing GUIDs
        const withGuid = musicData.musicTracks.filter(t => t.guid && t.guid.trim() !== '');
        const withoutGuid = musicData.musicTracks.filter(t => !t.guid || t.guid.trim() === '');
        
        console.log('📊 GUID Analysis:');
        console.log(`Tracks with GUIDs: ${withGuid.length}`);
        console.log(`Tracks without GUIDs: ${withoutGuid.length}`);
        console.log();
        
        // Analyze GUID patterns
        const guidPatterns = new Map();
        withGuid.forEach(track => {
            const guid = track.guid;
            if (guid.startsWith('http')) {
                guidPatterns.set('URL', (guidPatterns.get('URL') || 0) + 1);
            } else if (guid.includes('-') && guid.length >= 32) {
                guidPatterns.set('UUID-style', (guidPatterns.get('UUID-style') || 0) + 1);
            } else if (guid.match(/^\d+$/)) {
                guidPatterns.set('Numeric', (guidPatterns.get('Numeric') || 0) + 1);
            } else {
                guidPatterns.set('Other', (guidPatterns.get('Other') || 0) + 1);
            }
        });
        
        console.log('🔍 GUID Pattern Analysis:');
        [...guidPatterns.entries()].forEach(([pattern, count]) => {
            console.log(`  ${pattern}: ${count} tracks`);
        });
        console.log();
        
        // Show sample GUIDs
        console.log('📋 Sample existing GUIDs:');
        withGuid.slice(0, 5).forEach((track, i) => {
            const guidPreview = track.guid.length > 60 ? track.guid.substring(0, 60) + '...' : track.guid;
            console.log(`  ${i+1}. "${track.title}" - ${guidPreview}`);
        });
        console.log();
        
        // Analyze tracks without GUIDs by source
        const bySource = new Map();
        withoutGuid.forEach(track => {
            try {
                const domain = track.feedUrl ? new URL(track.feedUrl).hostname : 'unknown';
                bySource.set(domain, (bySource.get(domain) || 0) + 1);
            } catch (e) {
                bySource.set('invalid-url', (bySource.get('invalid-url') || 0) + 1);
            }
        });
        
        console.log('📊 Missing GUIDs by feed domain:');
        [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([domain, count]) => {
            console.log(`  ${domain}: ${count} tracks`);
        });
        console.log();
        
        // Check if enhanced metadata has GUIDs
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        if (fs.existsSync(enhancedDbPath)) {
            const enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
            
            const enhancedWithGuids = enhancedData.enhancedTracks.filter(t => 
                t.enhancedMetadata?.guid || t.enhancedMetadata?.id
            );
            
            console.log('🚀 Enhanced metadata with GUIDs:');
            console.log(`  Enhanced tracks with GUID/ID: ${enhancedWithGuids.length}/${enhancedData.enhancedTracks.length}`);
            
            if (enhancedWithGuids.length > 0) {
                console.log('  Sample enhanced GUIDs:');
                enhancedWithGuids.slice(0, 3).forEach((track, i) => {
                    const guid = track.enhancedMetadata.guid || track.enhancedMetadata.id;
                    console.log(`    ${i+1}. ${guid}`);
                });
            }
            console.log();
        }
        
        // Analyze potential GUID generation strategies
        console.log('💡 GUID Generation Strategies:');
        
        // Strategy 1: Use URL + title hash
        const urlBasedCandidates = withoutGuid.filter(t => t.url && t.url.trim() !== '');
        console.log(`  1. URL-based GUIDs: ${urlBasedCandidates.length} tracks have track URLs`);
        
        // Strategy 2: Use feed URL + title hash
        const feedBasedCandidates = withoutGuid.filter(t => t.feedUrl);
        console.log(`  2. Feed + title hash: ${feedBasedCandidates.length} tracks available`);
        
        // Strategy 3: Enhanced RSS parsing for more feeds
        const uniqueFeeds = new Set(withoutGuid.map(t => t.feedUrl));
        console.log(`  3. Enhanced RSS parsing: ${uniqueFeeds.size} unique feeds to re-parse`);
        
        // Strategy 4: Generate deterministic UUIDs
        console.log(`  4. Generated UUIDs: All ${withoutGuid.length} tracks can get generated GUIDs`);
        console.log();
        
        // Sample tracks needing GUIDs
        console.log('❌ Sample tracks needing GUIDs:');
        withoutGuid.slice(0, 5).forEach((track, i) => {
            const feedDomain = track.feedUrl ? new URL(track.feedUrl).hostname : 'unknown';
            console.log(`  ${i+1}. "${track.title}" by "${track.feedArtist}"`);
            console.log(`      Feed: ${feedDomain}`);
            console.log(`      Has track URL: ${!!track.url}`);
            console.log();
        });
        
        console.log('✅ GUID analysis completed');
        
    } catch (error) {
        console.error('❌ Error analyzing GUIDs:', error);
    }
}

// Run the analysis
analyzeGuids();