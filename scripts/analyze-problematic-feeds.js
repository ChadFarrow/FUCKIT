#!/usr/bin/env node

/**
 * Analyze which feeds are causing the most artist/album issues
 */

const fs = require('fs');
const path = require('path');

async function analyzeProblematicFeeds() {
    try {
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log('🔍 Analyzing feeds causing artist/album issues...\n');
        
        const feedIssues = new Map();
        
        musicData.musicTracks.forEach((track, index) => {
            const feedUrl = track.feedUrl;
            const artist = track.feedArtist || '';
            const album = track.feedTitle || '';
            
            if (!feedIssues.has(feedUrl)) {
                feedIssues.set(feedUrl, {
                    totalTracks: 0,
                    emptyArtists: 0,
                    emptyAlbums: 0,
                    tracks: []
                });
            }
            
            const feedStats = feedIssues.get(feedUrl);
            feedStats.totalTracks++;
            
            if (!artist || artist.trim() === '') {
                feedStats.emptyArtists++;
            }
            
            if (!album || album.trim() === '') {
                feedStats.emptyAlbums++;
            }
            
            // Store a sample track for reference
            if (feedStats.tracks.length < 3) {
                feedStats.tracks.push({
                    index,
                    title: track.title,
                    artist: artist || '(empty)',
                    album: album || '(empty)'
                });
            }
        });
        
        // Convert to array and sort by most problematic
        const sortedFeeds = [...feedIssues.entries()]
            .map(([url, stats]) => ({
                url,
                ...stats,
                issueRate: (stats.emptyArtists + stats.emptyAlbums) / (stats.totalTracks * 2) * 100,
                totalIssues: stats.emptyArtists + stats.emptyAlbums
            }))
            .sort((a, b) => b.totalIssues - a.totalIssues);
        
        // Show top 15 most problematic feeds
        console.log('🚨 Most Problematic Feeds (by total issues):');
        console.log('─'.repeat(80));
        
        sortedFeeds.slice(0, 15).forEach((feed, index) => {
            const displayUrl = feed.url ? feed.url.substring(0, 70) : 'Unknown URL';
            console.log(`${index + 1}. ${displayUrl}...`);
            console.log(`   Total tracks: ${feed.totalTracks}, Missing artists: ${feed.emptyArtists}, Missing albums: ${feed.emptyAlbums}`);
            console.log(`   Issue rate: ${feed.issueRate.toFixed(1)}%`);
            
            // Show sample tracks
            console.log('   Sample tracks:');
            feed.tracks.forEach(track => {
                console.log(`     • "${track.title}" by ${track.artist} (album: ${track.album})`);
            });
            console.log();
        });
        
        // Analyze by domain
        const domainIssues = new Map();
        sortedFeeds.forEach(feed => {
            try {
                const domain = new URL(feed.url).hostname;
                
                if (!domainIssues.has(domain)) {
                    domainIssues.set(domain, {
                        feeds: 0,
                        totalTracks: 0,
                        totalIssues: 0,
                        avgIssueRate: 0
                    });
                }
                
                const domainStats = domainIssues.get(domain);
                domainStats.feeds++;
                domainStats.totalTracks += feed.totalTracks;
                domainStats.totalIssues += feed.totalIssues;
            } catch (e) {
                // Skip invalid URLs
            }
        });
        
        // Calculate average issue rates per domain
        domainIssues.forEach((stats, domain) => {
            stats.avgIssueRate = (stats.totalIssues / (stats.totalTracks * 2)) * 100;
        });
        
        const sortedDomains = [...domainIssues.entries()]
            .sort((a, b) => b[1].totalIssues - a[1].totalIssues);
        
        console.log('🌐 Issues by Domain:');
        console.log('─'.repeat(60));
        sortedDomains.forEach(([domain, stats], index) => {
            console.log(`${index + 1}. ${domain}`);
            console.log(`   Feeds: ${stats.feeds}, Tracks: ${stats.totalTracks}, Issues: ${stats.totalIssues}`);
            console.log(`   Average issue rate: ${stats.avgIssueRate.toFixed(1)}%`);
            console.log();
        });
        
        // Summary
        console.log('📊 Summary:');
        console.log(`Total feeds analyzed: ${feedIssues.size}`);
        console.log(`Feeds with 100% missing artists: ${sortedFeeds.filter(f => f.emptyArtists === f.totalTracks).length}`);
        console.log(`Feeds with 100% missing albums: ${sortedFeeds.filter(f => f.emptyAlbums === f.totalTracks).length}`);
        console.log(`Feeds with some issues: ${sortedFeeds.filter(f => f.totalIssues > 0).length}`);
        console.log(`Completely clean feeds: ${sortedFeeds.filter(f => f.totalIssues === 0).length}`);
        
    } catch (error) {
        console.error('❌ Error analyzing feeds:', error);
    }
}

// Run the analysis
analyzeProblematicFeeds();