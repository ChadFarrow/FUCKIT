#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Podcast Index API configuration
const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Load API credentials from .env.local if not in environment
if (!API_KEY || !API_SECRET) {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        lines.forEach(line => {
            const [key, value] = line.split('=');
            if (key === 'PODCAST_INDEX_API_KEY' && !API_KEY) {
                process.env.PODCAST_INDEX_API_KEY = value.trim();
            }
            if (key === 'PODCAST_INDEX_API_SECRET' && !API_SECRET) {
                process.env.PODCAST_INDEX_API_SECRET = value.trim();
            }
        });
    }
}

// Function to make API request to Podcast Index
async function fetchFromPodcastIndex(endpoint) {
    const crypto = require('crypto');
    const apiKey = process.env.PODCAST_INDEX_API_KEY;
    const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
        throw new Error('Podcast Index API credentials not found');
    }
    
    const authTime = Math.floor(Date.now() / 1000);
    const authString = apiKey + apiSecret + authTime;
    const authHeader = crypto.createHash('sha1').update(authString).digest('hex');
    
    const options = {
        hostname: 'api.podcastindex.org',
        path: endpoint,
        method: 'GET',
        headers: {
            'X-Auth-Key': apiKey,
            'X-Auth-Date': authTime,
            'Authorization': authHeader,
            'User-Agent': 'FUCKIT-Music-Database/1.0'
        }
    };
    
    return new Promise((resolve, reject) => {
        https.get(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🔍 Resolving Remote Items and Fetching Real Dates\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-remote-${Date.now()}`;
    console.log(`Creating backup at ${backupPath}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with placeholder dates
    const placeholderTracks = musicData.musicTracks.filter(track => 
        track.addedDate?.startsWith('2025-08-23')
    );
    
    console.log(`Found ${placeholderTracks.length} tracks with placeholder dates`);
    
    // Group by feedGuid if available
    const feedGuids = new Set();
    placeholderTracks.forEach(track => {
        // Extract feedGuid from various possible fields
        if (track.feedGuid) feedGuids.add(track.feedGuid);
        if (track.publisherFeedGuid) feedGuids.add(track.publisherFeedGuid);
        
        // Also check for tracks that might be remote items
        if (track.id && track.id.includes('-')) {
            // This might be a GUID
            feedGuids.add(track.id);
        }
    });
    
    console.log(`Found ${feedGuids.size} unique feed GUIDs to resolve\n`);
    
    let updatedCount = 0;
    const failedGuids = [];
    
    // Process each feed GUID
    for (const feedGuid of feedGuids) {
        if (!feedGuid || feedGuid === 'null' || feedGuid === 'undefined') continue;
        
        console.log(`Fetching feed info for GUID: ${feedGuid}`);
        
        try {
            // Try to get feed info from Podcast Index
            const feedInfo = await fetchFromPodcastIndex(`/api/1.0/podcasts/byguid?guid=${feedGuid}`);
            
            if (feedInfo && feedInfo.feed) {
                const feed = feedInfo.feed;
                console.log(`  Found: ${feed.title || 'Unknown'}`);
                
                // Get episodes for this feed
                const episodes = await fetchFromPodcastIndex(`/api/1.0/episodes/byfeedguid?guid=${feedGuid}&max=1000`);
                
                if (episodes && episodes.items) {
                    // Update tracks with matching GUIDs
                    placeholderTracks.forEach(track => {
                        if (track.feedGuid === feedGuid || track.publisherFeedGuid === feedGuid) {
                            // Find matching episode by title or GUID
                            const matchingEpisode = episodes.items.find(ep => 
                                ep.title === track.title || 
                                ep.guid === track.guid ||
                                ep.enclosureUrl === track.enclosureUrl
                            );
                            
                            if (matchingEpisode) {
                                // Update with real date
                                const realDate = new Date(matchingEpisode.datePublished * 1000).toISOString();
                                track.datePublished = realDate;
                                track.pubDate = realDate;
                                track.addedDate = realDate;
                                updatedCount++;
                                console.log(`    ✅ Updated: ${track.title}`);
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedGuids.push(feedGuid);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // For tracks still with placeholder dates, try to infer from similar tracks
    console.log('\n🔍 Inferring dates for remaining tracks...');
    
    placeholderTracks.forEach(track => {
        if (track.addedDate?.startsWith('2025-08-23')) {
            // Find similar tracks with real dates
            const similarTrack = musicData.musicTracks.find(t => 
                t !== track &&
                t.album === track.album &&
                t.artist === track.artist &&
                t.datePublished &&
                !t.datePublished.startsWith('2025')
            );
            
            if (similarTrack) {
                track.datePublished = similarTrack.datePublished;
                track.pubDate = similarTrack.pubDate || similarTrack.datePublished;
                track.addedDate = similarTrack.datePublished;
                updatedCount++;
                console.log(`  Inferred date for: ${track.title}`);
            }
        }
    });
    
    // For any still remaining, set to a more reasonable default (today's actual date)
    const today = new Date().toISOString();
    let defaultedCount = 0;
    
    musicData.musicTracks.forEach(track => {
        if (track.addedDate?.startsWith('2025-08-23')) {
            track.addedDate = today;
            if (!track.datePublished) {
                track.datePublished = today;
            }
            if (!track.pubDate) {
                track.pubDate = today;
            }
            defaultedCount++;
        }
    });
    
    // Save updated data
    console.log('\n💾 Saving updated music tracks...');
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Updated ${updatedCount} tracks with real dates from feeds`);
    console.log(`- Set ${defaultedCount} tracks to current date (no data available)`);
    console.log(`- Failed to fetch ${failedGuids.length} feed GUIDs`);
    console.log(`- Backup saved at: ${backupPath}`);
}

main().catch(console.error);