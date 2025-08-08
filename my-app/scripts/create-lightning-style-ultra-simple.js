import fs from 'fs/promises';
import { DOMParser } from '@xmldom/xmldom';

async function createLightningStyleUltraSimple() {
    try {
        console.log('🎵 Creating Lightning-style ultra-simple music playlist...');
        
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
        
        // Generate Lightning-style RSS feed
        const rssContent = generateLightningStyleRSS(musicTracks);
        
        // Save the file
        const outputPath = 'playlists/doerfel-verse-lightning-style-ultra-simple.xml';
        await fs.writeFile(outputPath, rssContent, 'utf8');
        
        console.log(`💾 Saved Lightning-style ultra-simple playlist to: ${outputPath}`);
        console.log(`📊 Total tracks: ${musicTracks.length}`);
        console.log(`🎯 Format: Lightning-style ultra-simple musicL RSS`);
        
    } catch (error) {
        console.error('❌ Error creating Lightning-style ultra-simple playlist:', error);
    }
}

function generateLightningStyleRSS(tracks) {
    const now = new Date().toUTCString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>Doerfel-Verse Music Collection</title>
    <description>Every music reference from Into The Doerfel-Verse podcast</description>
    <link>https://www.doerfelverse.com/</link>
    <language>en</language>
    <pubDate>${now}</pubDate>
    <lastBuildDate>${now}</lastBuildDate>
    <image>
      <url>https://www.doerfelverse.com/art/itdvchadf.png</url>
      <title>Doerfel-Verse Music Collection</title>
      <link>https://www.doerfelverse.com/</link>
    </image>
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>doerfel-verse-music-collection</podcast:guid>`;

    tracks.forEach(track => {
        xml += `
    <item>
      <title>Track ${track.trackNumber}</title>
      <description>Music reference from Doerfel-Verse podcast collection</description>
      <link>https://www.doerfelverse.com/</link>
      <guid isPermaLink="false">${track.guid}</guid>
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
createLightningStyleUltraSimple(); 