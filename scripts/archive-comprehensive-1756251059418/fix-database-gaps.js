#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the data files
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const publisherIndexPath = path.join(__dirname, '..', 'data', 'publisher-feeds-index.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
const publisherIndex = JSON.parse(fs.readFileSync(publisherIndexPath, 'utf8'));

// Create lookup maps for efficient searching
const albumToPublisherMap = new Map();
const feedUrlToPublisherMap = new Map();

publisherIndex.forEach(entry => {
    // Map by album feed URL
    albumToPublisherMap.set(entry.albumFeedUrl, entry);
    
    // Also map by album GUID for Wavlake URLs
    if (entry.albumGuid) {
        albumToPublisherMap.set(`https://wavlake.com/feed/music/${entry.albumGuid}`, entry);
        albumToPublisherMap.set(`https://www.wavlake.com/feed/${entry.albumGuid}`, entry);
    }
});

console.log(`Found ${publisherIndex.length} publisher feed entries`);

let fixedCount = 0;
let missingImageFixed = 0;
let missingPublisherFixed = 0;

// Process each track
musicData.musicTracks = musicData.musicTracks.map(track => {
    let updated = false;
    
    // Try to find publisher info for this track
    const publisherInfo = albumToPublisherMap.get(track.feedUrl) || 
                         albumToPublisherMap.get(track.feedGuid);
    
    if (publisherInfo) {
        // Fix missing publisher feed GUID
        if (!track.publisherFeedGuid && publisherInfo.publisherFeedGuid) {
            track.publisherFeedGuid = publisherInfo.publisherFeedGuid;
            missingPublisherFixed++;
            updated = true;
        }
        
        // Fix missing publisher feed URL
        if (!track.publisherFeedUrl && publisherInfo.publisherFeedUrl) {
            track.publisherFeedUrl = publisherInfo.publisherFeedUrl;
            updated = true;
        }
    }
    
    // Fix missing feedImage by copying from image if available
    if (!track.feedImage && track.image) {
        track.feedImage = track.image;
        missingImageFixed++;
        updated = true;
    }
    
    // Fix missing image by copying from feedImage if available
    if (!track.image && track.feedImage) {
        track.image = track.feedImage;
        missingImageFixed++;
        updated = true;
    }
    
    if (updated) {
        fixedCount++;
    }
    
    return track;
});

// For tracks still missing images, try to extract from feed URL patterns
musicData.musicTracks = musicData.musicTracks.map(track => {
    if (!track.image && !track.feedImage) {
        // Try to construct Wavlake image URLs
        if (track.feedUrl && track.feedUrl.includes('wavlake.com')) {
            const guidMatch = track.feedUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            if (guidMatch) {
                const imageUrl = `https://d12wklypp119aj.cloudfront.net/image/${guidMatch[1]}.jpg`;
                track.image = imageUrl;
                track.feedImage = imageUrl;
                missingImageFixed++;
                fixedCount++;
            }
        }
    }
    return track;
});

// Create a backup of the original file
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`Creating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

// Write the updated data
console.log('Writing updated database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate summary report
const totalTracks = musicData.musicTracks.length;
const tracksWithPublisher = musicData.musicTracks.filter(t => t.publisherFeedGuid).length;
const tracksWithImage = musicData.musicTracks.filter(t => t.image || t.feedImage).length;
const tracksWithBothImages = musicData.musicTracks.filter(t => t.image && t.feedImage).length;

console.log('\n=== Database Fix Summary ===');
console.log(`Total tracks: ${totalTracks}`);
console.log(`Tracks updated: ${fixedCount}`);
console.log(`Missing publisher GUIDs fixed: ${missingPublisherFixed}`);
console.log(`Missing images fixed: ${missingImageFixed}`);
console.log('\n=== Current Status ===');
console.log(`Tracks with publisher feed GUID: ${tracksWithPublisher} (${(tracksWithPublisher/totalTracks*100).toFixed(1)}%)`);
console.log(`Tracks with at least one image: ${tracksWithImage} (${(tracksWithImage/totalTracks*100).toFixed(1)}%)`);
console.log(`Tracks with both images: ${tracksWithBothImages} (${(tracksWithBothImages/totalTracks*100).toFixed(1)}%)`);

// Identify remaining issues
const stillMissingPublisher = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
const stillMissingImages = musicData.musicTracks.filter(t => !t.image && !t.feedImage);

if (stillMissingPublisher.length > 0) {
    console.log(`\nStill missing publisher GUID: ${stillMissingPublisher.length} tracks`);
    console.log('Sample feeds without publisher:');
    stillMissingPublisher.slice(0, 5).forEach(t => {
        console.log(`  - ${t.artist} - ${t.title} (${t.feedUrl})`);
    });
}

if (stillMissingImages.length > 0) {
    console.log(`\nStill missing images: ${stillMissingImages.length} tracks`);
    console.log('Sample tracks without images:');
    stillMissingImages.slice(0, 5).forEach(t => {
        console.log(`  - ${t.artist} - ${t.title} (${t.album})`);
    });
}

console.log('\nDatabase fix complete!');