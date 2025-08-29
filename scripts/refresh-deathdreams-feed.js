#!/usr/bin/env node

/**
 * Re-parse the deathdreams RSS feed and update the database
 */

const fs = require('fs');
const path = require('path');

async function refreshDeathDreamsFeed() {
    try {
        console.log('🔄 Refreshing deathdreams feed...\n');
        
        const feedUrl = 'https://static.staticsave.com/mspfiles/deathdreams.xml';
        console.log(`📡 Fetching: ${feedUrl}`);
        
        // Fetch the RSS feed
        const response = await fetch(feedUrl);
        const xmlText = await response.text();
        
        console.log(`📊 RSS feed size: ${Math.round(xmlText.length / 1024)}KB`);
        
        // Parse XML to extract items - simple extraction for now
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g);
        
        if (!itemMatches) {
            console.log('❌ No items found in RSS feed');
            return;
        }
        
        console.log(`📊 Found ${itemMatches.length} items in RSS feed`);
        
        // Extract track data from each item
        const tracks = [];
        itemMatches.forEach((item, index) => {
            const titleMatch = item.match(/<title>(.*?)<\/title>/);
            const enclosureMatch = item.match(/<enclosure url="(.*?)".*?\/>/);
            const guidMatch = item.match(/<guid.*?>(.*?)<\/guid>/);
            const durationMatch = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
            const descriptionMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
            
            if (titleMatch) {
                const track = {
                    title: titleMatch[1],
                    feedTitle: 'deathdreams',
                    feedArtist: 'deathdreams',
                    feedUrl: feedUrl,
                    feedGuid: '75f0b434-19dc-5959-9920-0fb5304be61b', // From RSS
                    guid: guidMatch ? guidMatch[1] : '',
                    enclosureUrl: enclosureMatch ? enclosureMatch[1] : '',
                    duration: durationMatch ? parseDuration(durationMatch[1]) : 180,
                    description: descriptionMatch ? descriptionMatch[1] : '',
                    image: 'https://static.wixstatic.com/media/484406_9138bd56c7b64a388da3b927a5bb2220~mv2.png',
                    datePublished: Math.floor(Date.now() / 1000),
                    explicit: false,
                    source: 'RSS Feed Refresh'
                };
                
                tracks.push(track);
                console.log(`${index + 1}. "${track.title}" (${formatDuration(track.duration)}) [${track.enclosureUrl ? 'Has Audio' : 'No Audio'}]`);
            }
        });
        
        console.log(`\\n✅ Extracted ${tracks.length} tracks from RSS feed`);
        
        // Load existing database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log(`📊 Current database has ${musicData.musicTracks.length} tracks`);
        
        // Remove existing deathdreams tracks
        const originalCount = musicData.musicTracks.length;
        musicData.musicTracks = musicData.musicTracks.filter(track => 
            !(track.feedTitle && track.feedTitle.toLowerCase() === 'deathdreams')
        );
        const removedCount = originalCount - musicData.musicTracks.length;
        console.log(`🗑️ Removed ${removedCount} old deathdreams tracks`);
        
        // Add new tracks
        musicData.musicTracks.push(...tracks);
        console.log(`➕ Added ${tracks.length} new deathdreams tracks`);
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            deathDreamsRefresh: {
                date: new Date().toISOString(),
                feedUrl,
                removedTracks: removedCount,
                addedTracks: tracks.length,
                note: 'Refreshed deathdreams album with current RSS feed data'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-deathdreams-refresh-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated with refreshed deathdreams tracks`);
        
        console.log(`\\n📊 Final database size: ${musicData.musicTracks.length} tracks`);
        
    } catch (error) {
        console.error('❌ Error refreshing deathdreams feed:', error);
    }
}

function parseDuration(durationString) {
    // Parse HH:MM:SS or MM:SS format
    const parts = durationString.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        return 180; // Default fallback
    }
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Run the refresh
refreshDeathDreamsFeed();