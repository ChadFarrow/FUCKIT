#!/usr/bin/env node

/**
 * Check for duplicate tracks in albums
 */

const fs = require('fs');
const path = require('path');

function checkDuplicateTracks() {
    console.log('🔍 Checking for duplicate tracks in albums...\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Group tracks by feedGuid/feedTitle to find albums
    const albumGroups = new Map();
    
    musicData.musicTracks.forEach(track => {
        const key = track.feedGuid || track.feedTitle || 'unknown';
        if (!albumGroups.has(key)) {
            albumGroups.set(key, {
                feedTitle: track.feedTitle,
                feedGuid: track.feedGuid,
                tracks: []
            });
        }
        albumGroups.get(key).tracks.push(track);
    });
    
    // Find albums with duplicate tracks
    const albumsWithDuplicates = [];
    
    albumGroups.forEach((album, key) => {
        const trackTitles = album.tracks.map(t => t.title);
        const uniqueTitles = new Set(trackTitles);
        
        if (uniqueTitles.size < trackTitles.length) {
            // Found duplicates
            const duplicateInfo = {
                feedTitle: album.feedTitle,
                feedGuid: album.feedGuid,
                totalTracks: trackTitles.length,
                uniqueTracks: uniqueTitles.size,
                duplicates: []
            };
            
            // Count duplicates
            const titleCounts = {};
            trackTitles.forEach(title => {
                titleCounts[title] = (titleCounts[title] || 0) + 1;
            });
            
            Object.entries(titleCounts).forEach(([title, count]) => {
                if (count > 1) {
                    duplicateInfo.duplicates.push({ title, count });
                }
            });
            
            albumsWithDuplicates.push(duplicateInfo);
        }
    });
    
    console.log(`📊 Found ${albumsWithDuplicates.length} albums with duplicate tracks\n`);
    
    // Show details for each album with duplicates
    albumsWithDuplicates
        .sort((a, b) => (b.totalTracks - b.uniqueTracks) - (a.totalTracks - a.uniqueTracks))
        .slice(0, 20) // Show top 20
        .forEach((album, index) => {
            console.log(`${index + 1}. "${album.feedTitle}" (${album.feedGuid || 'no guid'})`);
            console.log(`   Total tracks: ${album.totalTracks}, Unique: ${album.uniqueTracks}`);
            console.log(`   Duplicates:`);
            album.duplicates.slice(0, 5).forEach(dup => {
                console.log(`     - "${dup.title}" appears ${dup.count} times`);
            });
            if (album.duplicates.length > 5) {
                console.log(`     ... and ${album.duplicates.length - 5} more`);
            }
            console.log();
        });
    
    // Check specifically for the 3125 album
    console.log('🎯 Checking specific album: 3125 / Man Like Kweks / Reel Richard\n');
    
    const specificAlbum = Array.from(albumGroups.values()).find(album => 
        album.feedTitle && (
            album.feedTitle.includes('3125') ||
            album.feedTitle.includes('Man Like Kweks') ||
            album.feedTitle.includes('Reel Richard')
        )
    );
    
    if (specificAlbum) {
        console.log(`Found album: "${specificAlbum.feedTitle}"`);
        console.log(`Total tracks: ${specificAlbum.tracks.length}`);
        
        // List all tracks
        console.log('\nAll tracks in order:');
        specificAlbum.tracks.forEach((track, i) => {
            console.log(`  ${i + 1}. "${track.title}" (URL: ${track.enclosureUrl ? 'Yes' : 'No'})`);
        });
        
        // Check for exact duplicates
        const seenTitles = new Set();
        const duplicateTitles = new Set();
        specificAlbum.tracks.forEach(track => {
            if (seenTitles.has(track.title)) {
                duplicateTitles.add(track.title);
            }
            seenTitles.add(track.title);
        });
        
        if (duplicateTitles.size > 0) {
            console.log('\n⚠️ Duplicate tracks found:');
            duplicateTitles.forEach(title => {
                const count = specificAlbum.tracks.filter(t => t.title === title).length;
                console.log(`  - "${title}" appears ${count} times`);
            });
        }
    } else {
        console.log('Album not found in database');
    }
}

// Run the check
checkDuplicateTracks();