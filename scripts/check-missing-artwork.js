#!/usr/bin/env node

/**
 * Check for missing artwork issues like King Paluta and others
 */

const fs = require('fs');

function checkMissingArtwork() {
    console.log('🎨 Checking Missing Artwork Issues\n');
    
    const musicData = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));
    const tracks = musicData.musicTracks;
    
    // Find King Paluta tracks
    const kingPalutaTracks = tracks.filter(track => 
        (track.feedArtist && track.feedArtist.includes('King Paluta')) ||
        (track.feedTitle && track.feedTitle.includes('King Paluta')) ||
        (track.title && track.title.includes('King Paluta'))
    );
    
    console.log('🔍 King Paluta Analysis:');
    console.log(`Found tracks: ${kingPalutaTracks.length}`);
    
    if (kingPalutaTracks.length > 0) {
        const sample = kingPalutaTracks[0];
        console.log(`Album: ${sample.feedTitle}`);
        console.log(`Artist: ${sample.feedArtist}`);
        console.log(`Feed URL: ${sample.feedUrl}`);
        console.log(`Feed Image: ${sample.feedImage || 'MISSING'}`);
        console.log(`Track Image: ${sample.image || 'MISSING'}`);
        
        // Check all King Paluta tracks for image issues
        const withImages = kingPalutaTracks.filter(t => t.feedImage || t.image);
        const withoutImages = kingPalutaTracks.filter(t => !t.feedImage && !t.image);
        
        console.log(`With images: ${withImages.length}`);
        console.log(`Without images: ${withoutImages.length}`);
        
        if (withImages.length > 0) {
            console.log(`Sample image URL: ${withImages[0].feedImage || withImages[0].image}`);
        }
    }
    
    // Find all albums/tracks with missing artwork
    console.log('\n🖼️ Albums with Missing Artwork:');
    
    // Group by album to find missing artwork
    const albumGroups = new Map();
    tracks.forEach(track => {
        const key = track.feedGuid || `${track.feedTitle}-${track.feedArtist}`;
        if (!albumGroups.has(key)) {
            albumGroups.set(key, {
                title: track.feedTitle,
                artist: track.feedArtist,
                feedUrl: track.feedUrl,
                feedImage: track.feedImage,
                trackCount: 0
            });
        }
        albumGroups.get(key).trackCount++;
    });
    
    // Find albums without artwork
    const albumsWithoutArt = Array.from(albumGroups.values())
        .filter(album => !album.feedImage)
        .sort((a, b) => b.trackCount - a.trackCount); // Sort by track count
    
    console.log(`Found ${albumsWithoutArt.length} albums without artwork:`);
    albumsWithoutArt.slice(0, 10).forEach((album, i) => {
        console.log(`  ${i + 1}. "${album.title}" by ${album.artist} (${album.trackCount} tracks)`);
        if (album.feedUrl) {
            console.log(`     Feed: ${album.feedUrl}`);
        }
    });
    
    if (albumsWithoutArt.length > 10) {
        console.log(`     ... and ${albumsWithoutArt.length - 10} more`);
    }
    
    // Check for common artwork problems
    console.log('\n🔍 Common Artwork Problems:');
    
    const brokenImages = tracks.filter(t => 
        t.feedImage && (
            t.feedImage.includes('homegrownhits.xyz') ||
            t.feedImage.includes('placeholder') ||
            t.feedImage === '' ||
            t.feedImage.includes('404')
        )
    );
    
    console.log(`Tracks with broken/placeholder images: ${brokenImages.length}`);
    
    // Show some examples of albums that need artwork
    const needsArtwork = albumsWithoutArt.slice(0, 5);
    if (needsArtwork.length > 0) {
        console.log('\n🎯 Priority Albums Needing Artwork:');
        needsArtwork.forEach((album, i) => {
            console.log(`${i + 1}. "${album.title}" by ${album.artist}`);
            if (album.feedUrl) {
                console.log(`   Feed URL: ${album.feedUrl}`);
            }
        });
        
        // Try to fetch artwork from RSS feeds for these albums
        console.log('\n🔄 Attempting to fetch artwork from RSS feeds...');
        return needsArtwork;
    }
    
    return [];
}

async function fetchArtworkFromFeeds(albums) {
    const updates = [];
    
    for (const album of albums.slice(0, 3)) { // Process first 3
        if (!album.feedUrl) continue;
        
        try {
            console.log(`📡 Fetching: ${album.feedUrl}`);
            const response = await fetch(album.feedUrl, { timeout: 10000 });
            
            if (!response.ok) {
                console.log(`  ❌ Failed: HTTP ${response.status}`);
                continue;
            }
            
            const xmlText = await response.text();
            
            // Look for iTunes image in channel
            const channelImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
            const imageMatch = xmlText.match(/<image>[\s\S]*?<url>(.*?)<\/url>/);
            
            let artworkUrl = null;
            if (channelImageMatch) {
                artworkUrl = channelImageMatch[1];
            } else if (imageMatch) {
                artworkUrl = imageMatch[1];
            }
            
            if (artworkUrl) {
                console.log(`  ✅ Found artwork: ${artworkUrl}`);
                updates.push({
                    feedUrl: album.feedUrl,
                    title: album.title,
                    artworkUrl
                });
            } else {
                console.log(`  ⚠️ No artwork found in feed`);
            }
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }
    
    return updates;
}

async function main() {
    const albumsNeedingArt = checkMissingArtwork();
    
    if (albumsNeedingArt.length > 0) {
        const artworkUpdates = await fetchArtworkFromFeeds(albumsNeedingArt);
        
        if (artworkUpdates.length > 0) {
            console.log('\n📝 Artwork Updates Found:');
            artworkUpdates.forEach(update => {
                console.log(`"${update.title}": "${update.artworkUrl}"`);
            });
            
            // Save artwork updates for manual application
            const updatePath = `data/artwork-updates-${Date.now()}.json`;
            fs.writeFileSync(updatePath, JSON.stringify(artworkUpdates, null, 2));
            console.log(`\n💾 Artwork updates saved: ${updatePath}`);
        }
    }
    
    console.log('\n✅ Artwork check complete!');
}

main();