#!/usr/bin/env node

/**
 * Refresh DFB Volume 2 feed to get all tracks
 */

const fs = require('fs');
const path = require('path');

async function refreshDFBVolume2Feed() {
    try {
        console.log('🔄 Refreshing DFB Volume 2 feed...\n');
        
        const feedUrl = 'https://www.doerfelverse.com/feeds/dfbv2.xml';
        console.log(`📡 Fetching: ${feedUrl}`);
        
        // Fetch the RSS feed
        const response = await fetch(feedUrl);
        const xmlText = await response.text();
        
        console.log(`📊 RSS feed size: ${Math.round(xmlText.length / 1024)}KB`);
        
        // Extract feed-level metadata
        const feedTitleMatch = xmlText.match(/<channel>[\s\S]*?<title>(.*?)<\/title>/);
        const feedImageMatch = xmlText.match(/<itunes:image href="(.*?)"/);
        const feedGuidMatch = xmlText.match(/<podcast:guid>(.*?)<\/podcast:guid>/);
        
        const feedTitle = feedTitleMatch ? feedTitleMatch[1] : 'DFB Volume 2';
        const feedImage = feedImageMatch ? feedImageMatch[1] : '';
        const feedGuid = feedGuidMatch ? feedGuidMatch[1] : '';
        
        console.log(`Feed title: ${feedTitle}`);
        console.log(`Feed GUID: ${feedGuid}`);
        
        // Parse XML to extract items
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g);
        
        if (!itemMatches) {
            console.log('❌ No items found in RSS feed');
            return;
        }
        
        console.log(`📊 Found ${itemMatches.length} items in RSS feed\n`);
        
        // Extract track data from each item
        const tracks = [];
        itemMatches.forEach((item, index) => {
            const titleMatch = item.match(/<title>(.*?)<\/title>/);
            const enclosureMatch = item.match(/<enclosure url="(.*?)".*?\/>/);
            const guidMatch = item.match(/<guid.*?>(.*?)<\/guid>/);
            const durationMatch = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
            const descriptionMatch = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s);
            const imageMatch = item.match(/<itunes:image href="(.*?)"/);
            
            if (titleMatch) {
                const track = {
                    title: titleMatch[1],
                    feedTitle: feedTitle,
                    feedArtist: 'Doerfel Family Bluegrass', // Known artist for this feed
                    feedUrl: feedUrl,
                    feedGuid: feedGuid,
                    feedImage: feedImage,
                    guid: guidMatch ? guidMatch[1] : '',
                    enclosureUrl: enclosureMatch ? enclosureMatch[1] : '',
                    duration: durationMatch ? parseDuration(durationMatch[1]) : 180,
                    description: descriptionMatch ? cleanDescription(descriptionMatch[1]) : '',
                    image: imageMatch ? imageMatch[1] : feedImage,
                    datePublished: Math.floor(Date.now() / 1000),
                    explicit: false,
                    source: 'RSS Feed Refresh'
                };
                
                tracks.push(track);
                console.log(`${index + 1}. "${track.title}" (${formatDuration(track.duration)}) [${track.enclosureUrl ? 'Has Audio' : 'No Audio'}]`);
            }
        });
        
        console.log(`\n✅ Extracted ${tracks.length} tracks from RSS feed`);
        
        // Load existing database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        console.log(`📊 Current database has ${musicData.musicTracks.length} tracks`);
        
        // Remove existing DFB Volume 2 tracks
        const originalCount = musicData.musicTracks.length;
        musicData.musicTracks = musicData.musicTracks.filter(track => 
            !(track.feedUrl && track.feedUrl === feedUrl)
        );
        const removedCount = originalCount - musicData.musicTracks.length;
        console.log(`🗑️ Removed ${removedCount} old DFB Volume 2 tracks`);
        
        // Add new tracks
        musicData.musicTracks.push(...tracks);
        console.log(`➕ Added ${tracks.length} new DFB Volume 2 tracks`);
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            dfbVolume2Refresh: {
                date: new Date().toISOString(),
                feedUrl,
                removedTracks: removedCount,
                addedTracks: tracks.length,
                note: 'Refreshed DFB Volume 2 album with current RSS feed data'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-dfbv2-refresh-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated with refreshed DFB Volume 2 tracks`);
        
        console.log(`\n📊 Final database size: ${musicData.musicTracks.length} tracks`);
        
    } catch (error) {
        console.error('❌ Error refreshing DFB Volume 2 feed:', error);
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

function cleanDescription(desc) {
    return desc
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .trim();
}

// Run the refresh
refreshDFBVolume2Feed();