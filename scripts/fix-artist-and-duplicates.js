#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the data files
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Create a backup of the original file
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`Creating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

let fixedArtistCount = 0;
let removedDuplicates = 0;

// Fix 1: Update artist name for "More" album
console.log('\n🎵 Fixing artist name for "More" album...');
musicData.musicTracks = musicData.musicTracks.map(track => {
    // Fix the "More" album - artist should be "Nate Johnivan"
    if (track.album === "More" || track.albumTitle === "More") {
        if (track.artist === "More" && track.publisher === "Nate Johnivan") {
            track.artist = "Nate Johnivan";
            track.artistName = "Nate Johnivan";
            fixedArtistCount++;
        }
    }
    return track;
});

console.log(`✅ Fixed ${fixedArtistCount} tracks with incorrect artist name for "More" album`);

// Fix 2: Remove duplicate albums
console.log('\n🎵 Removing duplicate albums...');

// Group tracks by album + artist to find duplicates
const albumGroups = new Map();
musicData.musicTracks.forEach(track => {
    const key = `${track.album || track.albumTitle}|${track.artist}`;
    if (!albumGroups.has(key)) {
        albumGroups.set(key, []);
    }
    albumGroups.get(key).push(track);
});

// List of albums to check for duplicates
const duplicateAlbums = [
    { album: 'think of me in color', artist: 'ryan fonda' },
    { album: 'bourbon at dawn', artist: 'sara jade' },
    { album: 'cash back', artist: 'sara jade' }
];

duplicateAlbums.forEach(({ album: albumName, artist: artistName }) => {
    // Find matching album
    const albumKey = Array.from(albumGroups.keys()).find(key => 
        key.toLowerCase().includes(albumName) && 
        key.toLowerCase().includes(artistName)
    );
    
    if (albumKey) {
        const duplicateTracks = albumGroups.get(albumKey);
        console.log(`\nFound ${duplicateTracks.length} tracks for "${albumName}" by ${artistName}`);
        
        // Group by feedUrl to identify actual duplicates
        const feedUrlGroups = new Map();
        duplicateTracks.forEach(track => {
            // Normalize feed URLs (remove /music/ or trailing differences)
            let feedUrl = track.feedUrl || track.feedGuid || 'unknown';
            feedUrl = feedUrl.replace('/feed/music/', '/feed/').replace('/feed/', '/feed/');
            
            if (!feedUrlGroups.has(feedUrl)) {
                feedUrlGroups.set(feedUrl, []);
            }
            feedUrlGroups.get(feedUrl).push(track);
        });
        
        // Check if we have duplicate feed URLs (same content, different URL formats)
        const normalizedUrls = new Map();
        feedUrlGroups.forEach((tracks, feedUrl) => {
            // Extract GUID from URL if it's a Wavlake URL
            const guidMatch = feedUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            const key = guidMatch ? guidMatch[1] : feedUrl;
            
            if (!normalizedUrls.has(key)) {
                normalizedUrls.set(key, []);
            }
            normalizedUrls.get(key).push(...tracks);
        });
        
        // If we have duplicates based on GUID, keep only one version
        normalizedUrls.forEach((tracks, guid) => {
            if (tracks.length > 1) {
                console.log(`  Found ${tracks.length} duplicate entries for GUID: ${guid}`);
                
                // Keep the track with the most complete metadata
                let bestTrack = tracks[0];
                let bestScore = 0;
                
                tracks.forEach(track => {
                    const score = 
                        (track.image ? 1 : 0) + 
                        (track.feedImage ? 1 : 0) + 
                        (track.publisherFeedGuid ? 1 : 0) +
                        (track.publisher ? 1 : 0) +
                        (track.artistUrl ? 1 : 0) +
                        (track.feedUrl && track.feedUrl.includes('/music/') ? 1 : 0); // Prefer /music/ URLs
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTrack = track;
                    }
                });
                
                // Remove all but the best track
                tracks.forEach(track => {
                    if (track !== bestTrack) {
                        const index = musicData.musicTracks.indexOf(track);
                        if (index !== -1) {
                            musicData.musicTracks.splice(index, 1);
                            removedDuplicates++;
                        }
                    }
                });
                
                console.log(`  ✅ Kept best version, removed ${tracks.length - 1} duplicates`);
            }
        });
    }
});

// Also check for exact duplicate tracks (same title, artist, album)
console.log('\n🔍 Checking for other duplicate tracks...');
const seenTracks = new Set();
const filteredTracks = [];
let additionalDuplicates = 0;

musicData.musicTracks.forEach(track => {
    const trackKey = `${track.title}|${track.artist}|${track.album || track.albumTitle}`;
    if (!seenTracks.has(trackKey)) {
        seenTracks.add(trackKey);
        filteredTracks.push(track);
    } else {
        additionalDuplicates++;
    }
});

if (additionalDuplicates > 0) {
    musicData.musicTracks = filteredTracks;
    console.log(`✅ Removed ${additionalDuplicates} additional duplicate tracks`);
}

// Save the updated data
console.log('\n💾 Saving updated music tracks...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Summary
console.log('\n📊 Summary:');
console.log(`- Fixed artist name for ${fixedArtistCount} tracks in "More" album`);
console.log(`- Removed ${removedDuplicates + additionalDuplicates} duplicate tracks total`);
console.log(`- Total tracks in database: ${musicData.musicTracks.length}`);
console.log(`\n✅ Database fixes complete!`);
console.log(`Backup saved at: ${backupPath}`);