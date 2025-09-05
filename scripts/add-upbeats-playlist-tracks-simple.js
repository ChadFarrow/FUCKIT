#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function fetchUpBeatsPlaylist() {
    console.log('🎵 Fetching UpBEATs Music Playlist from GitHub...\n');
    
    const feedUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/upbeats-music-playlist.xml';
    
    try {
        const response = await fetch(feedUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch feed: ${response.status}`);
        }
        
        const xmlData = await response.text();
        console.log(`✅ Fetched XML feed (${xmlData.length} bytes)\n`);
        
        return xmlData;
    } catch (error) {
        console.error('❌ Error fetching feed:', error.message);
        throw error;
    }
}

function parseRemoteItems(xmlData) {
    console.log('📋 Parsing remote items from XML...\n');
    
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text'
    });
    
    try {
        const result = parser.parse(xmlData);
        const channel = result?.rss?.channel || {};
        
        // The remote items are directly in the channel, not as individual items
        const remoteItemsRaw = channel['podcast:remoteItem'];
        const remoteItemsList = Array.isArray(remoteItemsRaw) ? remoteItemsRaw : [remoteItemsRaw].filter(Boolean);
        
        console.log(`Found ${remoteItemsList.length} remote items in the feed\n`);
        
        const remoteItems = [];
        
        remoteItemsList.forEach((remoteItem, index) => {
            if (remoteItem) {
                const processedItem = {
                    // Remote item specific fields
                    feedGuid: remoteItem['@_feedGuid'],
                    itemGuid: remoteItem['@_itemGuid'],
                    
                    // Standard item fields (will be resolved from Podcast Index later)
                    title: `Track ${index + 1}`, // Placeholder, will be resolved
                    description: '',
                    pubDate: channel.pubDate || new Date().toISOString(),
                    
                    // Source info
                    source: 'UpBEATs Music Playlist',
                    addedFrom: 'GitHub - ChadFarrow/chadf-musicl-playlists',
                    playlistTitle: channel.title || 'UpBEATs Playlist'
                };
                
                remoteItems.push(processedItem);
                console.log(`  ${index + 1}. Remote Item`);
                console.log(`     Feed GUID: ${processedItem.feedGuid}`);
                console.log(`     Item GUID: ${processedItem.itemGuid}\n`);
            }
        });
        
        return remoteItems;
    } catch (error) {
        console.error('❌ Error parsing XML:', error.message);
        throw error;
    }
}

async function addToMusicTracks(remoteItems) {
    console.log('💾 Adding remote items to music-tracks.json...\n');
    
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-${Date.now()}`;
    console.log(`Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Load existing music tracks
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Get existing remote items to avoid duplicates
    const existingRemoteItems = new Set();
    musicData.musicTracks.forEach(track => {
        if (track.feedGuid && track.itemGuid) {
            existingRemoteItems.add(`${track.feedGuid}:${track.itemGuid}`);
        }
    });
    
    console.log(`Current database has ${musicData.musicTracks.length} tracks\n`);
    
    // Add new remote items
    let addedCount = 0;
    let skippedCount = 0;
    
    remoteItems.forEach(item => {
        const itemKey = `${item.feedGuid}:${item.itemGuid}`;
        
        if (existingRemoteItems.has(itemKey)) {
            console.log(`  ⏭️  Skipping duplicate: ${item.title}`);
            skippedCount++;
        } else {
            // Create a new track entry
            const newTrack = {
                id: `remote-${item.feedGuid}-${item.itemGuid}`.substring(0, 50), // Ensure reasonable ID length
                title: item.title,
                artist: 'Unknown Artist', // Will be resolved later
                album: 'Unknown Album', // Will be resolved later
                artwork: '/api/placeholder/300/300',
                audioUrl: item.enclosure?.url || '',
                duration: 0, // Will be resolved later
                feedGuid: item.feedGuid,
                itemGuid: item.itemGuid,
                publisherFeed: item.source,
                addedDate: new Date().toISOString(),
                pubDate: item.pubDate,
                description: item.description,
                source: 'UpBEATs Playlist Import',
                needsResolution: true // Flag for later resolution
            };
            
            musicData.musicTracks.push(newTrack);
            console.log(`  ✅ Added: ${item.title}`);
            addedCount++;
        }
    });
    
    // Update metadata
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.lastUpdated = new Date().toISOString();
    musicData.metadata.totalTracks = musicData.musicTracks.length;
    musicData.metadata.lastImport = {
        source: 'UpBEATs Music Playlist',
        date: new Date().toISOString(),
        added: addedCount,
        skipped: skippedCount
    };
    
    // Save updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log(`\n📊 Import Summary:`);
    console.log(`  - Added: ${addedCount} new tracks`);
    console.log(`  - Skipped: ${skippedCount} duplicates`);
    console.log(`  - Total tracks: ${musicData.musicTracks.length}`);
    
    return { added: addedCount, skipped: skippedCount, total: musicData.musicTracks.length };
}

async function main() {
    try {
        console.log('🚀 Starting UpBEATs Music Playlist Import\n');
        console.log('=' .repeat(50) + '\n');
        
        // Fetch the XML feed
        const xmlData = await fetchUpBeatsPlaylist();
        
        // Parse remote items
        const remoteItems = parseRemoteItems(xmlData);
        
        if (remoteItems.length === 0) {
            console.log('⚠️  No remote items found in the feed');
            return;
        }
        
        console.log(`\n📦 Found ${remoteItems.length} remote items to process\n`);
        console.log('=' .repeat(50) + '\n');
        
        // Add to music tracks
        const result = await addToMusicTracks(remoteItems);
        
        console.log('\n' + '=' .repeat(50));
        console.log('✨ Import completed successfully!\n');
        
        if (result.added > 0) {
            console.log('💡 Next steps:');
            console.log('  1. Run resolution script to fetch full metadata:');
            console.log('     node scripts/resolve-remote-items.js\n');
            console.log('  2. Or resolve with Podcast Index API:');
            console.log('     node scripts/add-missing-remote-items-pi-api.js\n');
        }
        
    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
        process.exit(1);
    }
}

// Run the import
main();