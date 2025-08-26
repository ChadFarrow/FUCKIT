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

let removedDuplicates = 0;
let fixedArtists = 0;

// Fix albums with missing artist names where duplicates exist
console.log('\n🎵 Fixing duplicate albums with missing artist names...');

// Group tracks by album name and feed GUID
const albumsByGuid = new Map();

musicData.musicTracks.forEach((track, index) => {
    // Extract GUID from feed URL
    const guidMatch = (track.feedUrl || '').match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (guidMatch) {
        const guid = guidMatch[1];
        const albumName = track.album || track.albumTitle;
        const key = `${guid}|${albumName}`;
        
        if (!albumsByGuid.has(key)) {
            albumsByGuid.set(key, []);
        }
        albumsByGuid.get(key).push({ track, index });
    }
});

// Process each album group
const indicesToRemove = new Set();

albumsByGuid.forEach((entries, key) => {
    if (entries.length > 1) {
        const [guid, albumName] = key.split('|');
        
        // Find the entry with the best metadata
        let bestEntry = null;
        let bestScore = -1;
        let hasArtistName = false;
        
        entries.forEach(entry => {
            const track = entry.track;
            const score = 
                (track.artist && track.artist !== '' ? 10 : 0) + // Heavily prefer tracks with artist
                (track.artistName ? 5 : 0) +
                (track.image ? 1 : 0) + 
                (track.feedImage ? 1 : 0) + 
                (track.publisherFeedGuid ? 1 : 0) +
                (track.publisher ? 1 : 0) +
                (track.artistUrl ? 1 : 0);
            
            if (track.artist && track.artist !== '') {
                hasArtistName = track.artist;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestEntry = entry;
            }
        });
        
        // If we found an artist name, apply it to all entries and then remove duplicates
        if (hasArtistName) {
            console.log(`\nFound duplicates for "${albumName}" (GUID: ${guid})`);
            console.log(`  Artist: ${hasArtistName}`);
            console.log(`  Found ${entries.length} duplicate entries`);
            
            // First, fix any entries with missing artist
            entries.forEach(entry => {
                if (!entry.track.artist || entry.track.artist === '') {
                    entry.track.artist = hasArtistName;
                    entry.track.artistName = hasArtistName;
                    fixedArtists++;
                }
            });
            
            // Then remove all but the best entry
            entries.forEach(entry => {
                if (entry !== bestEntry) {
                    indicesToRemove.add(entry.index);
                    removedDuplicates++;
                }
            });
            
            console.log(`  ✅ Kept best version, marked ${entries.length - 1} for removal`);
        }
    }
});

// Remove duplicates in reverse order to maintain indices
const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
sortedIndices.forEach(index => {
    musicData.musicTracks.splice(index, 1);
});

// Also check for any remaining tracks with empty artist where we can infer from publisher
console.log('\n🔍 Checking for tracks with missing artist that match publisher...');
musicData.musicTracks.forEach(track => {
    if ((!track.artist || track.artist === '') && track.publisher) {
        // For some feeds, publisher is the artist
        const albumName = track.album || track.albumTitle;
        
        // Check if other tracks from same album have the publisher as artist
        const sameAlbumWithArtist = musicData.musicTracks.find(t => 
            (t.album === albumName || t.albumTitle === albumName) &&
            t.artist === track.publisher
        );
        
        if (sameAlbumWithArtist) {
            track.artist = track.publisher;
            track.artistName = track.publisher;
            fixedArtists++;
            console.log(`  Fixed artist for "${track.title}" - set to ${track.publisher}`);
        }
    }
});

// Save the updated data
console.log('\n💾 Saving updated music tracks...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Summary
console.log('\n📊 Summary:');
console.log(`- Fixed ${fixedArtists} tracks with missing artist names`);
console.log(`- Removed ${removedDuplicates} duplicate tracks`);
console.log(`- Total tracks in database: ${musicData.musicTracks.length}`);
console.log(`\n✅ Database fixes complete!`);
console.log(`Backup saved at: ${backupPath}`);