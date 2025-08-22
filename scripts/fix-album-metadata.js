#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

let stats = {
    nullAlbums: 0,
    missingArtists: 0,
    fixedAlbums: 0,
    fixedArtists: 0,
    duplicatesRemoved: 0
};

// First pass: Fix null albums and empty artists
musicData.musicTracks = musicData.musicTracks.map(track => {
    let updated = false;
    
    // Fix null album - use feedTitle as album if album is null
    if (!track.album && track.feedTitle) {
        track.album = track.feedTitle;
        stats.fixedAlbums++;
        updated = true;
    }
    
    // Fix empty artist - try to extract from feed data
    if (!track.artist || track.artist === "") {
        // Try feedArtist first
        if (track.feedArtist) {
            track.artist = track.feedArtist;
            stats.fixedArtists++;
        } 
        // For "More" album and similar, look for actual artist info
        else if (track.feedTitle === "More") {
            // This appears to be an artist named "More"
            track.artist = "More";
            stats.fixedArtists++;
        }
        // Use album name as potential artist for single-artist albums
        else if (track.album && !track.album.includes('Various')) {
            // Check if other tracks from same feed have artist info
            const sameFeedTrack = musicData.musicTracks.find(t => 
                t.feedUrl === track.feedUrl && t.artist && t.artist !== ""
            );
            if (sameFeedTrack) {
                track.artist = sameFeedTrack.artist;
                stats.fixedArtists++;
            }
        }
        stats.missingArtists++;
    }
    
    return track;
});

// Second pass: Remove exact duplicates (same title, artist, album)
const seen = new Set();
const uniqueTracks = [];

musicData.musicTracks.forEach(track => {
    const key = `${track.title}|${track.artist}|${track.album}|${track.itemGuid}`;
    if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(track);
    } else {
        stats.duplicatesRemoved++;
    }
});

musicData.musicTracks = uniqueTracks;

// Third pass: Group by feed and fix consistency within albums
const feedGroups = {};
musicData.musicTracks.forEach(track => {
    if (!feedGroups[track.feedUrl]) {
        feedGroups[track.feedUrl] = [];
    }
    feedGroups[track.feedUrl].push(track);
});

// Fix consistency within each feed/album
Object.values(feedGroups).forEach(tracks => {
    // Find most common non-empty artist in this feed
    const artistCounts = {};
    tracks.forEach(track => {
        if (track.artist && track.artist !== "") {
            artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
        }
    });
    
    const mostCommonArtist = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])[0];
    
    // Apply consistent metadata
    if (mostCommonArtist) {
        tracks.forEach(track => {
            if (!track.artist || track.artist === "") {
                track.artist = mostCommonArtist[0];
                stats.fixedArtists++;
            }
        });
    }
    
    // Ensure album consistency
    const albumName = tracks[0].album || tracks[0].feedTitle;
    tracks.forEach(track => {
        if (!track.album) {
            track.album = albumName;
            stats.fixedAlbums++;
        }
    });
});

// Create backup
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`\nCreating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

// Save fixed data
console.log('Writing fixed database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate report
const totalTracks = musicData.musicTracks.length;
const tracksWithAlbum = musicData.musicTracks.filter(t => t.album).length;
const tracksWithArtist = musicData.musicTracks.filter(t => t.artist && t.artist !== "").length;
const uniqueAlbums = new Set(musicData.musicTracks.map(t => t.album)).size;
const uniqueArtists = new Set(musicData.musicTracks.map(t => t.artist).filter(a => a && a !== "")).size;

console.log('\n' + '='.repeat(50));
console.log('ALBUM METADATA FIXES COMPLETE');
console.log('='.repeat(50));

console.log('\n📊 FIXES APPLIED:');
console.log(`  • Albums fixed: ${stats.fixedAlbums}`);
console.log(`  • Artists fixed: ${stats.fixedArtists}`);
console.log(`  • Duplicates removed: ${stats.duplicatesRemoved}`);

console.log('\n📈 DATABASE STATUS:');
console.log(`  • Total tracks: ${totalTracks}`);
console.log(`  • Tracks with album: ${tracksWithAlbum} (${(tracksWithAlbum/totalTracks*100).toFixed(1)}%)`);
console.log(`  • Tracks with artist: ${tracksWithArtist} (${(tracksWithArtist/totalTracks*100).toFixed(1)}%)`);
console.log(`  • Unique albums: ${uniqueAlbums}`);
console.log(`  • Unique artists: ${uniqueArtists}`);

// Show any remaining issues
const stillMissingArtist = musicData.musicTracks.filter(t => !t.artist || t.artist === "");
const stillMissingAlbum = musicData.musicTracks.filter(t => !t.album);

if (stillMissingArtist.length > 0) {
    console.log(`\n⚠️  Still missing artist: ${stillMissingArtist.length} tracks`);
    console.log('  Sample:');
    stillMissingArtist.slice(0, 3).forEach(t => {
        console.log(`    - "${t.title}" from ${t.album || t.feedTitle}`);
    });
}

if (stillMissingAlbum.length > 0) {
    console.log(`\n⚠️  Still missing album: ${stillMissingAlbum.length} tracks`);
}

console.log('\n✅ Album metadata fixed!');