import fs from 'fs/promises';
import { DOMParser } from '@xmldom/xmldom';

async function createFuckitCompatiblePlaylist() {
    try {
        console.log('🎵 Creating FUCKIT-compatible playlist...');
        
        // Fetch the original RSS feed
        const response = await fetch('https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
        const xmlText = await response.text();
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Find all podcast:remoteItem elements
        const remoteItems = xmlDoc.getElementsByTagName('podcast:remoteItem');
        console.log(`📡 Found ${remoteItems.length} music references`);
        
        // Extract music references
        const musicTracks = [];
        let trackNumber = 1;
        
        for (let i = 0; i < remoteItems.length; i++) {
            const remoteItem = remoteItems[i];
            const feedGuid = remoteItem.getAttribute('feedGuid');
            const itemGuid = remoteItem.getAttribute('itemGuid');
            
            // Skip podroll items
            let currentNode = remoteItem.parentNode;
            while (currentNode && currentNode.tagName !== 'item' && currentNode.tagName !== 'podcast:podroll') {
                currentNode = currentNode.parentNode;
            }
            
            if (currentNode && currentNode.tagName === 'podcast:podroll') {
                continue; // Skip podroll items
            }
            
            musicTracks.push({
                trackNumber: trackNumber++,
                feedGuid,
                itemGuid,
                guid: `${feedGuid}-${itemGuid}`
            });
        }
        
        console.log(`✅ Extracted ${musicTracks.length} music tracks (excluding podroll items)`);
        
        // Generate FUCKIT-compatible RSS feed
        const rssContent = generateFuckitCompatibleRSS(musicTracks);
        
        // Save the file
        const outputPath = 'playlists/doerfel-verse-fuckit-compatible.xml';
        await fs.writeFile(outputPath, rssContent, 'utf8');
        
        console.log(`💾 Saved FUCKIT-compatible playlist to: ${outputPath}`);
        console.log(`📊 Total tracks: ${musicTracks.length}`);
        console.log(`🎯 Format: FUCKIT-compatible with item wrappers`);
        
    } catch (error) {
        console.error('❌ Error creating FUCKIT-compatible playlist:', error);
    }
}

function generateFuckitCompatibleRSS(tracks) {
    const now = new Date().toUTCString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
<author>ChadF</author>
<title>Doerfel-Verse Music Collection</title>
<description>Every music track played on Into The Doerfel-Verse podcast</description>
<link>https://www.doerfelverse.com/</link>
<language>en</language>
<pubDate>${now}</pubDate>
<lastBuildDate>${now}</lastBuildDate>
<image>
<url>https://www.doerfelverse.com/art/itdvchadf.png</url>
</image>
<podcast:guid>576fbe93-879e-4039-8e84-b300936c53bd</podcast:guid>
<podcast:medium>musicL</podcast:medium>
<itunes:image href="https://www.doerfelverse.com/art/itdvchadf.png" />`;

    tracks.forEach(track => {
        xml += `
<item>
<guid>${track.guid}</guid>
<title>Music Track ${track.trackNumber}</title>
<description>Music reference from Doerfel-Verse podcast</description>
<pubDate>${now}</pubDate>
<podcast:remoteItem feedGuid="${track.feedGuid}" itemGuid="${track.itemGuid}"/>
</item>`;
    });

    xml += `
</channel>
</rss>`;

    return xml;
}

// Run the script
createFuckitCompatiblePlaylist(); 