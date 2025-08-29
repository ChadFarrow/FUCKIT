#!/usr/bin/env node

/**
 * Comprehensive fix for all albums showing placeholder artwork on main page
 */

const fs = require('fs');
const path = require('path');

async function fixPlaceholderArtwork() {
    console.log('🎨 Comprehensive Placeholder Artwork Fix\n');
    console.log('=' .repeat(50));
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Search for specific problematic albums mentioned
    const problemAlbums = [
        { searchTerms: ['sink or swim', 'sara jade'], name: 'Sara Jade - Sink or Swim EP' },
        { searchTerms: ['hurling pixels', 'all my life'], name: 'Hurling Pixels - All My Life' },
        { searchTerms: ['king paluta'], name: 'King Paluta' }
    ];
    
    const foundAlbums = [];
    let totalUpdated = 0;
    
    // Find each problematic album
    for (const album of problemAlbums) {
        console.log(`\n🔍 Searching for: ${album.name}`);
        
        const matchingTracks = musicData.musicTracks.filter(track => {
            const searchText = `${track.title || ''} ${track.feedTitle || ''} ${track.feedArtist || ''}`.toLowerCase();
            return album.searchTerms.some(term => searchText.includes(term.toLowerCase()));
        });
        
        if (matchingTracks.length > 0) {
            // Group by feed to understand album structure
            const feedGroups = new Map();
            matchingTracks.forEach(track => {
                const key = track.feedGuid || `${track.feedTitle}-${track.feedArtist}`;
                if (!feedGroups.has(key)) {
                    feedGroups.set(key, {
                        feedTitle: track.feedTitle,
                        feedArtist: track.feedArtist,
                        feedUrl: track.feedUrl,
                        tracks: []
                    });
                }
                feedGroups.get(key).tracks.push(track);
            });
            
            console.log(`  📊 Found ${matchingTracks.length} tracks in ${feedGroups.size} album(s)`);
            
            // Analyze each album for artwork issues
            for (const [key, albumGroup] of feedGroups) {
                console.log(`\n  📀 Album: "${albumGroup.feedTitle}" by ${albumGroup.feedArtist}`);
                console.log(`     Feed: ${albumGroup.feedUrl}`);
                
                const withArtwork = albumGroup.tracks.filter(t => t.feedImage || t.image);
                const withoutArtwork = albumGroup.tracks.filter(t => !t.feedImage && !t.image);
                
                console.log(`     Tracks with artwork: ${withArtwork.length}`);
                console.log(`     Tracks without artwork: ${withoutArtwork.length}`);
                
                if (withArtwork.length > 0) {
                    // Use existing artwork from tracks that have it
                    const artworkUrl = withArtwork[0].feedImage || withArtwork[0].image;
                    console.log(`     Using existing artwork: ${artworkUrl}`);
                    
                    withoutArtwork.forEach(track => {
                        if (!track.feedImage) track.feedImage = artworkUrl;
                        if (!track.image) track.image = artworkUrl;
                        totalUpdated++;
                    });
                    
                } else if (albumGroup.feedUrl) {
                    // Try to fetch artwork from RSS feed
                    console.log(`     🔄 Fetching artwork from RSS feed...`);
                    
                    try {
                        const response = await fetch(albumGroup.feedUrl, { 
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)'
                            }
                        });
                        
                        if (response.ok) {
                            const xmlText = await response.text();
                            
                            // Look for artwork in multiple places
                            let artworkUrl = null;
                            
                            const channelImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
                            if (channelImageMatch) {
                                artworkUrl = channelImageMatch[1];
                            }
                            
                            if (!artworkUrl) {
                                const imageMatch = xmlText.match(/<image>[\s\S]*?<url>(.*?)<\/url>/);
                                if (imageMatch) {
                                    artworkUrl = imageMatch[1];
                                }
                            }
                            
                            if (!artworkUrl) {
                                const itemImageMatch = xmlText.match(/<item>[\s\S]*?<itunes:image href="(.*?)"[\s\S]*?<\/item>/);
                                if (itemImageMatch) {
                                    artworkUrl = itemImageMatch[1];
                                }
                            }
                            
                            if (artworkUrl) {
                                console.log(`     ✅ Found artwork in RSS: ${artworkUrl}`);
                                
                                albumGroup.tracks.forEach(track => {
                                    if (!track.feedImage) track.feedImage = artworkUrl;
                                    if (!track.image) track.image = artworkUrl;
                                    totalUpdated++;
                                });
                            } else {
                                console.log(`     ⚠️ No artwork found in RSS feed`);
                            }
                        } else {
                            console.log(`     ❌ RSS feed not accessible (HTTP ${response.status})`);
                        }
                        
                    } catch (error) {
                        console.log(`     ❌ Error fetching RSS: ${error.message}`);
                    }
                    
                    // Small delay
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                foundAlbums.push({
                    name: album.name,
                    feedTitle: albumGroup.feedTitle,
                    feedArtist: albumGroup.feedArtist,
                    trackCount: albumGroup.tracks.length
                });
            }
        } else {
            console.log(`  ❌ No tracks found for "${album.name}"`);
        }
    }
    
    // Also do a general scan for tracks without any artwork
    console.log(`\n🔍 Scanning for additional tracks without artwork...`);
    
    const tracksWithoutArtwork = musicData.musicTracks.filter(track => 
        !track.feedImage && !track.image &&
        track.feedUrl && // Must have a feed URL to try fetching artwork
        !track.feedTitle?.includes('Music Reference from Homegrown Hits') // Skip HGH references
    );
    
    console.log(`Found ${tracksWithoutArtwork.length} additional tracks without artwork`);
    
    // Group by feed and try to fetch artwork for a few more
    const additionalFeedGroups = new Map();
    tracksWithoutArtwork.slice(0, 10).forEach(track => { // Limit to first 10 feeds
        const key = track.feedGuid || track.feedUrl;
        if (!additionalFeedGroups.has(key)) {
            additionalFeedGroups.set(key, {
                feedUrl: track.feedUrl,
                feedTitle: track.feedTitle,
                feedArtist: track.feedArtist,
                tracks: []
            });
        }
        additionalFeedGroups.get(key).tracks.push(track);
    });
    
    console.log(`\n🔄 Checking ${additionalFeedGroups.size} additional feeds for artwork...`);
    
    for (const [key, albumGroup] of Array.from(additionalFeedGroups.entries()).slice(0, 5)) {
        try {
            console.log(`\n📡 Fetching: ${albumGroup.feedUrl}`);
            console.log(`    Album: "${albumGroup.feedTitle}" by ${albumGroup.feedArtist}`);
            
            const response = await fetch(albumGroup.feedUrl, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)'
                }
            });
            
            if (response.ok) {
                const xmlText = await response.text();
                
                let artworkUrl = null;
                const channelImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
                if (channelImageMatch) {
                    artworkUrl = channelImageMatch[1];
                }
                
                if (artworkUrl) {
                    console.log(`    ✅ Found artwork: ${artworkUrl}`);
                    
                    albumGroup.tracks.forEach(track => {
                        track.feedImage = artworkUrl;
                        if (!track.image) track.image = artworkUrl;
                        totalUpdated++;
                    });
                } else {
                    console.log(`    ⚠️ No artwork found`);
                }
            } else {
                console.log(`    ❌ HTTP ${response.status}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
        }
    }
    
    if (totalUpdated > 0) {
        console.log(`\n💾 Saving ${totalUpdated} artwork updates...`);
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            comprehensiveArtworkFix: {
                date: new Date().toISOString(),
                tracksUpdated: totalUpdated,
                albumsProcessed: foundAlbums.length,
                note: 'Comprehensive fix for placeholder artwork issues'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-comprehensive-artwork-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated with ${totalUpdated} artwork fixes`);
        
        // List what was fixed
        console.log('\n📋 Albums Fixed:');
        foundAlbums.forEach(album => {
            console.log(`  • ${album.name} (${album.trackCount} tracks)`);
        });
        
        // Regenerate the optimized cache
        console.log('\n🔄 Regenerating optimized cache...');
        const { execSync } = require('child_process');
        try {
            execSync('node scripts/create-optimized-cache.js', { stdio: 'pipe' });
            console.log('✅ Optimized cache regenerated');
        } catch (error) {
            console.log('⚠️ Please manually regenerate cache: node scripts/create-optimized-cache.js');
        }
        
    } else {
        console.log('\n💫 No artwork updates needed');
    }
    
    console.log('\n✅ Comprehensive artwork fix complete!');
}

fixPlaceholderArtwork();