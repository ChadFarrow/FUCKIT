#!/usr/bin/env node

const data = require('../data/music-tracks.json');

console.log('📊 Final Database Stats:');
console.log('Total tracks:', data.musicTracks.length);

const itdv = data.musicTracks.filter(t => t.source && t.source.includes('ITDV'));
console.log('ITDV tracks:', itdv.length);

console.log('\nSample ITDV albums:');
const albums = new Map();
itdv.forEach(t => {
    const key = t.feedTitle + ' by ' + t.feedArtist;
    if (!albums.has(key)) albums.set(key, 0);
    albums.set(key, albums.get(key) + 1);
});

let count = 0;
for (const [album, trackCount] of albums) {
    if (count++ < 15) console.log('  •', album, '(' + trackCount, 'tracks)');
}

console.log('\nDatabase growth:');
console.log('Started with: 1611 tracks');
console.log('Added ITDV: +' + itdv.length + ' tracks');
console.log('Final total:', data.musicTracks.length, 'tracks');
console.log('Growth:', Math.round((itdv.length / 1611) * 100) + '% increase');