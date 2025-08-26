#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

let stats = {
    artistsPropagated: 0,
    albumsProcessed: 0,
    tracksUpdated: 0
};

// Group tracks by album AND feed URL (to handle compilation albums correctly)
const albumGroups = {};
musicData.musicTracks.forEach(track => {
    const key = `${track.album}|${track.feedUrl}`;
    if (!albumGroups[key]) {
        albumGroups[key] = [];
    }
    albumGroups[key].push(track);
});

console.log(`\nProcessing ${Object.keys(albumGroups).length} album groups...`);

// Process each album group
Object.entries(albumGroups).forEach(([key, tracks]) => {
    const [albumName, feedUrl] = key.split('|');
    
    // Find all unique non-empty artists in this album
    const artists = [...new Set(tracks
        .map(t => t.artist)
        .filter(a => a && a !== ""))];
    
    if (artists.length === 0) {
        // No artist info available, try to extract from album name
        // Common patterns: "Artist - Album", "Album by Artist"
        if (albumName) {
            // Check for "Artist - Album" pattern
            if (albumName.includes(' - ')) {
                const parts = albumName.split(' - ');
                if (parts.length === 2 && !parts[0].includes('feat')) {
                    const potentialArtist = parts[0].trim();
                    tracks.forEach(track => {
                        if (!track.artist || track.artist === "") {
                            track.artist = potentialArtist;
                            stats.tracksUpdated++;
                        }
                    });
                    stats.albumsProcessed++;
                }
            }
            // Check for single-artist album names (like "More")
            else if (albumName === "More" || albumName === "Hypersonic" || 
                     albumName === "Smokestacks" || albumName === "Insomnia") {
                // These appear to be both artist and album names
                tracks.forEach(track => {
                    if (!track.artist || track.artist === "") {
                        track.artist = albumName;
                        stats.tracksUpdated++;
                    }
                });
                stats.albumsProcessed++;
            }
        }
    } else if (artists.length === 1) {
        // Single artist for the album - propagate to all tracks
        const artist = artists[0];
        tracks.forEach(track => {
            if (!track.artist || track.artist === "") {
                track.artist = artist;
                stats.tracksUpdated++;
                stats.artistsPropagated++;
            }
        });
        stats.albumsProcessed++;
    } else {
        // Multiple artists (compilation album)
        // For tracks without artist, check if title contains "feat." or similar
        tracks.forEach(track => {
            if (!track.artist || track.artist === "") {
                // Check if the title contains featured artist info
                const featMatch = track.title.match(/\(feat\.\s+([^)]+)\)/i) ||
                                track.title.match(/feat\.\s+([^,]+)/i) ||
                                track.title.match(/ft\.\s+([^,]+)/i);
                
                if (featMatch) {
                    // Use the primary artist from the album if available
                    const primaryArtist = artists.find(a => !a.includes('feat'));
                    if (primaryArtist) {
                        track.artist = primaryArtist;
                        stats.tracksUpdated++;
                    }
                } else {
                    // Use most common artist as fallback
                    const artistCounts = {};
                    tracks.forEach(t => {
                        if (t.artist && t.artist !== "") {
                            artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
                        }
                    });
                    
                    const mostCommon = Object.entries(artistCounts)
                        .sort((a, b) => b[1] - a[1])[0];
                    
                    if (mostCommon) {
                        track.artist = mostCommon[0];
                        stats.tracksUpdated++;
                    }
                }
            }
        });
    }
});

// Special case: Handle known artist mappings from feed URLs
const knownArtistMappings = {
    'b337bd2b-46c5-4bd0-a57f-f93bca81ebea': 'Jessica Lynne Witty',
    '6dc5c681-8beb-4193-93a3-d405c962d103': 'Various Artists', // Fountain Artist Takeover
    '1557b2d7-04b4-47d8-9c83-cc7aed721cd5': 'From The Nook',
    'b54b9a19-b6ed-46c1-806c-7e82f7550edc': 'More',
};

musicData.musicTracks.forEach(track => {
    if (!track.artist || track.artist === "") {
        const feedGuid = track.feedUrl?.match(/([a-f0-9-]{36})/)?.[1];
        if (feedGuid && knownArtistMappings[feedGuid]) {
            track.artist = knownArtistMappings[feedGuid];
            stats.tracksUpdated++;
        }
    }
});

// Create backup
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`\nCreating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

// Save updated data
console.log('Writing updated database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate report
const totalTracks = musicData.musicTracks.length;
const tracksWithArtist = musicData.musicTracks.filter(t => t.artist && t.artist !== "").length;
const stillMissing = totalTracks - tracksWithArtist;
const uniqueArtists = new Set(musicData.musicTracks.map(t => t.artist).filter(a => a && a !== "")).size;

console.log('\n' + '='.repeat(50));
console.log('ARTIST PROPAGATION COMPLETE');
console.log('='.repeat(50));

console.log('\n📊 FIXES APPLIED:');
console.log(`  • Albums processed: ${stats.albumsProcessed}`);
console.log(`  • Artists propagated: ${stats.artistsPropagated}`);
console.log(`  • Tracks updated: ${stats.tracksUpdated}`);

console.log('\n📈 DATABASE STATUS:');
console.log(`  • Total tracks: ${totalTracks}`);
console.log(`  • Tracks with artist: ${tracksWithArtist} (${(tracksWithArtist/totalTracks*100).toFixed(1)}%)`);
console.log(`  • Tracks missing artist: ${stillMissing}`);
console.log(`  • Unique artists: ${uniqueArtists}`);

if (stillMissing > 0) {
    console.log('\n⚠️  Remaining tracks without artist:');
    const samples = musicData.musicTracks
        .filter(t => !t.artist || t.artist === "")
        .slice(0, 5);
    samples.forEach(t => {
        console.log(`    - "${t.title}" from ${t.album}`);
    });
}

console.log('\n✅ Artist propagation complete!');