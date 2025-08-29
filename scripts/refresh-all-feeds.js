#!/usr/bin/env node

/**
 * Comprehensive feed refresh system
 * Re-parses all RSS feeds and rebuilds the music tracks database
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple RSS parser
async function parseRSSFeed(feedUrl) {
    try {
        console.log(`  📡 Fetching: ${feedUrl}`);
        const response = await fetch(feedUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        // Extract feed metadata
        const feedTitleMatch = xmlText.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        const feedImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
        const feedGuidMatch = xmlText.match(/<podcast:guid>(.*?)<\/podcast:guid>/);
        const feedAuthorMatch = xmlText.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/);
        
        const feedData = {
            url: feedUrl,
            title: cleanText(feedTitleMatch ? feedTitleMatch[1] : ''),
            image: feedImageMatch ? feedImageMatch[1] : '',
            guid: feedGuidMatch ? feedGuidMatch[1] : generateGuid(feedUrl),
            author: cleanText(feedAuthorMatch ? feedAuthorMatch[1] : ''),
            tracks: []
        };
        
        // Parse items
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        itemMatches.forEach(item => {
            const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
            const enclosureMatch = item.match(/<enclosure url="(.*?)".*?\/>/);
            const guidMatch = item.match(/<guid.*?>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>/);
            const durationMatch = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
            const imageMatch = item.match(/<itunes:image href="(.*?)"/);
            const artistMatch = item.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/);
            
            if (titleMatch && enclosureMatch) {
                feedData.tracks.push({
                    title: cleanText(titleMatch[1]),
                    enclosureUrl: enclosureMatch[1],
                    guid: guidMatch ? cleanText(guidMatch[1]) : '',
                    duration: durationMatch ? parseDuration(durationMatch[1]) : 180,
                    image: imageMatch ? imageMatch[1] : feedData.image,
                    artist: cleanText(artistMatch ? artistMatch[1] : feedData.author)
                });
            }
        });
        
        console.log(`  ✅ Found ${feedData.tracks.length} tracks`);
        return feedData;
        
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        return null;
    }
}

function cleanText(text) {
    return text
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function parseDuration(durationString) {
    const parts = durationString.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 180;
}

function generateGuid(input) {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '5' + hash.substring(13, 16),
        ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
        hash.substring(20, 32)
    ].join('-');
}

async function refreshAllFeeds() {
    try {
        console.log('🔄 Comprehensive Feed Refresh System\n');
        console.log('=' .repeat(50));
        
        // Load current database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const currentData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log(`📊 Current database: ${currentData.musicTracks.length} tracks\n`);
        
        // Get unique feed URLs
        const feedUrls = new Set();
        currentData.musicTracks.forEach(track => {
            if (track.feedUrl) {
                feedUrls.add(track.feedUrl);
            }
        });
        
        console.log(`📡 Found ${feedUrls.size} unique feed URLs to refresh\n`);
        
        // Also check parsed-feeds.json for additional feeds
        const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
        if (fs.existsSync(parsedFeedsPath)) {
            const parsedFeeds = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
            if (parsedFeeds.feeds) {
                parsedFeeds.feeds.forEach(feed => {
                    if (feed.originalUrl) {
                        feedUrls.add(feed.originalUrl);
                    }
                });
            }
            console.log(`📡 Total feeds after checking parsed-feeds.json: ${feedUrls.size}\n`);
        }
        
        // Parse all feeds
        const newTracks = [];
        const failedFeeds = [];
        let successCount = 0;
        let totalTracksFound = 0;
        
        console.log('🔄 Refreshing feeds...\n');
        
        for (const feedUrl of feedUrls) {
            // Skip HGH reference feeds
            if (feedUrl.includes('homegrownhits.xyz')) {
                console.log(`  ⏭️ Skipping HGH reference feed: ${feedUrl}`);
                continue;
            }
            
            const feedData = await parseRSSFeed(feedUrl);
            
            if (feedData && feedData.tracks.length > 0) {
                successCount++;
                totalTracksFound += feedData.tracks.length;
                
                // Convert to music track format
                feedData.tracks.forEach(track => {
                    newTracks.push({
                        title: track.title,
                        feedTitle: feedData.title || 'Unknown Album',
                        feedArtist: track.artist || feedData.author || 'Unknown Artist',
                        feedUrl: feedUrl,
                        feedGuid: feedData.guid,
                        feedImage: feedData.image,
                        guid: track.guid || generateGuid(`${feedUrl}|${track.title}`),
                        enclosureUrl: track.enclosureUrl,
                        duration: track.duration,
                        image: track.image,
                        datePublished: Math.floor(Date.now() / 1000),
                        explicit: false,
                        source: 'Feed Refresh'
                    });
                });
            } else if (feedData) {
                console.log(`  ⚠️ No tracks found in ${feedUrl}`);
            } else {
                failedFeeds.push(feedUrl);
            }
            
            // Longer delay to avoid rate limiting on Wavlake
            if (feedUrl.includes('wavlake.com')) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay for Wavlake
            } else {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms for others
            }
        }
        
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Refresh Results:');
        console.log(`  ✅ Successfully parsed: ${successCount} feeds`);
        console.log(`  ❌ Failed: ${failedFeeds.length} feeds`);
        console.log(`  📀 Total tracks found: ${totalTracksFound}`);
        
        // Remove duplicates within new tracks
        console.log('\n🔍 Removing duplicates...');
        const uniqueTracks = [];
        const seenKeys = new Set();
        
        newTracks.forEach(track => {
            const key = `${track.feedGuid}|${track.title}|${track.enclosureUrl}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueTracks.push(track);
            }
        });
        
        console.log(`  Removed ${newTracks.length - uniqueTracks.length} duplicates`);
        console.log(`  Final track count: ${uniqueTracks.length}`);
        
        // Create new database
        const newDatabase = {
            musicTracks: uniqueTracks,
            metadata: {
                lastUpdated: new Date().toISOString(),
                totalRefresh: {
                    date: new Date().toISOString(),
                    feedsProcessed: feedUrls.size,
                    feedsSuccessful: successCount,
                    feedsFailed: failedFeeds.length,
                    tracksFound: totalTracksFound,
                    uniqueTracks: uniqueTracks.length,
                    note: 'Complete database refresh from RSS feeds'
                }
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-full-refresh-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
        console.log(`\n📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save new database
        fs.writeFileSync(musicDbPath, JSON.stringify(newDatabase, null, 2));
        console.log(`✅ Database refreshed: ${currentData.musicTracks.length} → ${uniqueTracks.length} tracks`);
        
        // Show failed feeds for investigation
        if (failedFeeds.length > 0) {
            console.log('\n⚠️ Failed feeds (may need manual attention):');
            failedFeeds.slice(0, 10).forEach(url => {
                console.log(`  - ${url}`);
            });
            if (failedFeeds.length > 10) {
                console.log(`  ... and ${failedFeeds.length - 10} more`);
            }
        }
        
        console.log('\n🎯 Feed refresh completed!');
        
    } catch (error) {
        console.error('❌ Error in refresh process:', error);
    }
}

// Run the refresh
console.log('⚠️ WARNING: This will rebuild the entire music tracks database!');
console.log('Make sure you have a backup before proceeding.\n');

// Add a 3-second delay for safety
console.log('Starting in 3 seconds... (Ctrl+C to cancel)');
setTimeout(refreshAllFeeds, 3000);