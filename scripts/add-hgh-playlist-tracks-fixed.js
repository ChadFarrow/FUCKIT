#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function addHghPlaylistTracks() {
    console.log('🎵 Adding HGH Music Playlist Remote Items (Fixed)\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-hgh-import-fixed-${Date.now()}`;
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
        
        // Parse XML with namespace support
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name) => name === 'podcast:remoteItem'
        });
        
        const parsedXml = parser.parse(xmlContent);
        
        // Navigate to remote items - they're directly in the channel
        const channel = parsedXml?.rss?.channel;
        if (!channel) {
            console.log('❌ Could not find RSS channel in XML');
            return;
        }
        
        // Look for podcast:remoteItem elements
        let remoteItems = channel['podcast:remoteItem'] || [];
        
        // Ensure it's an array
        if (!Array.isArray(remoteItems)) {
            remoteItems = [remoteItems];
        }
        
        console.log(`🔍 Found ${remoteItems.length} remote items in HGH playlist\n`);
        
        if (remoteItems.length === 0) {
            console.log('⚠️  No remote items found. Checking XML structure...');
            console.log('Available keys in channel:', Object.keys(channel));
            return;
        }
        
        // Check for existing tracks to avoid duplicates
        let addedCount = 0;
        let duplicateCount = 0;
        let alreadyResolvedCount = 0;
        
        const existingGuids = new Set();
        const existingResolvedGuids = new Set();
        
        musicData.musicTracks.forEach(track => {
            if (track.feedGuid && track.itemGuid) {
                const itemGuid = typeof track.itemGuid === 'string' ? track.itemGuid : track.itemGuid?._; 
                const combinedGuid = `${track.feedGuid}:${itemGuid}`;
                existingGuids.add(combinedGuid);
                
                // Track resolved items (those that don't need resolution)
                if (!track.needsResolution && track.title && !track.title.startsWith('Track ')) {
                    existingResolvedGuids.add(combinedGuid);
                }
            }
        });
        
        console.log(`📊 Existing tracks in database: ${musicData.musicTracks.length}`);
        console.log(`📊 Unique existing GUIDs: ${existingGuids.size}`);
        console.log(`📊 Already resolved tracks: ${existingResolvedGuids.size}\n`);
        
        // Process each remote item
        for (const [index, remoteItem] of remoteItems.entries()) {
            const feedGuid = remoteItem['@_feedGuid'];
            const itemGuid = remoteItem['@_itemGuid'];
            
            if (!feedGuid || !itemGuid) {
                console.log(`   ⚠️  Item ${index + 1}: Missing feedGuid or itemGuid, skipping`);
                continue;
            }
            
            // Check for duplicates
            const combinedGuid = `${feedGuid}:${itemGuid}`;
            if (existingGuids.has(combinedGuid)) {
                if (existingResolvedGuids.has(combinedGuid)) {
                    console.log(`   ✅ Item ${index + 1}: Already resolved: ${feedGuid.substring(0, 8)}...`);
                    alreadyResolvedCount++;
                } else {
                    console.log(`   🔄 Item ${index + 1}: Already exists (unresolved): ${feedGuid.substring(0, 8)}...`);
                    duplicateCount++;
                }
                continue;
            }
            
            // Add new track with our modern placeholder system
            const newTrack = {
                id: `hgh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                feedGuid: feedGuid,
                itemGuid: itemGuid,
                title: `HGH Track ${addedCount + 1}`,
                artist: 'Unknown Artist', 
                album: 'Homegrown Hits Playlist',
                artwork: '/stablekraft-rocket.png', // Main page background
                duration: 5999, // 99:99 placeholder
                audioUrl: null,
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
            
            if (addedCount <= 10 || addedCount % 50 === 0) {
                console.log(`   ➕ Added ${addedCount}: ${feedGuid.substring(0, 8)}...${feedGuid.substring(-8)} : ${itemGuid.substring(0, 8)}...${itemGuid.substring(-8)}`);
            }
        }
        
        // Update metadata
        musicData.metadata.lastHghImport = {
            date: new Date().toISOString(),
            sourceUrl: playlistUrl,
            totalRemoteItems: remoteItems.length,
            tracksAdded: addedCount,
            duplicatesSkipped: duplicateCount,
            alreadyResolved: alreadyResolvedCount,
            method: 'HGH Playlist Remote Items Import (Fixed)'
        };
        
        musicData.metadata.lastUpdated = new Date().toISOString();
        
        // Save updated data
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        console.log('\n' + '=' .repeat(60));
        console.log('📊 HGH Import Summary:');
        console.log(`  🎵 Remote items in playlist: ${remoteItems.length}`);
        console.log(`  ➕ New tracks added: ${addedCount}`);
        console.log(`  🔄 Already existed (unresolved): ${duplicateCount}`);
        console.log(`  ✅ Already resolved: ${alreadyResolvedCount}`);
        console.log(`  📈 New database total: ${musicData.musicTracks.length}`);
        
        const newPercentage = ((addedCount / remoteItems.length) * 100).toFixed(1);
        const existingPercentage = (((duplicateCount + alreadyResolvedCount) / remoteItems.length) * 100).toFixed(1);
        
        console.log(`\n  📈 Coverage: ${newPercentage}% new, ${existingPercentage}% already in database`);
        
        if (addedCount > 0) {
            console.log('\n🎯 Next Steps:');
            console.log('1. Run comprehensive-music-discovery.js to resolve new track metadata');
            console.log('2. All new tracks have 99:99 duration and main page artwork placeholders');
            console.log('3. Use remove-placeholder-tracks.js later to clean unresolved items');
        }
        
        console.log('\n✨ HGH playlist import complete!');
        
    } catch (error) {
        console.error('❌ Error importing HGH playlist:', error.message);
        process.exit(1);
    }
}

// Run the import
addHghPlaylistTracks();