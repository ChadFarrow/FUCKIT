#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;
const API_BASE = 'https://api.podcastindex.org/api/1.0';

// Load existing data
const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
const existingData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Initialize data structure if needed
if (!existingData.musicTracks) existingData.musicTracks = [];
if (!existingData.playlists) existingData.playlists = [];

// Create backup
const backupPath = musicTracksPath + `.backup-hgh-new-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(existingData, null, 2));
console.log(`✅ Created backup: ${backupPath}`);

// Parse the new HGH playlist
async function parsePlaylist() {
    const xmlContent = fs.readFileSync(path.join(__dirname, '../data/hgh-playlist-new.xml'), 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    const channel = result.rss.channel[0];
    const playlistGuid = channel['podcast:guid'][0];
    const remoteItems = channel['podcast:remoteItem'] || [];
    
    console.log(`\n📋 Playlist: ${channel.title[0]}`);
    console.log(`🆔 Playlist GUID: ${playlistGuid}`);
    console.log(`🎵 Total tracks: ${remoteItems.length}\n`);
    
    return { playlistGuid, remoteItems, channel };
}

// Create API headers
function createHeaders() {
    const timestamp = Math.floor(Date.now() / 1000);
    const authString = API_KEY + API_SECRET + timestamp;
    const hash = crypto.createHash('sha1').update(authString).digest('hex');
    
    return {
        'X-Auth-Key': API_KEY,
        'X-Auth-Date': timestamp,
        'Authorization': hash,
        'User-Agent': 'HGH-Playlist-Processor/1.0'
    };
}

// Fetch track from Podcast Index
async function fetchTrackFromIndex(feedGuid, itemGuid) {
    try {
        const url = `${API_BASE}/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&feedguid=${encodeURIComponent(feedGuid)}`;
        const response = await axios.get(url, { headers: createHeaders() });
        
        if (response.data.episode) {
            return response.data.episode;
        }
    } catch (error) {
        console.log(`  ⚠️ Failed to fetch ${feedGuid}/${itemGuid}: ${error.message}`);
    }
    return null;
}

// Process all tracks
async function processAllTracks() {
    const { playlistGuid, remoteItems, channel } = await parsePlaylist();
    
    // Find or create HGH playlist in existingData
    let hghPlaylist = existingData.playlists.find(p => p.guid === playlistGuid);
    
    if (!hghPlaylist) {
        hghPlaylist = {
            guid: playlistGuid,
            title: channel.title[0],
            description: channel.description ? channel.description[0] : '',
            image: channel.image && channel.image[0] && channel.image[0].url ? channel.image[0].url[0] : '',
            link: channel.link ? channel.link[0] : '',
            tracks: []
        };
        existingData.playlists.push(hghPlaylist);
        console.log('✅ Created new HGH playlist entry\n');
    } else {
        console.log('📝 Updating existing HGH playlist\n');
        // Clear existing tracks to replace with new ones
        hghPlaylist.tracks = [];
    }
    
    // Process each remote item
    let processed = 0;
    let resolved = 0;
    let failed = 0;
    
    for (const item of remoteItems) {
        const feedGuid = item.$.feedGuid;
        const itemGuid = item.$.itemGuid;
        
        processed++;
        
        // Check if track already exists in our data
        let existingTrack = existingData.musicTracks.find(t => 
            t.feedGuid === feedGuid && t.itemGuid === itemGuid
        );
        
        if (!existingTrack) {
            // Try to fetch from Podcast Index
            console.log(`[${processed}/${remoteItems.length}] Fetching ${feedGuid}/${itemGuid}...`);
            const indexData = await fetchTrackFromIndex(feedGuid, itemGuid);
            
            if (indexData) {
                existingTrack = {
                    id: `hgh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    feedGuid: feedGuid,
                    itemGuid: itemGuid,
                    title: indexData.title || 'Unknown Track',
                    artist: indexData.feedTitle || 'Unknown Artist', 
                    album: indexData.feedTitle || 'Unknown Album',
                    duration: indexData.duration || 0,
                    enclosureUrl: indexData.enclosureUrl || '',
                    image: indexData.image || indexData.feedImage || '',
                    link: indexData.link || '',
                    pubDate: indexData.datePublished ? new Date(indexData.datePublished * 1000).toISOString() : new Date().toISOString(),
                    source: 'podcast-index',
                    playlistSource: 'HGH'
                };
                
                // Add value block if available
                if (indexData.value) {
                    existingTrack.value = indexData.value;
                }
                
                existingData.musicTracks.push(existingTrack);
                resolved++;
                console.log(`  ✅ Resolved: ${existingTrack.title} by ${existingTrack.artist}`);
            } else {
                // Create placeholder track
                existingTrack = {
                    id: `hgh_unresolved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    feedGuid: feedGuid,
                    itemGuid: itemGuid,
                    title: 'Unresolved Track',
                    artist: 'Unknown Artist',
                    playlistSource: 'HGH',
                    needsResolution: true
                };
                existingData.musicTracks.push(existingTrack);
                failed++;
                console.log(`  ❌ Failed to resolve, created placeholder`);
            }
        } else {
            // Track exists, just ensure it's marked as HGH
            if (!existingTrack.playlistSource) {
                existingTrack.playlistSource = 'HGH';
            }
            console.log(`[${processed}/${remoteItems.length}] Track already exists: ${existingTrack.title}`);
        }
        
        // Add track reference to playlist
        hghPlaylist.tracks.push({
            feedGuid: feedGuid,
            itemGuid: itemGuid,
            trackId: existingTrack.id
        });
        
        // Rate limiting
        if (processed % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Save updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(existingData, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Processing Complete!');
    console.log('='.repeat(50));
    console.log(`Total tracks processed: ${processed}`);
    console.log(`✅ Successfully resolved: ${resolved}`);
    console.log(`❌ Failed to resolve: ${failed}`);
    console.log(`📁 Data saved to: ${musicTracksPath}`);
    
    return { processed, resolved, failed };
}

// Run the processor
processAllTracks().catch(console.error);