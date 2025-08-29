#!/usr/bin/env node

const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));
const tracks = data.musicTracks;

console.log('📊 Database Integrity Check\n');
console.log('=' .repeat(50));
console.log('Total tracks:', tracks.length);

// Check for key statistics
const withUrls = tracks.filter(t => t.enclosureUrl).length;
const withArtists = tracks.filter(t => t.feedArtist && t.feedArtist !== 'Unknown Artist').length;
const withTitles = tracks.filter(t => t.feedTitle && t.feedTitle !== 'Unknown Album').length;
const withGuids = tracks.filter(t => t.guid).length;

console.log('\n📈 Coverage:');
console.log('  Audio URLs:', withUrls, '(' + (withUrls/tracks.length*100).toFixed(1) + '%)');
console.log('  Artists:', withArtists, '(' + (withArtists/tracks.length*100).toFixed(1) + '%)');
console.log('  Albums:', withTitles, '(' + (withTitles/tracks.length*100).toFixed(1) + '%)');
console.log('  GUIDs:', withGuids, '(' + (withGuids/tracks.length*100).toFixed(1) + '%)');

// Check for duplicates
const feedGroups = new Map();
tracks.forEach(track => {
    const key = track.feedUrl || 'unknown';
    if (!feedGroups.has(key)) feedGroups.set(key, []);
    feedGroups.get(key).push(track);
});

let albumsWithDuplicates = 0;
feedGroups.forEach(albumTracks => {
    const titleCounts = {};
    albumTracks.forEach(t => titleCounts[t.title] = (titleCounts[t.title] || 0) + 1);
    if (Object.values(titleCounts).some(c => c > 1)) albumsWithDuplicates++;
});

console.log('\n🔍 Quality Check:');
console.log('  Total albums/feeds:', feedGroups.size);
console.log('  Albums with duplicates:', albumsWithDuplicates);

// Show recently updated feeds
console.log('\n📅 Recent Updates:');
const recentSources = {};
tracks.forEach(track => {
    if (track.source) {
        recentSources[track.source] = (recentSources[track.source] || 0) + 1;
    }
});

Object.entries(recentSources).forEach(([source, count]) => {
    console.log(`  ${source}: ${count} tracks`);
});

// Recent changes
if (data.metadata && data.metadata.targetedRefresh) {
    const refresh = data.metadata.targetedRefresh;
    console.log('\n🎯 Last Targeted Refresh:');
    console.log('  Date:', new Date(refresh.date).toLocaleString());
    console.log('  Feeds processed:', refresh.feedsProcessed);
    console.log('  Feeds updated:', refresh.feedsUpdated);
    console.log('  Feeds failed:', refresh.feedsFailed);
}

console.log('\n✅ Database integrity check complete!');