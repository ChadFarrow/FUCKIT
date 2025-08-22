#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Read the data files
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const publisherIndexPath = path.join(__dirname, '..', 'data', 'publisher-feeds-index.json');

console.log('Loading music tracks database...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
const publisherIndex = JSON.parse(fs.readFileSync(publisherIndexPath, 'utf8'));

// Create lookup maps
const albumToPublisherMap = new Map();
const artistNameToPublisherMap = new Map();

publisherIndex.forEach(entry => {
    // Map by album feed URL
    albumToPublisherMap.set(entry.albumFeedUrl, entry);
    
    // Also map by album GUID for Wavlake URLs
    if (entry.albumGuid) {
        albumToPublisherMap.set(`https://wavlake.com/feed/music/${entry.albumGuid}`, entry);
        albumToPublisherMap.set(`https://www.wavlake.com/feed/${entry.albumGuid}`, entry);
        albumToPublisherMap.set(entry.albumGuid, entry);
    }
});

console.log(`Found ${publisherIndex.length} publisher feed entries`);

// Statistics tracking
let stats = {
    totalTracks: 0,
    duplicatesRemoved: 0,
    missingPublisherFixed: 0,
    missingImagesFixed: 0,
    malformedDatesFixed: 0,
    malformedDurationFixed: 0,
    missingFieldsAdded: 0
};

// Step 1: Remove duplicates
console.log('\nStep 1: Removing duplicate tracks...');
const seenItemGuids = new Set();
const uniqueTracks = [];

musicData.musicTracks.forEach(track => {
    if (!track.itemGuid || !seenItemGuids.has(track.itemGuid)) {
        if (track.itemGuid) seenItemGuids.add(track.itemGuid);
        uniqueTracks.push(track);
    } else {
        stats.duplicatesRemoved++;
    }
});

musicData.musicTracks = uniqueTracks;
console.log(`Removed ${stats.duplicatesRemoved} duplicate tracks`);

// Step 2: Fix missing and malformed data
console.log('\nStep 2: Fixing missing and malformed data...');

musicData.musicTracks = musicData.musicTracks.map(track => {
    // Fix missing publisher feed GUID
    if (!track.publisherFeedGuid) {
        const publisherInfo = albumToPublisherMap.get(track.feedUrl) || 
                             albumToPublisherMap.get(track.feedGuid) ||
                             albumToPublisherMap.get(track.feedUrl?.replace('https://www.', 'https://'));
        
        if (publisherInfo) {
            track.publisherFeedGuid = publisherInfo.publisherFeedGuid;
            track.publisherFeedUrl = publisherInfo.publisherFeedUrl;
            stats.missingPublisherFixed++;
        }
    }
    
    // Fix missing images
    if (!track.image || !track.feedImage) {
        if (track.image && !track.feedImage) {
            track.feedImage = track.image;
            stats.missingImagesFixed++;
        } else if (track.feedImage && !track.image) {
            track.image = track.feedImage;
            stats.missingImagesFixed++;
        } else if (!track.image && !track.feedImage && track.feedUrl?.includes('wavlake.com')) {
            // Try to construct Wavlake image URLs
            const guidMatch = track.feedUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            if (guidMatch) {
                const imageUrl = `https://d12wklypp119aj.cloudfront.net/image/${guidMatch[1]}.jpg`;
                track.image = imageUrl;
                track.feedImage = imageUrl;
                stats.missingImagesFixed++;
            }
        }
    }
    
    // Fix malformed dates
    if (track.pubDate && typeof track.pubDate === 'number') {
        // Unix timestamp, convert to RFC 2822
        track.pubDate = new Date(track.pubDate * 1000).toUTCString();
        stats.malformedDatesFixed++;
    }
    
    // Fix duration format (ensure it's a string in HH:MM:SS or seconds)
    if (track.duration && typeof track.duration === 'number') {
        // Convert seconds to HH:MM:SS format
        const hours = Math.floor(track.duration / 3600);
        const minutes = Math.floor((track.duration % 3600) / 60);
        const seconds = track.duration % 60;
        
        if (hours > 0) {
            track.duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            track.duration = `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        stats.malformedDurationFixed++;
    }
    
    // Ensure all required fields exist
    if (!track.id) {
        track.id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        stats.missingFieldsAdded++;
    }
    
    if (!track.addedAt) {
        track.addedAt = new Date().toISOString();
        stats.missingFieldsAdded++;
    }
    
    return track;
});

// Step 3: Try to resolve more publisher feeds from artist names
console.log('\nStep 3: Attempting to resolve more publisher feeds...');

// Build artist name map from existing successful matches
musicData.musicTracks.forEach(track => {
    if (track.publisherFeedGuid && track.artist) {
        const normalizedArtist = track.artist.toLowerCase().trim();
        if (!artistNameToPublisherMap.has(normalizedArtist)) {
            artistNameToPublisherMap.set(normalizedArtist, {
                publisherFeedGuid: track.publisherFeedGuid,
                publisherFeedUrl: track.publisherFeedUrl
            });
        }
    }
});

// Apply artist name matching to tracks still missing publisher info
let additionalPublisherFixed = 0;
musicData.musicTracks = musicData.musicTracks.map(track => {
    if (!track.publisherFeedGuid && track.artist) {
        const normalizedArtist = track.artist.toLowerCase().trim();
        const publisherInfo = artistNameToPublisherMap.get(normalizedArtist);
        
        if (publisherInfo) {
            track.publisherFeedGuid = publisherInfo.publisherFeedGuid;
            track.publisherFeedUrl = publisherInfo.publisherFeedUrl;
            additionalPublisherFixed++;
        }
    }
    return track;
});

stats.missingPublisherFixed += additionalPublisherFixed;
console.log(`Fixed ${additionalPublisherFixed} additional publisher feeds via artist matching`);

// Step 4: Sort tracks by most recent first
console.log('\nStep 4: Sorting tracks by date...');
musicData.musicTracks.sort((a, b) => {
    const dateA = new Date(a.pubDate || a.addedAt || 0);
    const dateB = new Date(b.pubDate || b.addedAt || 0);
    return dateB - dateA;
});

// Step 5: Reassign sequential IDs
console.log('\nStep 5: Reassigning sequential track IDs...');
musicData.musicTracks = musicData.musicTracks.map((track, index) => {
    track.id = `track-${index + 1}`;
    return track;
});

// Create a backup of the original file
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`\nCreating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

// Write the updated data
console.log('Writing updated database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate comprehensive report
stats.totalTracks = musicData.musicTracks.length;
const tracksWithPublisher = musicData.musicTracks.filter(t => t.publisherFeedGuid).length;
const tracksWithImage = musicData.musicTracks.filter(t => t.image || t.feedImage).length;
const tracksWithBothImages = musicData.musicTracks.filter(t => t.image && t.feedImage).length;
const uniqueArtists = new Set(musicData.musicTracks.map(t => t.artist)).size;
const uniqueAlbums = new Set(musicData.musicTracks.map(t => t.album)).size;

console.log('\n' + '='.repeat(50));
console.log('DATABASE FIX COMPLETE - SUMMARY REPORT');
console.log('='.repeat(50));

console.log('\n📊 CHANGES MADE:');
console.log(`  • Duplicates removed: ${stats.duplicatesRemoved}`);
console.log(`  • Missing publisher GUIDs fixed: ${stats.missingPublisherFixed}`);
console.log(`  • Missing images fixed: ${stats.missingImagesFixed}`);
console.log(`  • Malformed dates fixed: ${stats.malformedDatesFixed}`);
console.log(`  • Malformed durations fixed: ${stats.malformedDurationFixed}`);
console.log(`  • Missing fields added: ${stats.missingFieldsAdded}`);

console.log('\n📈 DATABASE STATUS:');
console.log(`  • Total tracks: ${stats.totalTracks}`);
console.log(`  • Unique artists: ${uniqueArtists}`);
console.log(`  • Unique albums: ${uniqueAlbums}`);
console.log(`  • Tracks with publisher feed: ${tracksWithPublisher} (${(tracksWithPublisher/stats.totalTracks*100).toFixed(1)}%)`);
console.log(`  • Tracks with images: ${tracksWithImage} (${(tracksWithImage/stats.totalTracks*100).toFixed(1)}%)`);

// Identify remaining issues
const stillMissingPublisher = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
const stillMissingImages = musicData.musicTracks.filter(t => !t.image && !t.feedImage);

if (stillMissingPublisher.length > 0) {
    console.log(`\n⚠️  REMAINING ISSUES:`);
    console.log(`  • ${stillMissingPublisher.length} tracks still missing publisher feed GUID`);
    
    // Group by feed domain
    const feedDomains = {};
    stillMissingPublisher.forEach(t => {
        const domain = t.feedUrl?.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
        feedDomains[domain] = (feedDomains[domain] || 0) + 1;
    });
    
    console.log('\n  Breakdown by domain:');
    Object.entries(feedDomains)
        .sort((a, b) => b[1] - a[1])
        .forEach(([domain, count]) => {
            console.log(`    - ${domain}: ${count} tracks`);
        });
}

if (stillMissingImages.length > 0) {
    console.log(`\n  • ${stillMissingImages.length} tracks still missing images`);
}

console.log('\n✅ Database optimization complete!');
console.log(`   Backup saved as: ${path.basename(backupPath)}`);