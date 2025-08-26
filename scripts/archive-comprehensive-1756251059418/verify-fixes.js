#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const musicData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'music-tracks.json'), 'utf8'));

console.log('📊 Database Verification Summary\n');
console.log(`Total tracks: ${musicData.musicTracks.length}`);

// Check specific albums
const albums = ['More', 'Bourbon at Dawn', 'Cash Back', 'Think Of Me In Color'];
albums.forEach(albumName => {
    const tracks = musicData.musicTracks.filter(t => t.album === albumName || t.albumTitle === albumName);
    if (tracks.length > 0) {
        console.log(`\n✅ ${albumName}: ${tracks.length} track(s)`);
        console.log(`   Artist: ${tracks[0].artist || 'MISSING'}`);
    }
});

// Check for missing artists
const missingArtist = musicData.musicTracks.filter(t => !t.artist || t.artist === '');
console.log(`\n⚠️  Tracks with missing artist: ${missingArtist.length}`);
if (missingArtist.length > 0 && missingArtist.length < 10) {
    missingArtist.forEach(t => console.log(`   - ${t.title} (${t.album})`));
}
