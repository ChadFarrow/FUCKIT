#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';

const RSS_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';

async function createSimpleMusicPlaylist() {
  try {
    console.log('🎵 Creating simplified music playlist from Doerfel-Verse...\n');
    
    // Fetch and parse RSS feed
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Get original feed metadata
    const channel = xmlDoc.getElementsByTagName('channel')[0];
    const originalTitle = channel.getElementsByTagName('title')[0]?.textContent || 'Into The Doerfel-Verse';
    const originalLink = channel.getElementsByTagName('link')[0]?.textContent || 'https://www.doerfelverse.com/';
    const originalImage = channel.getElementsByTagName('image')[0];
    
    // Find all podcast:remoteItem elements
    const remoteItems = xmlDoc.getElementsByTagName('podcast:remoteItem');
    console.log(`Found ${remoteItems.length} remote items to process...`);
    
    // Extract episode-specific music references only
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
      
      if (currentNode && currentNode.tagName === 'item' && itemGuid) {
        // This is an episode-specific music reference
        const titleElement = currentNode.getElementsByTagName('title')[0];
        const episodeTitle = titleElement ? titleElement.textContent : 'Unknown Episode';
        
        const trackData = {
          trackNumber: trackNumber++,
          feedGuid: feedGuid,
          itemGuid: itemGuid,
          episodeTitle: episodeTitle
        };
        
        musicTracks.push(trackData);
      }
    }
    
    console.log(`Processed ${musicTracks.length} music tracks`);
    
    // Generate simplified RSS feed
    const rssContent = generateSimpleMusicRSS(
      originalTitle,
      originalLink,
      originalImage,
      musicTracks
    );
    
    // Create playlists directory if it doesn't exist
    const playlistsDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(playlistsDir, { recursive: true });
    
    // Save RSS feed
    const rssPath = path.join(playlistsDir, 'doerfel-verse-simple-music-playlist.xml');
    await fs.writeFile(rssPath, rssContent, 'utf8');
    
    console.log(`✅ Simple music playlist created: ${rssPath}`);
    console.log(`📊 Total tracks: ${musicTracks.length}`);
    
  } catch (error) {
    console.error('❌ Error creating simple music playlist:', error);
  }
}

function generateSimpleMusicRSS(title, link, image, musicTracks) {
  const now = new Date().toUTCString();
  const imageUrl = image?.getElementsByTagName('url')[0]?.textContent || '';
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${escapeXML(title)} Music</title>
    <description>Music from ${escapeXML(title)}</description>
    <link>${escapeXML(link)}</link>
    <language>en</language>
    <pubDate>${now}</pubDate>
    <podcast:medium>musicL</podcast:medium>`;

  if (imageUrl) {
    xml += `
    <image>
      <url>${escapeXML(imageUrl)}</url>
      <title>${escapeXML(title)}</title>
      <link>${escapeXML(link)}</link>
    </image>`;
  }

  // Add each music track as a simple item
  musicTracks.forEach((track) => {
    xml += `
    <item>
      <title>${escapeXML(track.episodeTitle)}</title>
      <description>Music from ${escapeXML(track.episodeTitle)}</description>
      <link>${escapeXML(link)}</link>
      <guid isPermaLink="false">${track.feedGuid}-${track.itemGuid}</guid>
      <podcast:remoteItem feedGuid="${escapeXML(track.feedGuid)}" itemGuid="${escapeXML(track.itemGuid)}"/>
    </item>`;
  });

  xml += `
  </channel>
</rss>`;

  return xml;
}

function escapeXML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

createSimpleMusicPlaylist(); 