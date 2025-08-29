#!/usr/bin/env node

/**
 * Fix missing artwork for specific albums showing placeholders on main page
 */

const fs = require('fs');
const path = require('path');

async function fixMissingArtwork() {
    console.log('🎨 Fixing Missing Artwork Issues\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    let updatedCount = 0;
    const artworkUpdates = [];
    
    // Known feeds with missing artwork that we can fetch
    const feedsToCheck = [
        {
            feedUrl: 'https://static.staticsave.com/mspfiles/deathdreams.xml',
            albumName: 'deathdreams'
        },
        {
            feedUrl: 'https://wavlake.com/feed/music/bb39fb3b-b79b-45fc-8cd1-4a4d917a61c2',
            albumName: 'Tinderbox'  
        },
        {
            feedUrl: 'https://jimmiebratcher.s3.us-west-1.amazonaws.com/Far Enough Album/far-enough.xml',
            albumName: 'Far Enough'
        }
    ];
    
    console.log(`🔍 Checking ${feedsToCheck.length} feeds for artwork...\n`);
    
    for (const feedInfo of feedsToCheck) {
        try {
            console.log(`📡 Fetching: ${feedInfo.feedUrl}`);
            
            const response = await fetch(feedInfo.feedUrl, { 
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)'
                }
            });
            
            if (!response.ok) {
                console.log(`  ❌ HTTP ${response.status}`);
                continue;
            }
            
            const xmlText = await response.text();
            
            // Look for artwork in multiple places
            let artworkUrl = null;
            
            // Try iTunes channel image
            const channelImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
            if (channelImageMatch) {
                artworkUrl = channelImageMatch[1];
            }
            
            // Try regular image tag
            if (!artworkUrl) {
                const imageMatch = xmlText.match(/<image>[\s\S]*?<url>(.*?)<\/url>/);
                if (imageMatch) {
                    artworkUrl = imageMatch[1];
                }
            }
            
            // Try first item image
            if (!artworkUrl) {
                const itemImageMatch = xmlText.match(/<item>[\s\S]*?<itunes:image href="(.*?)"[\s\S]*?<\/item>/);
                if (itemImageMatch) {
                    artworkUrl = itemImageMatch[1];
                }
            }
            
            if (artworkUrl) {
                console.log(`  ✅ Found artwork: ${artworkUrl}`);
                
                // Update tracks with this feed URL
                const tracksToUpdate = musicData.musicTracks.filter(track => 
                    track.feedUrl === feedInfo.feedUrl
                );
                
                tracksToUpdate.forEach(track => {
                    if (!track.feedImage) {
                        track.feedImage = artworkUrl;
                        updatedCount++;
                    }
                    if (!track.image) {
                        track.image = artworkUrl;
                    }
                });
                
                artworkUpdates.push({
                    feedUrl: feedInfo.feedUrl,
                    albumName: feedInfo.albumName,
                    artworkUrl: artworkUrl,
                    tracksUpdated: tracksToUpdate.length
                });
                
                console.log(`  📝 Updated ${tracksToUpdate.length} tracks`);
            } else {
                console.log(`  ⚠️ No artwork found`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }
    
    // Also add some manual artwork fixes for known albums
    const manualArtworkFixes = [
        // Add specific artwork URLs for albums you know are missing
        {
            feedTitle: 'The Ultimate Album',
            artworkUrl: 'https://music.behindthesch3m3s.com/wp-content/uploads/Dave\'s Not Here/The Ultimate Album/cover.jpg'
        }
        // Add more as needed
    ];
    
    console.log('\n🖼️ Applying manual artwork fixes...');
    
    manualArtworkFixes.forEach(fix => {
        const tracksToUpdate = musicData.musicTracks.filter(track => 
            track.feedTitle === fix.feedTitle && !track.feedImage
        );
        
        if (tracksToUpdate.length > 0) {
            tracksToUpdate.forEach(track => {
                track.feedImage = fix.artworkUrl;
                if (!track.image) {
                    track.image = fix.artworkUrl;
                }
            });
            
            updatedCount += tracksToUpdate.length;
            console.log(`  📝 "${fix.feedTitle}": Updated ${tracksToUpdate.length} tracks with ${fix.artworkUrl}`);
            
            artworkUpdates.push({
                albumName: fix.feedTitle,
                artworkUrl: fix.artworkUrl,
                tracksUpdated: tracksToUpdate.length,
                source: 'manual'
            });
        }
    });
    
    if (updatedCount > 0) {
        console.log(`\n💾 Saving ${updatedCount} artwork updates...`);
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            artworkFixes: {
                date: new Date().toISOString(),
                tracksUpdated: updatedCount,
                feedsProcessed: artworkUpdates.length,
                note: 'Fixed missing artwork for albums showing placeholders'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-artwork-fixes-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated with ${updatedCount} artwork fixes`);
        
        // Log the updates
        console.log('\n📋 Artwork Updates Applied:');
        artworkUpdates.forEach(update => {
            console.log(`  "${update.albumName}": ${update.tracksUpdated} tracks → ${update.artworkUrl}`);
        });
        
        // Regenerate the optimized cache
        console.log('\n🔄 Regenerating optimized cache with artwork fixes...');
        const { execSync } = require('child_process');
        try {
            execSync('node scripts/create-optimized-cache.js', { stdio: 'inherit' });
            console.log('✅ Optimized cache regenerated');
        } catch (error) {
            console.log('⚠️ Failed to regenerate cache automatically - please run: node scripts/create-optimized-cache.js');
        }
        
    } else {
        console.log('\n💫 No artwork updates needed');
    }
    
    console.log('\n✅ Artwork fixing complete!');
}

fixMissingArtwork();