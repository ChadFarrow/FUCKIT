#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;
const API_BASE = 'https://api.podcastindex.org/api/1.0';

// Load existing data
const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
const data = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Create backup
const backupPath = musicTracksPath + `.backup-hgh-resolve-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log(`✅ Created backup: ${backupPath}\n`);

// Create API headers
function createHeaders() {
    const timestamp = Math.floor(Date.now() / 1000);
    const authString = API_KEY + API_SECRET + timestamp;
    const hash = crypto.createHash('sha1').update(authString).digest('hex');
    
    return {
        'X-Auth-Key': API_KEY,
        'X-Auth-Date': timestamp,
        'Authorization': hash,
        'User-Agent': 'HGH-Resolver/1.0'
    };
}

// First, get the podcast feed info
async function getPodcastByGuid(feedGuid) {
    try {
        const url = `${API_BASE}/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
        const response = await axios.get(url, { headers: createHeaders() });
        
        if (response.data && response.data.feed) {
            return response.data.feed;
        }
    } catch (error) {
        console.log(`  ⚠️ Failed to fetch podcast ${feedGuid}: ${error.message}`);
    }
    return null;
}

// Then get episodes by feed ID
async function getEpisodesByFeedId(feedId, itemGuid) {
    try {
        // Try to get specific episode
        const url = `${API_BASE}/episodes/byfeedid?id=${feedId}&max=1000`;
        const response = await axios.get(url, { headers: createHeaders() });
        
        if (response.data && response.data.items) {
            // Find the specific episode by guid
            const episode = response.data.items.find(item => 
                item.guid === itemGuid || 
                item.enclosureUrl === itemGuid || 
                item.link === itemGuid
            );
            
            if (episode) {
                return episode;
            }
        }
    } catch (error) {
        console.log(`  ⚠️ Failed to fetch episodes for feed ${feedId}: ${error.message}`);
    }
    return null;
}

// Alternative: search by iTunes ID if GUID fails
async function searchByUrl(itemGuid) {
    try {
        // If itemGuid is a URL, try to search for it
        if (itemGuid.startsWith('http')) {
            const url = `${API_BASE}/search/byterm?q=${encodeURIComponent(itemGuid)}`;
            const response = await axios.get(url, { headers: createHeaders() });
            
            if (response.data && response.data.feeds && response.data.feeds.length > 0) {
                return response.data.feeds[0];
            }
        }
    } catch (error) {
        console.log(`  ⚠️ Failed to search for ${itemGuid}: ${error.message}`);
    }
    return null;
}

async function resolveUnresolvedTracks() {
    // Find all unresolved tracks
    const unresolvedTracks = data.musicTracks.filter(t => 
        t.needsResolution === true || 
        t.title === 'Unresolved Track'
    );
    
    console.log(`Found ${unresolvedTracks.length} unresolved tracks to process\n`);
    
    let resolved = 0;
    let failed = 0;
    
    // Cache for feed lookups
    const feedCache = {};
    
    for (let i = 0; i < unresolvedTracks.length; i++) {
        const track = unresolvedTracks[i];
        console.log(`[${i + 1}/${unresolvedTracks.length}] Processing ${track.feedGuid}/${track.itemGuid}...`);
        
        try {
            // Check feed cache first
            let feedInfo = feedCache[track.feedGuid];
            
            if (!feedInfo) {
                // Get podcast feed info
                feedInfo = await getPodcastByGuid(track.feedGuid);
                if (feedInfo) {
                    feedCache[track.feedGuid] = feedInfo;
                    console.log(`  ✓ Found podcast: ${feedInfo.title} (ID: ${feedInfo.id})`);
                }
            }
            
            if (feedInfo && feedInfo.id) {
                // Now get the episode
                const episode = await getEpisodesByFeedId(feedInfo.id, track.itemGuid);
                
                if (episode) {
                    // Update track with resolved data
                    track.title = episode.title || 'Unknown Track';
                    track.artist = feedInfo.title || 'Unknown Artist';
                    track.album = feedInfo.title || 'Unknown Album';
                    track.duration = episode.duration || 0;
                    track.enclosureUrl = episode.enclosureUrl || '';
                    track.image = episode.image || feedInfo.image || '';
                    track.link = episode.link || '';
                    track.pubDate = episode.datePublished ? new Date(episode.datePublished * 1000).toISOString() : new Date().toISOString();
                    track.source = 'podcast-index';
                    
                    // Add value block if available
                    if (episode.value) {
                        track.value = episode.value;
                    }
                    
                    // Remove needsResolution flag
                    delete track.needsResolution;
                    
                    resolved++;
                    console.log(`  ✅ Resolved: ${track.title} by ${track.artist}`);
                } else if (track.itemGuid.startsWith('http')) {
                    // Try URL-based search as fallback
                    console.log(`  🔍 Trying URL search for ${track.itemGuid}...`);
                    const searchResult = await searchByUrl(track.itemGuid);
                    
                    if (searchResult) {
                        track.title = `Track from ${searchResult.title}`;
                        track.artist = searchResult.title || 'Unknown Artist';
                        track.album = searchResult.title || 'Unknown Album';
                        track.image = searchResult.image || '';
                        track.source = 'podcast-index-search';
                        delete track.needsResolution;
                        resolved++;
                        console.log(`  ✅ Resolved via search: ${track.title}`);
                    } else {
                        failed++;
                        console.log(`  ❌ Could not resolve episode`);
                    }
                } else {
                    failed++;
                    console.log(`  ❌ Episode not found in feed`);
                }
            } else {
                failed++;
                console.log(`  ❌ Podcast feed not found`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            failed++;
        }
        
        // Rate limiting
        if (i % 5 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Save updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(data, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Resolution Complete!');
    console.log('='.repeat(50));
    console.log(`Total unresolved tracks: ${unresolvedTracks.length}`);
    console.log(`✅ Successfully resolved: ${resolved}`);
    console.log(`❌ Still unresolved: ${failed}`);
    console.log(`📁 Data saved to: ${musicTracksPath}`);
}

// Run the resolver
resolveUnresolvedTracks().catch(console.error);