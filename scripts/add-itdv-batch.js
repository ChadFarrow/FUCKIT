#!/usr/bin/env node

/**
 * Add ITDV playlist tracks in batches to avoid timeouts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function addITDVBatch(startIndex = 0, batchSize = 10) {
    console.log(`🎵 ITDV Batch Import (starting from ${startIndex}, batch size: ${batchSize})\n`);
    
    try {
        // Load stored feed mapping if exists
        const mappingPath = path.join(process.cwd(), 'data', 'itdv-feed-mapping.json');
        let feedUrlMap = new Map();
        
        if (fs.existsSync(mappingPath)) {
            const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
            feedUrlMap = new Map(Object.entries(mapping.feedUrls || {}));
            console.log(`📋 Loaded ${feedUrlMap.size} cached feed URLs`);
        }
        
        // If no cached mapping, create it first
        if (feedUrlMap.size === 0) {
            console.log('🔍 No cached feed mapping found. Creating new mapping...');
            await createFeedMapping();
            return;
        }
        
        // Get feed URLs for this batch
        const allFeedUrls = Array.from(feedUrlMap.values());
        const batchUrls = allFeedUrls.slice(startIndex, startIndex + batchSize);
        
        console.log(`📊 Processing ${batchUrls.length} feeds (${startIndex + 1}-${startIndex + batchUrls.length} of ${allFeedUrls.length})`);
        
        if (batchUrls.length === 0) {
            console.log('✅ All feeds processed!');
            return;
        }
        
        // Process this batch
        const allTracks = [];
        
        for (let i = 0; i < batchUrls.length; i++) {
            const feedUrl = batchUrls[i];
            const feedGuid = [...feedUrlMap.entries()].find(([guid, url]) => url === feedUrl)?.[0];
            
            try {
                console.log(`\n📡 Fetching ${i + 1}/${batchUrls.length}: ${feedUrl}`);
                
                const response = await fetch(feedUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MusicSiteParser/1.0)' },
                    timeout: 10000
                });
                
                if (!response.ok) {
                    console.log(`  ⚠️ HTTP ${response.status} - skipping`);
                    continue;
                }
                
                const xmlText = await response.text();
                console.log(`  📊 Size: ${Math.round(xmlText.length / 1024)}KB`);
                
                // Parse feed
                const tracks = await parseFeedTracks(xmlText, feedUrl, feedGuid);
                allTracks.push(...tracks);
                
                console.log(`  ✅ Added ${tracks.length} tracks`);
                
                // Delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }
        
        // Add tracks to database
        if (allTracks.length > 0) {
            await addTracksToDatabase(allTracks, startIndex, batchSize);
            console.log(`\n✅ Batch complete! Added ${allTracks.length} tracks`);
        }
        
        // Continue with next batch?
        const nextStartIndex = startIndex + batchSize;
        if (nextStartIndex < allFeedUrls.length) {
            console.log(`\n🔄 Next batch: Run 'node scripts/add-itdv-batch.js ${nextStartIndex} ${batchSize}'`);
        } else {
            console.log('\n🎉 All batches complete!');
            
            // Regenerate cache
            console.log('\n🔄 Regenerating optimized cache...');
            const { execSync } = require('child_process');
            try {
                execSync('node scripts/create-optimized-cache.js', { stdio: 'pipe' });
                console.log('✅ Cache regenerated');
            } catch (error) {
                console.log('⚠️ Please regenerate cache manually');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function createFeedMapping() {
    console.log('📡 Fetching ITDV playlist to create feed mapping...');
    
    const playlistUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/ITDV-music-playlist.xml';
    const response = await fetch(playlistUrl);
    const xmlText = await response.text();
    
    const remoteItemMatches = xmlText.match(/<podcast:remoteItem[^>]*\/>/g) || [];
    console.log(`Found ${remoteItemMatches.length} remote items`);
    
    const feedGuids = new Set();
    remoteItemMatches.forEach(item => {
        const feedGuidMatch = item.match(/feedGuid="([^"]+)"/);
        if (feedGuidMatch) {
            feedGuids.add(feedGuidMatch[1]);
        }
    });
    
    console.log(`Found ${feedGuids.size} unique feed GUIDs`);
    console.log('🔍 Resolving GUIDs to URLs...');
    
    const { podcastIndexLookup } = require('./podcast-index-utils');
    const feedUrlMap = {};
    let resolved = 0;
    
    for (const feedGuid of feedGuids) {
        try {
            const feedInfo = await podcastIndexLookup(feedGuid);
            if (feedInfo && feedInfo.url) {
                feedUrlMap[feedGuid] = feedInfo.url;
                resolved++;
                console.log(`✅ ${resolved}/${feedGuids.size}: ${feedGuid.substring(0, 12)}... → ${feedInfo.url}`);
            } else {
                console.log(`❌ ${feedGuid.substring(0, 12)}... → Not found`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
        } catch (error) {
            console.log(`❌ ${feedGuid.substring(0, 12)}... → Error: ${error.message}`);
        }
    }
    
    // Save mapping
    const mappingData = {
        created: new Date().toISOString(),
        totalGuids: feedGuids.size,
        resolvedUrls: resolved,
        feedUrls: feedUrlMap
    };
    
    const mappingPath = path.join(process.cwd(), 'data', 'itdv-feed-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));
    
    console.log(`\n✅ Feed mapping saved: ${resolved} URLs resolved`);
    console.log(`📋 Mapping file: ${mappingPath}`);
    console.log('\n🔄 Now run: node scripts/add-itdv-batch.js 0 10');
}

async function parseFeedTracks(xmlText, feedUrl, feedGuid) {
    // Extract feed metadata
    const albumTitleMatch = xmlText.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const albumImageMatch = xmlText.match(/<itunes:image href="([^"]+)"/);
    const albumAuthorMatch = xmlText.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/);
    
    const albumTitle = cleanText(albumTitleMatch ? albumTitleMatch[1] : 'Unknown Album');
    const albumImage = albumImageMatch ? albumImageMatch[1] : '';
    const albumArtist = cleanText(albumAuthorMatch ? albumAuthorMatch[1] : '');
    
    console.log(`  📀 "${albumTitle}" by ${albumArtist}`);
    
    // Extract tracks
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    console.log(`  📋 ${itemMatches.length} tracks found`);
    
    const tracks = [];
    
    itemMatches.forEach((item, index) => {
        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        const enclosureMatch = item.match(/<enclosure url="([^"]+)"[^>]*\/>/);
        const guidMatch = item.match(/<guid[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>/);
        const durationMatch = item.match(/<itunes:duration>([^<]+)<\/itunes:duration>/);
        const descriptionMatch = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s);
        const imageMatch = item.match(/<itunes:image href="([^"]+)"/);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
        
        if (titleMatch) {
            const track = {
                title: cleanText(titleMatch[1]),
                feedTitle: albumTitle,
                feedArtist: albumArtist,
                feedUrl: feedUrl,
                feedGuid: feedGuid,
                feedImage: albumImage,
                guid: guidMatch ? cleanText(guidMatch[1]) : generateGuid(`${feedGuid}-${index}`),
                enclosureUrl: enclosureMatch ? enclosureMatch[1] : '',
                duration: durationMatch ? parseDuration(durationMatch[1]) : 180,
                description: descriptionMatch ? cleanText(descriptionMatch[1]) : '',
                image: imageMatch ? imageMatch[1] : albumImage,
                datePublished: pubDateMatch ? Math.floor(new Date(pubDateMatch[1]).getTime() / 1000) : Math.floor(Date.now() / 1000),
                explicit: false,
                source: 'ITDV Complete Album'
            };
            
            tracks.push(track);
        }
    });
    
    return tracks;
}

async function addTracksToDatabase(tracks, startIndex, batchSize) {
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    console.log(`\n📊 Current database: ${musicData.musicTracks.length} tracks`);
    
    // Add tracks
    musicData.musicTracks.push(...tracks);
    
    // Update metadata
    musicData.metadata = {
        ...musicData.metadata,
        lastUpdated: new Date().toISOString(),
        [`itdvBatch_${startIndex}`]: {
            date: new Date().toISOString(),
            startIndex,
            batchSize,
            tracksAdded: tracks.length,
            note: `ITDV batch import ${startIndex}-${startIndex + batchSize - 1}`
        }
    };
    
    // Create backup
    const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-itdv-batch-${startIndex}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(JSON.parse(fs.readFileSync(musicDbPath, 'utf8')), null, 2));
    
    // Save
    fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
    
    console.log(`💾 Database updated: ${musicData.musicTracks.length} total tracks`);
    console.log(`📋 Backup: ${path.basename(backupPath)}`);
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
    } else {
        return parseInt(durationString) || 180;
    }
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

// Get command line arguments
const startIndex = parseInt(process.argv[2]) || 0;
const batchSize = parseInt(process.argv[3]) || 10;

addITDVBatch(startIndex, batchSize);