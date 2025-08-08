#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';

const RSS_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';

async function createLightningStylePlaylist() {
  try {
    console.log('🎵 Creating Lightning-style music playlist from Doerfel-Verse...\n');
    
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
    const originalDescription = channel.getElementsByTagName('description')[0]?.textContent || '';
    const originalLink = channel.getElementsByTagName('link')[0]?.textContent || 'https://www.doerfelverse.com/';
    const originalImage = channel.getElementsByTagName('image')[0];
    const originalLanguage = channel.getElementsByTagName('language')[0]?.textContent || 'en';
    
    // Find all podcast:remoteItem elements
    const remoteItems = xmlDoc.getElementsByTagName('podcast:remoteItem');
    console.log(`Found ${remoteItems.length} remote items to process...`);
    
    // Extract all remote items with their parent episode context
    const musicTracks = [];
    let trackNumber = 1;
    
    for (let i = 0; i < remoteItems.length; i++) {
      const remoteItem = remoteItems[i];
      const feedGuid = remoteItem.getAttribute('feedGuid');
      const itemGuid = remoteItem.getAttribute('itemGuid');
      const feedUrl = remoteItem.getAttribute('feedUrl');
      
      // Get parent episode context by traversing up the DOM tree
      let episodeTitle = 'Unknown Episode';
      let episodePubDate = new Date().toUTCString();
      let episodeLink = originalLink;
      let isPodrollItem = false;
      
      // Check if this is a podroll item (feed-level recommendation) - skip these
      let currentNode = remoteItem.parentNode;
      while (currentNode && currentNode.tagName !== 'item' && currentNode.tagName !== 'podcast:podroll') {
        currentNode = currentNode.parentNode;
      }
      
      if (currentNode && currentNode.tagName === 'podcast:podroll') {
        // Skip podroll items - they're not episode-specific music references
        continue;
      } else if (currentNode && currentNode.tagName === 'item') {
        // This is an episode-specific item
        const titleElement = currentNode.getElementsByTagName('title')[0];
        const pubDateElement = currentNode.getElementsByTagName('pubDate')[0];
        const linkElement = currentNode.getElementsByTagName('link')[0];
        
        if (titleElement) episodeTitle = titleElement.textContent;
        if (pubDateElement) episodePubDate = pubDateElement.textContent;
        if (linkElement) episodeLink = linkElement.textContent;
      }
      
      // Create music track entry
      const trackData = {
        trackNumber: trackNumber++,
        feedGuid: feedGuid,
        itemGuid: itemGuid,
        feedUrl: feedUrl,
        episodeTitle: episodeTitle,
        episodePubDate: episodePubDate,
        episodeLink: episodeLink,
        type: itemGuid ? 'specific_episode' : 'feed_reference',
        isPodrollItem: isPodrollItem
      };
      
      musicTracks.push(trackData);
    }
    
    console.log(`Processed ${musicTracks.length} music tracks`);
    
    // Generate Lightning-style RSS feed
    const rssContent = generateLightningStyleRSS(
      originalTitle,
      originalDescription,
      originalLink,
      originalImage,
      originalLanguage,
      musicTracks
    );
    
    // Create playlists directory if it doesn't exist
    const playlistsDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(playlistsDir, { recursive: true });
    
    // Save RSS feed
    const rssPath = path.join(playlistsDir, 'doerfel-verse-lightning-style-playlist.xml');
    await fs.writeFile(rssPath, rssContent, 'utf8');
    
    console.log(`✅ Lightning-style playlist created: ${rssPath}`);
    console.log(`📊 Total tracks: ${musicTracks.length}`);
    
  } catch (error) {
    console.error('❌ Error creating Lightning-style playlist:', error);
  }
}

function generateLightningStyleRSS(title, description, link, image, language, musicTracks) {
  const now = new Date().toUTCString();
  const imageUrl = image?.getElementsByTagName('url')[0]?.textContent || '';
  const imageTitle = image?.getElementsByTagName('title')[0]?.textContent || title;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${escapeXML(title)} Music Playlist</title>
    <description>Every song played on ${escapeXML(title)} from episodes with music references</description>
    <link>${escapeXML(link)}</link>
    <language>${language}</language>
    <pubDate>${now}</pubDate>
    <lastBuildDate>${now}</lastBuildDate>
    <itunes:author>${escapeXML(title)}</itunes:author>
    <itunes:category text="Music"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>${generateGuid()}</podcast:guid>`;

  if (imageUrl) {
    xml += `
    <image>
      <url>${escapeXML(imageUrl)}</url>
      <title>${escapeXML(imageTitle)}</title>
      <link>${escapeXML(link)}</link>
    </image>`;
  }

  xml += `
    <itunes:image href="${escapeXML(imageUrl)}"/>`;

  // Add each music track as an episode
  musicTracks.forEach((track, index) => {
    const trackTitle = `Track ${track.trackNumber}: Music Reference (Episode: ${track.episodeTitle})`;
    const trackDescription = `Music track referenced in episode "${track.episodeTitle}". Feed GUID: ${track.feedGuid}, Item GUID: ${track.itemGuid}`;
    
    xml += `
    <item>
      <title>${escapeXML(trackTitle)}</title>
      <description>${escapeXML(trackDescription)}</description>
      <link>${escapeXML(track.episodeLink)}</link>
      <guid isPermaLink="false">${track.feedGuid}-${track.itemGuid || 'feed'}-${track.trackNumber}</guid>
      <pubDate>${track.episodePubDate}</pubDate>
      <itunes:duration>00:00:00</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <podcast:remoteItem feedGuid="${escapeXML(track.feedGuid)}"${track.itemGuid ? ` itemGuid="${escapeXML(track.itemGuid)}"` : ''}${track.feedUrl ? ` feedUrl="${escapeXML(track.feedUrl)}"` : ''}/>
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

function generateGuid() {
  return 'doerfel-verse-music-playlist-' + Date.now();
}

createLightningStylePlaylist(); 