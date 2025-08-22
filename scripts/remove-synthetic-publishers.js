#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

console.log(`Total tracks: ${musicData.musicTracks.length}`);

// Count synthetic publishers before removal
const syntheticBefore = musicData.musicTracks.filter(t => 
    t.publisherFeedUrl?.startsWith('synthetic://')).length;

console.log(`Tracks with synthetic publishers: ${syntheticBefore}`);

// Remove synthetic publisher data
let cleaned = 0;
musicData.musicTracks = musicData.musicTracks.map(track => {
    // Remove synthetic publisher feeds
    if (track.publisherFeedUrl?.startsWith('synthetic://')) {
        delete track.publisherFeedGuid;
        delete track.publisherFeedUrl;
        cleaned++;
    }
    
    // Also remove the strategy tracking field we added
    if (track.publisherStrategy) {
        delete track.publisherStrategy;
    }
    
    // Clean up any publisher feeds that don't look like real URLs
    if (track.publisherFeedUrl && !track.publisherFeedUrl.startsWith('http')) {
        delete track.publisherFeedGuid;
        delete track.publisherFeedUrl;
        cleaned++;
    }
    
    return track;
});

// Create backup
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`\nCreating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

// Save cleaned data
console.log('Writing cleaned database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate report
const totalTracks = musicData.musicTracks.length;
const tracksWithPublisher = musicData.musicTracks.filter(t => t.publisherFeedGuid).length;
const tracksWithoutPublisher = totalTracks - tracksWithPublisher;

console.log('\n' + '='.repeat(50));
console.log('SYNTHETIC PUBLISHERS REMOVED');
console.log('='.repeat(50));

console.log(`\n📊 CLEANUP RESULTS:`);
console.log(`  • Synthetic publishers removed: ${cleaned}`);
console.log(`  • Total tracks: ${totalTracks}`);
console.log(`  • Tracks with real publisher feeds: ${tracksWithPublisher} (${(tracksWithPublisher/totalTracks*100).toFixed(1)}%)`);
console.log(`  • Tracks without publisher feeds: ${tracksWithoutPublisher} (${(tracksWithoutPublisher/totalTracks*100).toFixed(1)}%)`);

// Show breakdown of tracks without publishers
const withoutPublisher = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
const domains = {};
withoutPublisher.forEach(t => {
    const domain = t.feedUrl?.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
    domains[domain] = (domains[domain] || 0) + 1;
});

if (Object.keys(domains).length > 0) {
    console.log('\n📝 Tracks without publisher feeds by domain:');
    Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([domain, count]) => {
            console.log(`    - ${domain}: ${count} tracks`);
        });
}

console.log('\n✅ Database now reflects only actual RSS feed data!');