#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function addHghTracksSimple() {
    console.log('🎵 Adding HGH Tracks as Music References\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-hgh-simple-${Date.now()}`;
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Load HGH playlist
    const playlistUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';
    
    try {
        const response = await fetch(playlistUrl);
        const xmlContent = await response.text();
        
        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name) => name === 'podcast:remoteItem'
        });
        
        const parsedXml = parser.parse(xmlContent);
        let remoteItems = parsedXml?.rss?.channel?.['podcast:remoteItem'] || [];
        
        if (!Array.isArray(remoteItems)) {
            remoteItems = [remoteItems];
        }
        
        console.log(`Found ${remoteItems.length} remote items\n`);
        
        // Check existing
        const existingGuids = new Set();
        musicData.musicTracks.forEach(track => {
            if (track.feedGuid && track.itemGuid) {
                const itemGuid = typeof track.itemGuid === 'string' ? track.itemGuid : track.itemGuid?._; 
                existingGuids.add(`${track.feedGuid}:${itemGuid}`);
            }
        });
        
        let addedCount = 0;
        
        // Add each as a simple music track reference
        remoteItems.forEach((item, index) => {
            const feedGuid = item['@_feedGuid'];
            const itemGuid = item['@_itemGuid'];
            
            if (!feedGuid || !itemGuid) return;
            
            const combinedGuid = `${feedGuid}:${itemGuid}`;
            if (existingGuids.has(combinedGuid)) return;
            
            const newTrack = {
                id: `hgh_track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                feedGuid: feedGuid,
                itemGuid: itemGuid,
                title: `HGH Track ${addedCount + 1}`,
                artist: 'Independent Artist',
                album: 'Homegrown Hits Collection',
                artwork: '/stablekraft-rocket.png',
                duration: 5999, // 99:99 placeholder
                audioUrl: null,
                source: 'HGH Playlist - Music Reference',
                needsResolution: true,
                importedDate: new Date().toISOString(),
                originalPlaylist: 'HGH Music Playlist',
                hghReference: true
            };
            
            musicData.musicTracks.push(newTrack);
            existingGuids.add(combinedGuid);
            addedCount++;
        });
        
        // Update metadata
        musicData.metadata.lastHghImport = {
            date: new Date().toISOString(),
            method: 'Simple HGH Track References',
            tracksAdded: addedCount,
            totalItems: remoteItems.length
        };
        
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        console.log(`✅ Added ${addedCount} HGH track references`);
        console.log(`📈 New total: ${musicData.musicTracks.length} tracks`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

addHghTracksSimple();