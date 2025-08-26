#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const xml2js = require('xml2js');

// Function to fetch and parse RSS feed
async function fetchFeedData(feedUrl) {
    return new Promise((resolve, reject) => {
        https.get(feedUrl, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                xml2js.parseString(data, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        }).on('error', reject);
    });
}

// Extract dates from feed
function extractDatesFromFeed(feedData) {
    const dates = {};
    
    try {
        const channel = feedData.rss?.channel?.[0];
        if (!channel) return dates;
        
        // Get channel-level dates
        if (channel.pubDate?.[0]) {
            dates.channelPubDate = new Date(channel.pubDate[0]).toISOString();
        }
        if (channel.lastBuildDate?.[0]) {
            dates.channelLastBuild = new Date(channel.lastBuildDate[0]).toISOString();
        }
        
        // Get item-level dates
        const items = channel.item || [];
        dates.items = {};
        
        items.forEach(item => {
            const title = item.title?.[0] || 'Unknown';
            const itemDates = {};
            
            if (item.pubDate?.[0]) {
                itemDates.pubDate = new Date(item.pubDate[0]).toISOString();
            }
            if (item['itunes:datePublished']?.[0]) {
                itemDates.itunesDate = new Date(item['itunes:datePublished'][0]).toISOString();
            }
            
            dates.items[title] = itemDates;
        });
        
    } catch (error) {
        console.error('Error extracting dates:', error);
    }
    
    return dates;
}

async function main() {
    console.log('🔍 Fetching Missing Dates from RSS Feeds\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-dates-${Date.now()}`;
    console.log(`Creating backup at ${backupPath}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with placeholder dates and valid feed URLs
    const tracksToUpdate = musicData.musicTracks.filter(track => 
        track.addedDate?.startsWith('2025-08-23') && 
        track.feedUrl && 
        track.feedUrl.startsWith('http')
    );
    
    console.log(`Found ${tracksToUpdate.length} tracks with placeholder dates and valid feed URLs\n`);
    
    // Group by feed URL to minimize API calls
    const feedGroups = {};
    tracksToUpdate.forEach(track => {
        if (!feedGroups[track.feedUrl]) {
            feedGroups[track.feedUrl] = [];
        }
        feedGroups[track.feedUrl].push(track);
    });
    
    const feedUrls = Object.keys(feedGroups);
    console.log(`Need to fetch ${feedUrls.length} unique feeds\n`);
    
    let updatedCount = 0;
    let failedFeeds = [];
    
    // Process each feed
    for (let i = 0; i < feedUrls.length; i++) {
        const feedUrl = feedUrls[i];
        const tracks = feedGroups[feedUrl];
        
        console.log(`[${i + 1}/${feedUrls.length}] Fetching: ${feedUrl}`);
        console.log(`  Tracks to update: ${tracks.length}`);
        
        try {
            const feedData = await fetchFeedData(feedUrl);
            const dates = extractDatesFromFeed(feedData);
            
            // Update tracks with fetched dates
            tracks.forEach(track => {
                const itemDates = dates.items[track.title];
                
                if (itemDates?.pubDate) {
                    track.datePublished = itemDates.pubDate;
                    track.pubDate = itemDates.pubDate;
                    updatedCount++;
                } else if (itemDates?.itunesDate) {
                    track.datePublished = itemDates.itunesDate;
                    track.pubDate = itemDates.itunesDate;
                    updatedCount++;
                } else if (dates.channelPubDate) {
                    // Use channel date as fallback
                    track.datePublished = dates.channelPubDate;
                    track.pubDate = dates.channelPubDate;
                    updatedCount++;
                }
                
                // Update addedDate to use the real publish date if found
                if (track.datePublished && track.datePublished !== '2025-08-23') {
                    track.addedDate = track.datePublished;
                }
            });
            
            console.log(`  ✅ Updated ${tracks.filter(t => t.datePublished).length} tracks\n`);
            
        } catch (error) {
            console.log(`  ❌ Failed to fetch: ${error.message}\n`);
            failedFeeds.push(feedUrl);
        }
        
        // Rate limiting - wait between requests
        if (i < feedUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Save updated data
    console.log('\n💾 Saving updated music tracks...');
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Updated ${updatedCount} tracks with real dates`);
    console.log(`- Failed to fetch ${failedFeeds.length} feeds`);
    console.log(`- Backup saved at: ${backupPath}`);
    
    if (failedFeeds.length > 0) {
        console.log('\nFailed feeds:');
        failedFeeds.forEach(url => console.log(`  - ${url}`));
    }
}

// Check if xml2js is installed
try {
    require('xml2js');
    main().catch(console.error);
} catch (error) {
    console.log('Installing required dependency: xml2js');
    const { execSync } = require('child_process');
    execSync('npm install xml2js', { stdio: 'inherit' });
    console.log('Dependency installed. Please run the script again.');
}