#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Create backup
const backupPath = musicTracksPath + '.backup-' + Date.now();
fs.copyFileSync(musicTracksPath, backupPath);

console.log('Fixing placeholder dates...\n');

// Get actual current date
const currentDate = new Date();
const currentISO = currentDate.toISOString();

let fixedCount = 0;

// Fix all tracks with future dates
musicData.musicTracks.forEach(track => {
    let updated = false;
    
    // Check addedDate
    if (track.addedDate) {
        const date = new Date(track.addedDate);
        if (date > currentDate) {
            track.addedDate = currentISO;
            updated = true;
        }
    }
    
    // Check datePublished
    if (track.datePublished) {
        const date = new Date(track.datePublished);
        if (date > currentDate) {
            track.datePublished = currentISO;
            updated = true;
        }
    }
    
    // Check pubDate
    if (track.pubDate) {
        const date = new Date(track.pubDate);
        if (date > currentDate) {
            track.pubDate = currentISO;
            updated = true;
        }
    }
    
    if (updated) fixedCount++;
});

// Save
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

console.log('Summary:');
console.log(`- Fixed ${fixedCount} tracks with future dates`);
console.log(`- Changed dates from 2025-08-23 to ${currentISO.split('T')[0]}`);
console.log(`- Backup: ${backupPath}`);
