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
const backupPath = musicTracksPath + `.backup-hgh-fix-${Date.now()}`;
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

// Try multiple approaches to resolve a track
async function resolveTrack(feedGuid, itemGuid) {
    try {
        // Method 1: Try direct podcast + episode lookup
        const podcastUrl = `${API_BASE}/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
        const podcastResp = await axios.get(podcastUrl, { headers: createHeaders() });
        
        if (podcastResp.data && podcastResp.data.feed) {
            const feedId = podcastResp.data.feed.id;
            const feedTitle = podcastResp.data.feed.title;
            
            console.log(`  ✓ Found podcast: ${feedTitle} (ID: ${feedId})`);
            
            // Get episodes for this feed
            const episodesUrl = `${API_BASE}/episodes/byfeedid?id=${feedId}&max=1000`;
            const episodesResp = await axios.get(episodesUrl, { headers: createHeaders() });
            
            if (episodesResp.data && episodesResp.data.items) {
                // Try to match by various fields
                const episode = episodesResp.data.items.find(item => 
                    item.guid === itemGuid || 
                    item.enclosureUrl === itemGuid || 
                    item.link === itemGuid ||
                    (item.enclosureUrl && item.enclosureUrl.includes(itemGuid))
                );
                
                if (episode) {
                    return {
                        title: episode.title || 'Unknown Track',
                        artist: feedTitle || 'Unknown Artist',
                        album: feedTitle || 'Unknown Album',
                        duration: episode.duration || 0,
                        enclosureUrl: episode.enclosureUrl || '',
                        image: episode.image || podcastResp.data.feed.image || '',
                        link: episode.link || '',
                        pubDate: episode.datePublished ? new Date(episode.datePublished * 1000).toISOString() : new Date().toISOString(),
                        value: episode.value || null
                    };
                }
            }
        }
        
        // Method 2: Try search by term if it's a URL
        if (itemGuid && itemGuid.startsWith('http')) {
            const searchUrl = `${API_BASE}/search/music/byterm?q=${encodeURIComponent(itemGuid.split('/').pop())}`;
            const searchResp = await axios.get(searchUrl, { headers: createHeaders() });
            
            if (searchResp.data && searchResp.data.items && searchResp.data.items.length > 0) {
                const item = searchResp.data.items[0];
                return {
                    title: item.title || 'Unknown Track',
                    artist: item.feedTitle || 'Unknown Artist',
                    album: item.feedTitle || 'Unknown Album',
                    duration: item.duration || 0,
                    enclosureUrl: item.enclosureUrl || '',
                    image: item.image || item.feedImage || '',
                    link: item.link || '',
                    pubDate: item.datePublished ? new Date(item.datePublished * 1000).toISOString() : new Date().toISOString(),
                    value: item.value || null
                };
            }
        }
        
    } catch (error) {
        // Silent fail - will be reported as unresolved
    }
    
    return null;
}

async function resolveHGHPlaylistTracks() {
    // Find all unresolved HGH tracks
    const unresolvedTracks = data.musicTracks.filter(t => 
        t.id && typeof t.id === 'string' && 
        t.id.includes('hgh_unresolved') && 
        t.playlistSource === 'HGH'
    );
    
    console.log(`🎵 Found ${unresolvedTracks.length} unresolved HGH playlist tracks\n`);
    console.log('Starting resolution process...\n');
    
    let resolved = 0;
    let failed = 0;
    const batchSize = 5;
    
    for (let i = 0; i < unresolvedTracks.length; i += batchSize) {
        const batch = unresolvedTracks.slice(i, Math.min(i + batchSize, unresolvedTracks.length));
        
        // Process batch in parallel
        const promises = batch.map(async (track, idx) => {
            const num = i + idx + 1;
            console.log(`[${num}/${unresolvedTracks.length}] Processing ${track.feedGuid}/${track.itemGuid}...`);
            
            const resolvedData = await resolveTrack(track.feedGuid, track.itemGuid);
            
            if (resolvedData) {
                // Update track with resolved data
                track.title = resolvedData.title;
                track.artist = resolvedData.artist;
                track.album = resolvedData.album;
                track.duration = resolvedData.duration;
                track.enclosureUrl = resolvedData.enclosureUrl;
                track.image = resolvedData.image;
                track.link = resolvedData.link;
                track.pubDate = resolvedData.pubDate;
                track.source = 'podcast-index';
                
                if (resolvedData.value) {
                    track.value = resolvedData.value;
                }
                
                // Remove needsResolution flag and update ID
                delete track.needsResolution;
                track.id = `hgh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                console.log(`  ✅ Resolved: ${track.title} by ${track.artist}`);
                return true;
            } else {
                console.log(`  ❌ Could not resolve`);
                return false;
            }
        });
        
        const results = await Promise.all(promises);
        resolved += results.filter(r => r === true).length;
        failed += results.filter(r => r === false).length;
        
        // Rate limiting between batches
        if (i + batchSize < unresolvedTracks.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Save updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(data, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 HGH Playlist Resolution Complete!');
    console.log('='.repeat(50));
    console.log(`Total unresolved tracks: ${unresolvedTracks.length}`);
    console.log(`✅ Successfully resolved: ${resolved}`);
    console.log(`❌ Still unresolved: ${failed}`);
    console.log(`📁 Data saved to: ${musicTracksPath}`);
    
    // If many still unresolved, provide guidance
    if (failed > 100) {
        console.log('\n⚠️  Many tracks remain unresolved. Possible reasons:');
        console.log('- These feeds/episodes may not be in the Podcast Index');
        console.log('- The GUIDs may be outdated or from a different system');
        console.log('- Some may be from private or removed feeds');
    }
}

// Run the resolver
resolveHGHPlaylistTracks().catch(console.error);