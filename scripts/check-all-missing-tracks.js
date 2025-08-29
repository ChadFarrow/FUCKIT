#!/usr/bin/env node

/**
 * Check all albums and EPs for missing tracks by comparing with RSS feeds
 */

const fs = require('fs');
const path = require('path');

async function checkAllMissingTracks() {
    console.log('🔍 Comprehensive Missing Tracks Analysis\n');
    console.log('=' .repeat(60));
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Group tracks by feed to create albums
    const albumGroups = new Map();
    musicData.musicTracks.forEach(track => {
        const key = track.feedGuid || track.feedUrl || `${track.feedTitle}-${track.feedArtist}`;
        
        if (!albumGroups.has(key)) {
            albumGroups.set(key, {
                feedUrl: track.feedUrl,
                feedTitle: track.feedTitle,
                feedArtist: track.feedArtist,
                feedGuid: track.feedGuid,
                tracks: []
            });
        }
        albumGroups.get(key).tracks.push(track);
    });
    
    console.log(`📊 Found ${albumGroups.size} albums/feeds to check`);
    
    // Filter to albums and EPs (exclude singles and broken feeds)
    const albumsToCheck = Array.from(albumGroups.values()).filter(album => {
        // Skip HGH references
        if (album.feedTitle && album.feedTitle.includes('Music Reference from Homegrown Hits')) {
            return false;
        }
        
        // Skip feeds without URLs
        if (!album.feedUrl || album.feedUrl === 'https://homegrownhits.xyz') {
            return false;
        }
        
        // Focus on potential albums/EPs (might have missing tracks)
        // Include all since we don't know how many tracks should be there
        return true;
    }).slice(0, 30); // Limit to first 30 for initial scan
    
    console.log(`🎯 Checking ${albumsToCheck.length} albums for missing tracks...\n`);
    
    const results = {
        albumsWithMissingTracks: [],
        albumsUpToDate: [],
        failedFeeds: [],
        totalTracksFound: 0,
        totalTracksMissing: 0
    };
    
    for (const [index, album] of albumsToCheck.entries()) {
        try {
            const currentTracks = album.tracks.length;
            console.log(`\n${index + 1}/${albumsToCheck.length}. "${album.feedTitle}" by ${album.feedArtist}`);
            console.log(`   Current tracks: ${currentTracks}`);
            console.log(`   Feed: ${album.feedUrl}`);
            
            // Fetch RSS feed
            const response = await fetch(album.feedUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)'
                }
            });
            
            if (!response.ok) {
                console.log(`   ❌ HTTP ${response.status}`);
                results.failedFeeds.push({
                    title: album.feedTitle,
                    artist: album.feedArtist,
                    feedUrl: album.feedUrl,
                    error: `HTTP ${response.status}`
                });
                continue;
            }
            
            const xmlText = await response.text();
            
            // Count items in RSS feed
            const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
            const feedTrackCount = itemMatches.length;
            
            console.log(`   RSS tracks: ${feedTrackCount}`);
            
            results.totalTracksFound += feedTrackCount;
            
            if (feedTrackCount > currentTracks) {
                const missingCount = feedTrackCount - currentTracks;
                results.totalTracksMissing += missingCount;
                
                console.log(`   🚨 MISSING ${missingCount} tracks!`);
                
                // Get track titles from RSS for comparison
                const rssTrackTitles = itemMatches.map(item => {
                    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
                    return titleMatch ? titleMatch[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() : 'Unknown';
                });
                
                const dbTrackTitles = album.tracks.map(t => t.title);
                
                // Find which tracks are missing
                const missingTracks = rssTrackTitles.filter(rssTitle => 
                    !dbTrackTitles.some(dbTitle => 
                        dbTitle.toLowerCase() === rssTitle.toLowerCase()
                    )
                );
                
                results.albumsWithMissingTracks.push({
                    title: album.feedTitle,
                    artist: album.feedArtist,
                    feedUrl: album.feedUrl,
                    currentTracks,
                    feedTracks: feedTrackCount,
                    missingCount,
                    missingTracks: missingTracks.slice(0, 5), // Show first 5 missing
                    priority: missingCount > 5 ? 'HIGH' : missingCount > 2 ? 'MEDIUM' : 'LOW'
                });
                
                // Show sample missing tracks
                if (missingTracks.length > 0) {
                    console.log(`   Missing tracks (showing first 3):`);
                    missingTracks.slice(0, 3).forEach(track => {
                        console.log(`     - "${track}"`);
                    });
                    if (missingTracks.length > 3) {
                        console.log(`     ... and ${missingTracks.length - 3} more`);
                    }
                }
                
            } else if (feedTrackCount === currentTracks) {
                console.log(`   ✅ Up to date`);
                results.albumsUpToDate.push({
                    title: album.feedTitle,
                    artist: album.feedArtist,
                    trackCount: currentTracks
                });
            } else {
                console.log(`   📊 Database has more tracks than RSS (${currentTracks} vs ${feedTrackCount})`);
                // This could indicate duplicates were cleaned up or RSS feed was updated
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1500));
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.failedFeeds.push({
                title: album.feedTitle,
                artist: album.feedArtist,
                feedUrl: album.feedUrl,
                error: error.message
            });
        }
    }
    
    // Summary report
    console.log('\n' + '=' .repeat(60));
    console.log('📋 MISSING TRACKS SUMMARY REPORT');
    console.log('=' .repeat(60));
    
    console.log(`\n📊 Statistics:`);
    console.log(`  Albums checked: ${albumsToCheck.length}`);
    console.log(`  Albums with missing tracks: ${results.albumsWithMissingTracks.length}`);
    console.log(`  Albums up to date: ${results.albumsUpToDate.length}`);
    console.log(`  Failed feeds: ${results.failedFeeds.length}`);
    console.log(`  Total tracks found in RSS: ${results.totalTracksFound}`);
    console.log(`  Total tracks missing: ${results.totalTracksMissing}`);
    
    if (results.albumsWithMissingTracks.length > 0) {
        console.log(`\n🚨 ALBUMS WITH MISSING TRACKS (${results.albumsWithMissingTracks.length}):`);
        
        // Sort by priority and missing count
        const sortedMissing = results.albumsWithMissingTracks.sort((a, b) => {
            if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
            if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
            return b.missingCount - a.missingCount;
        });
        
        sortedMissing.forEach((album, i) => {
            console.log(`\n${i + 1}. [${album.priority}] "${album.title}" by ${album.artist}`);
            console.log(`   Missing: ${album.missingCount}/${album.feedTracks} tracks`);
            console.log(`   Feed: ${album.feedUrl}`);
            if (album.missingTracks.length > 0) {
                console.log(`   Sample missing: ${album.missingTracks.slice(0, 2).map(t => `"${t}"`).join(', ')}`);
            }
        });
        
        // Save detailed report
        const reportPath = path.join(process.cwd(), 'data', `missing-tracks-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: {
                albumsChecked: albumsToCheck.length,
                albumsWithMissingTracks: results.albumsWithMissingTracks.length,
                totalTracksMissing: results.totalTracksMissing
            },
            missingTracks: results.albumsWithMissingTracks,
            failedFeeds: results.failedFeeds
        }, null, 2));
        
        console.log(`\n📄 Detailed report saved: ${path.basename(reportPath)}`);
        
        // Generate fix script suggestions
        console.log(`\n💡 RECOMMENDED ACTIONS:`);
        const highPriority = results.albumsWithMissingTracks.filter(a => a.priority === 'HIGH');
        const mediumPriority = results.albumsWithMissingTracks.filter(a => a.priority === 'MEDIUM');
        
        if (highPriority.length > 0) {
            console.log(`  🔴 HIGH Priority (${highPriority.length} albums): Fix immediately`);
            highPriority.slice(0, 3).forEach(album => {
                console.log(`     - "${album.title}" (missing ${album.missingCount} tracks)`);
            });
        }
        
        if (mediumPriority.length > 0) {
            console.log(`  🟡 MEDIUM Priority (${mediumPriority.length} albums): Fix when convenient`);
        }
        
        console.log(`\n🛠️  Use: node scripts/refresh-specific-album.js <feedUrl> to fix individual albums`);
        
    } else {
        console.log(`\n✅ All checked albums appear to be up to date!`);
    }
    
    if (results.failedFeeds.length > 0) {
        console.log(`\n⚠️  FAILED FEEDS (${results.failedFeeds.length}):`);
        results.failedFeeds.forEach((feed, i) => {
            console.log(`  ${i + 1}. "${feed.title}" - ${feed.error}`);
        });
    }
    
    console.log('\n✅ Missing tracks analysis complete!');
    return results;
}

checkAllMissingTracks();