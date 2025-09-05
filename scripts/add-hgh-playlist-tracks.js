#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function addHghPlaylistTracks() {
    console.log('🎵 Adding HGH Music Playlist Remote Items\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-hgh-import-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Fetch the HGH playlist XML
    const playlistUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';
    console.log(`📥 Fetching HGH playlist from: ${playlistUrl}\n`);
    
    try {
        const response = await fetch(playlistUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const xmlContent = await response.text();
        console.log(`📄 Downloaded ${Math.round(xmlContent.length / 1024)}KB of XML data\n`);
        
        // Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
        });
        
        const parsedXml = parser.parse(xmlContent);
        
        // Navigate to remote items
        const remoteItems = parsedXml?.rss?.channel?.item || [];
        console.log(`🔍 Found ${remoteItems.length} items in HGH playlist\n`);
        
        if (!Array.isArray(remoteItems)) {
            console.log('⚠️  Expected array of remote items, but got single item or unexpected structure');
            return;
        }
        
        // Extract remote item references
        let addedCount = 0;
        let skippedCount = 0;
        let duplicateCount = 0;
        
        const existingGuids = new Set();
        musicData.musicTracks.forEach(track => {
            if (track.feedGuid && track.itemGuid) {
                const combinedGuid = `${track.feedGuid}:${typeof track.itemGuid === 'string' ? track.itemGuid : track.itemGuid?._}`;
                existingGuids.add(combinedGuid);
            }
        });
        
        console.log(`📊 Existing tracks in database: ${musicData.musicTracks.length}`);
        console.log(`📊 Unique existing GUIDs: ${existingGuids.size}\n`);
        
        for (const [index, item] of remoteItems.entries()) {
            // Look for podcast:remoteItem in the item
            let remoteItemRef = null;
            
            // Check various possible locations for remoteItem
            if (item['podcast:remoteItem']) {
                remoteItemRef = item['podcast:remoteItem'];
            } else if (item.remoteItem) {
                remoteItemRef = item.remoteItem;
            } else {
                // Look in the item description or other fields for remoteItem data
                console.log(`   ⚠️  No remoteItem found in item ${index + 1}, skipping`);
                skippedCount++;
                continue;
            }
            
            // Handle array of remoteItems or single remoteItem
            const remoteItems = Array.isArray(remoteItemRef) ? remoteItemRef : [remoteItemRef];
            
            for (const remoteItem of remoteItems) {
                const feedGuid = remoteItem['@_feedGuid'];
                const itemGuid = remoteItem['@_itemGuid'];
                
                if (!feedGuid || !itemGuid) {
                    console.log(`   ⚠️  Missing feedGuid or itemGuid in remote item, skipping`);
                    skippedCount++;
                    continue;
                }
                
                // Check for duplicates
                const combinedGuid = `${feedGuid}:${itemGuid}`;
                if (existingGuids.has(combinedGuid)) {
                    console.log(`   🔄 Duplicate: ${feedGuid}:${itemGuid.substring(0, 8)}... (skipping)`);
                    duplicateCount++;
                    continue;
                }
                
                // Add new track
                const newTrack = {
                    id: `hgh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    feedGuid: feedGuid,
                    itemGuid: itemGuid,
                    title: `Track ${addedCount + 1}`,
                    artist: 'Unknown Artist',
                    album: 'HGH Playlist Import',
                    artwork: '/stablekraft-rocket.png', // Use main page background
                    duration: 5999, // 99:99 placeholder
                    source: 'HGH Playlist Import',
                    needsResolution: true,
                    durationSource: {
                        method: 'placeholder-duration',
                        reason: 'recognizable placeholder (99:99)',
                        assignedDate: new Date().toISOString()
                    },
                    artworkSource: {
                        method: 'main-page-background',
                        reason: 'using site\'s main background image as placeholder',
                        assignedDate: new Date().toISOString()
                    },
                    importedDate: new Date().toISOString(),
                    originalPlaylist: 'HGH Music Playlist'
                };
                
                musicData.musicTracks.push(newTrack);
                existingGuids.add(combinedGuid);
                addedCount++;
                
                console.log(`✅ Added: ${feedGuid.substring(0, 8)}...${feedGuid.substring(-8)} : ${itemGuid.substring(0, 8)}...`);
            }
        }
        
        // Update metadata
        musicData.metadata.lastHghImport = {
            date: new Date().toISOString(),
            sourceUrl: playlistUrl,
            itemsProcessed: remoteItems.length,
            tracksAdded: addedCount,
            duplicatesSkipped: duplicateCount,
            itemsSkipped: skippedCount,
            method: 'HGH Playlist Remote Items Import'
        };
        
        musicData.metadata.lastUpdated = new Date().toISOString();
        
        // Save updated data
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        console.log('\n' + '=' .repeat(60));
        console.log('📊 HGH Import Summary:');
        console.log(`  📥 Items in playlist: ${remoteItems.length}`);
        console.log(`  ✅ Tracks added: ${addedCount}`);
        console.log(`  🔄 Duplicates skipped: ${duplicateCount}`);
        console.log(`  ⚠️  Items skipped: ${skippedCount}`);
        console.log(`  📈 New total tracks: ${musicData.musicTracks.length}`);
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Run comprehensive-music-discovery.js to resolve metadata');
        console.log('2. Use remove-placeholder-tracks.js to clean up unresolved items');
        console.log('3. All new tracks have 99:99 duration and main page artwork placeholders');
        
        console.log('\n✨ HGH playlist import complete!');
        
    } catch (error) {
        console.error('❌ Error importing HGH playlist:', error.message);
        process.exit(1);
    }
}

// Run the import
addHghPlaylistTracks();