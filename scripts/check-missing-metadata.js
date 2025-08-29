#!/usr/bin/env node

/**
 * Check for missing metadata across all fields
 */

const fs = require('fs');
const path = require('path');

async function checkMissingMetadata() {
    try {
        console.log('🔍 Checking for missing metadata...\n');
        
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log('📊 Missing Information Analysis:');
        console.log(`Total tracks: ${musicData.musicTracks.length}`);
        console.log();
        
        // Check for missing artists
        const missingArtist = musicData.musicTracks.filter(t => !t.feedArtist || t.feedArtist.trim() === '');
        console.log(`Missing artist: ${missingArtist.length}`);
        
        // Check for missing albums  
        const missingAlbum = musicData.musicTracks.filter(t => !t.feedTitle || t.feedTitle.trim() === '');
        console.log(`Missing album/feed title: ${missingAlbum.length}`);
        
        // Check for missing URLs
        const missingUrl = musicData.musicTracks.filter(t => !t.feedUrl || t.feedUrl.trim() === '');
        console.log(`Missing feed URL: ${missingUrl.length}`);
        
        // Check for missing track URLs
        const missingTrackUrl = musicData.musicTracks.filter(t => !t.url || t.url.trim() === '');
        console.log(`Missing track URL: ${missingTrackUrl.length}`);
        
        // Check for missing GUIDs
        const missingGuid = musicData.musicTracks.filter(t => !t.guid || t.guid.trim() === '');
        console.log(`Missing GUID: ${missingGuid.length}`);
        
        // Check for missing publication dates
        const missingPubDate = musicData.musicTracks.filter(t => !t.pubDate);
        console.log(`Missing publication date: ${missingPubDate.length}`);
        
        // Check for missing descriptions
        const missingDescription = musicData.musicTracks.filter(t => !t.description || t.description.trim() === '');
        console.log(`Missing description: ${missingDescription.length}`);
        
        // Check for missing durations (from previous analysis)
        const missingDuration = musicData.musicTracks.filter(t => 
            t.duration == null || !isFinite(t.duration) || t.duration < 0
        );
        console.log(`Missing duration: ${missingDuration.length}`);
        
        console.log();
        
        // Summary of completion rates
        const total = musicData.musicTracks.length;
        console.log('📈 Data Completion Rates:');
        console.log(`  Artist: ${((total - missingArtist.length) / total * 100).toFixed(1)}%`);
        console.log(`  Album/Feed Title: ${((total - missingAlbum.length) / total * 100).toFixed(1)}%`);
        console.log(`  Duration: ${((total - missingDuration.length) / total * 100).toFixed(1)}%`);
        console.log(`  Feed URL: ${((total - missingUrl.length) / total * 100).toFixed(1)}%`);
        console.log(`  Track URL: ${((total - missingTrackUrl.length) / total * 100).toFixed(1)}%`);
        console.log(`  GUID: ${((total - missingGuid.length) / total * 100).toFixed(1)}%`);
        console.log(`  Publication Date: ${((total - missingPubDate.length) / total * 100).toFixed(1)}%`);
        console.log(`  Description: ${((total - missingDescription.length) / total * 100).toFixed(1)}%`);
        
        // Show samples of missing data
        if (missingTrackUrl.length > 0) {
            console.log('\n❌ Sample tracks missing track URLs:');
            missingTrackUrl.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i+1}. "${track.title}" - Artist: "${track.feedArtist || 'Unknown'}"`);
            });
        }
        
        if (missingDescription.length > 0) {
            console.log('\n❌ Sample tracks missing descriptions:');
            missingDescription.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i+1}. "${track.title}" - Artist: "${track.feedArtist || 'Unknown'}"`);
            });
        }
        
        if (missingGuid.length > 0) {
            console.log('\n❌ Sample tracks missing GUIDs:');
            missingGuid.slice(0, 5).forEach((track, i) => {
                console.log(`  ${i+1}. "${track.title}" - Artist: "${track.feedArtist || 'Unknown'}"`);
            });
        }
        
        // Check for enhanced metadata availability
        const enhancedDbPath = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
        if (fs.existsSync(enhancedDbPath)) {
            const enhancedData = JSON.parse(fs.readFileSync(enhancedDbPath, 'utf8'));
            console.log(`\n📊 Enhanced metadata available for ${enhancedData.enhancedTracks.length} tracks`);
            
            // Check enhancement coverage
            const enhancedCoverage = (enhancedData.enhancedTracks.length / total * 100).toFixed(1);
            console.log(`Enhanced coverage: ${enhancedCoverage}%`);
        }
        
        console.log('\n✅ Missing metadata analysis completed');
        
    } catch (error) {
        console.error('❌ Error checking missing metadata:', error);
    }
}

// Run the check
checkMissingMetadata();