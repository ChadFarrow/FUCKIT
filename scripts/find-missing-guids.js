#!/usr/bin/env node

/**
 * Find and generate missing GUIDs for tracks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function findMissingGuids() {
    try {
        console.log('🔍 Finding and generating missing GUIDs...\n');
        
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        const withoutGuid = musicData.musicTracks.filter(t => !t.guid || t.guid.trim() === '');
        console.log(`Found ${withoutGuid.length} tracks without GUIDs\n`);
        
        if (withoutGuid.length === 0) {
            console.log('✅ All tracks already have GUIDs');
            return;
        }
        
        let generatedCount = 0;
        const generationMethods = new Map();
        
        // Strategy 1: Try enhanced RSS parsing for feeds that might have GUIDs
        console.log('📊 Strategy 1: Enhanced RSS parsing for popular feeds...');
        
        const feedCounts = new Map();
        withoutGuid.forEach(track => {
            const feedUrl = track.feedUrl;
            feedCounts.set(feedUrl, (feedCounts.get(feedUrl) || 0) + 1);
        });
        
        const popularFeeds = [...feedCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 feeds by track count
        
        console.log('Top feeds missing GUIDs:');
        popularFeeds.forEach(([feedUrl, count]) => {
            const domain = feedUrl ? new URL(feedUrl).hostname : 'unknown';
            console.log(`  ${domain}: ${count} tracks`);
        });
        console.log();
        
        // Strategy 2: Generate deterministic GUIDs based on feed + title + artist
        console.log('📊 Strategy 2: Generating deterministic GUIDs...');
        
        const guidMap = new Map(); // Track duplicates
        
        withoutGuid.forEach((track, index) => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            
            // Create deterministic seed from track metadata
            const seedData = [
                track.feedUrl || '',
                track.title || '',
                track.feedArtist || '',
                track.feedTitle || '',
                track.pubDate || '',
                originalIndex.toString() // Ensure uniqueness
            ].join('|');
            
            // Generate UUID v5-style deterministic GUID
            const hash = crypto.createHash('sha256').update(seedData).digest('hex');
            const uuid = [
                hash.substring(0, 8),
                hash.substring(8, 12),
                '5' + hash.substring(13, 16), // Version 5
                ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
                hash.substring(20, 32)
            ].join('-');
            
            // Check for duplicates (shouldn't happen with index in seed)
            if (guidMap.has(uuid)) {
                console.warn(`⚠️ Duplicate GUID generated for "${track.title}"`);
            }
            guidMap.set(uuid, true);
            
            // Update track with generated GUID
            musicData.musicTracks[originalIndex] = {
                ...track,
                guid: uuid,
                guidGenerated: true,
                guidGeneratedAt: new Date().toISOString(),
                guidGeneratedMethod: 'deterministic-hash'
            };
            
            generatedCount++;
            generationMethods.set('deterministic-hash', (generationMethods.get('deterministic-hash') || 0) + 1);
        });
        
        console.log(`Generated ${generatedCount} deterministic GUIDs`);
        console.log();
        
        // Show sample generated GUIDs
        console.log('✅ Sample generated GUIDs:');
        const samplesWithNewGuids = musicData.musicTracks
            .filter(t => t.guidGenerated)
            .slice(0, 5);
            
        samplesWithNewGuids.forEach((track, i) => {
            console.log(`  ${i+1}. "${track.title}" by "${track.feedArtist}"`);
            console.log(`      GUID: ${track.guid}`);
            console.log(`      Method: ${track.guidGeneratedMethod}`);
            console.log();
        });
        
        // Generation method summary
        console.log('📈 GUID Generation Methods:');
        [...generationMethods.entries()].forEach(([method, count]) => {
            console.log(`  ${method}: ${count} GUIDs`);
        });
        console.log();
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            guidGeneration: {
                date: new Date().toISOString(),
                generatedCount,
                methods: Object.fromEntries(generationMethods),
                note: 'Generated deterministic GUIDs for tracks missing GUID data'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-guid-generation-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8')); // Original data
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log('✅ Database updated with generated GUIDs');
        
        // Final statistics
        const finalWithGuids = musicData.musicTracks.filter(t => t.guid && t.guid.trim() !== '');
        const completionRate = ((finalWithGuids.length / musicData.musicTracks.length) * 100).toFixed(1);
        
        console.log('\n📊 Final GUID Statistics:');
        console.log(`  Tracks with GUIDs: ${finalWithGuids.length}/${musicData.musicTracks.length} (${completionRate}%)`);
        console.log(`  Generated GUIDs: ${generatedCount}`);
        console.log(`  Pre-existing GUIDs: ${finalWithGuids.length - generatedCount}`);
        
        console.log('\n🎯 GUID generation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error finding missing GUIDs:', error);
    }
}

// Run the GUID finding
findMissingGuids();