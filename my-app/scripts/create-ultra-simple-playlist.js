import fs from 'fs/promises';
import { DOMParser } from '@xmldom/xmldom';

async function createUltraSimplePlaylist() {
    try {
        console.log('🎵 Creating ultra-simple music playlist...');
        
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
        
        // Generate ultra-simple RSS feed
        const rssContent = generateUltraSimpleRSS(musicTracks);
        
        // Save the file
        const outputPath = 'playlists/doerfel-verse-ultra-simple-playlist.xml';
        await fs.writeFile(outputPath, rssContent, 'utf8');
        
        console.log(`💾 Saved ultra-simple playlist to: ${outputPath}`);
        console.log(`📊 Total tracks: ${musicTracks.length}`);
        console.log(`🎯 Format: Ultra-simple musicL RSS (no episode info)`);
        
    } catch (error) {
        console.error('❌ Error creating ultra-simple playlist:', error);
    }
}

function generateUltraSimpleRSS(tracks) {
    const now = new Date().toUTCString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>Doerfel-Verse Music Collection</title>
    <description>Music references from Into The Doerfel-Verse podcast</description>
    <link>https://www.doerfelverse.com/</link>
    <language>en</language>
    <pubDate>${now}</pubDate>
    <podcast:medium>musicL</podcast:medium>
    <image>
      <url>https://www.doerfelverse.com/art/itdvchadf.png</url>
      <title>Doerfel-Verse Music</title>
      <link>https://www.doerfelverse.com/</link>
    </image>`;

    tracks.forEach(track => {
        xml += `
    <item>
      <description>Music reference from Doerfel-Verse podcast collection</description>
      <link>https://www.doerfelverse.com/</link>
      <guid isPermaLink="false">${track.guid}</guid>
      <podcast:remoteItem feedGuid="${track.feedGuid}" itemGuid="${track.itemGuid}"/>
    </item>`;
    });

    xml += `
  </channel>
</rss>`;

    return xml;
}

// Run the script
createUltraSimplePlaylist(); 