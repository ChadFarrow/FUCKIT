#!/usr/bin/env node

/**
 * Fix All My Life album ID conflict between Hurling Pixels and King Paluta
 */

const fs = require('fs');
const path = require('path');

async function fixAllMyLifeConflict() {
    console.log('🔧 Fixing All My Life album ID conflict...\n');
    
    try {
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find all "All My Life" tracks
        const allMyLifeTracks = musicData.musicTracks.filter(track => 
            track.feedTitle === 'All My Life' || (track.album && track.album === 'All My Life')
        );
        
        console.log(`📀 Found ${allMyLifeTracks.length} "All My Life" tracks:\n`);
        
        allMyLifeTracks.forEach((track, i) => {
            console.log(`${i + 1}. "${track.title}"`);
            console.log(`   Artist: ${track.artist || track.feedArtist || 'N/A'}`);
            console.log(`   Album: ${track.album || track.feedTitle}`);
            console.log(`   Feed GUID: ${track.feedGuid}`);
            console.log(`   Image: ${track.image || 'None'}`);
            console.log(`   Feed URL: ${track.feedUrl}`);
            console.log();
        });
        
        // Group by artist to identify the different albums
        const byArtist = new Map();
        allMyLifeTracks.forEach(track => {
            const artist = track.artist || track.feedArtist || track.publisher || 'Unknown';
            if (!byArtist.has(artist)) {
                byArtist.set(artist, []);
            }
            byArtist.get(artist).push(track);
        });
        
        console.log(`📊 Grouped by artist:`);
        for (const [artist, tracks] of byArtist) {
            console.log(`  • ${artist}: ${tracks.length} track(s)`);
            console.log(`    Image: ${tracks[0].image || 'None'}`);
        }
        
        // The issue is likely that the cache algorithm is using just the album name as ID
        // We need to regenerate with better artist distinction
        console.log('\n🔄 Regenerating optimized cache to fix ID conflicts...');
        
        const { execSync } = require('child_process');
        execSync('node scripts/create-optimized-cache.js', { stdio: 'inherit' });
        
        // Now check the cache result
        console.log('\n🔍 Checking updated cache...');
        const cacheData = JSON.parse(fs.readFileSync('data/albums-cache.json', 'utf8'));
        
        const allMyLifeAlbums = cacheData.albums.filter(album => 
            album.title === 'All My Life'
        );
        
        console.log(`📀 Found ${allMyLifeAlbums.length} "All My Life" albums in cache:`);
        allMyLifeAlbums.forEach((album, i) => {
            console.log(`${i + 1}. ID: ${album.id}`);
            console.log(`   Title: ${album.title}`);
            console.log(`   Artist: ${album.artist}`);
            console.log(`   Cover Art: ${album.coverArt}`);
            console.log();
        });
        
        if (allMyLifeAlbums.length > 1) {
            console.log('⚠️ Still have duplicate IDs. The cache algorithm needs artist-based IDs.');
            console.log('💡 This explains the placeholder - the wrong album is being selected.');
        } else {
            console.log('✅ Album conflict resolved!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixAllMyLifeConflict();