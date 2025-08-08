#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const RSS_FEED_URL = 'https://feed.homegrownhits.xyz/feed.xml';

async function createHomegrownHitsMinimalPlaylist() {
  try {
    console.log('🎵 Creating minimal Homegrown Hits music playlist...\n');
    
    // Fetch and parse RSS feed
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Validate parsing
    const parseErrors = xmlDoc.getElementsByTagName('parsererror');
    if (parseErrors.length > 0) {
      throw new Error('XML parsing failed');
    }
    
    // Get channel information
    const channel = xmlDoc.getElementsByTagName('channel')[0];
    if (!channel) {
      throw new Error('No <channel> element found');
    }
    
    const channelTitle = channel.getElementsByTagName('title')[0]?.textContent || 'Homegrown Hits';
    const channelDescription = channel.getElementsByTagName('description')[0]?.textContent || 'Music playlist RSS feed created from Homegrown Hits podcast';
    const channelLink = channel.getElementsByTagName('link')[0]?.textContent || 'https://homegrownhits.xyz';
    const channelLanguage = channel.getElementsByTagName('language')[0]?.textContent || 'en';
    const channelImage = channel.getElementsByTagName('image')[0];
    const imageUrl = channelImage?.getElementsByTagName('url')[0]?.textContent || 'https://bowlafterbowl.com/wp-content/uploads/2023/09/HomegrownHitsArt.png';
    const imageTitle = channelImage?.getElementsByTagName('title')[0]?.textContent || 'Homegrown Hits';
    
    // Find all episodes
    const episodes = xmlDoc.getElementsByTagName('item');
    console.log(`📊 Found ${episodes.length} episodes to process\n`);
    
    // Extract all tracks from all episodes
    const musicTracks = [];
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const description = episode.getElementsByTagName('description')[0]?.textContent || '';
      
      // Extract tracks from description
      const tracks = extractTracksFromDescription(description);
      
      // Add tracks to the collection
      tracks.forEach(track => {
        if (track.feedGuid && track.itemGuid) {
          musicTracks.push({
            feedGuid: track.feedGuid,
            itemGuid: track.itemGuid
          });
        }
      });
    }
    
    console.log(`✅ Extracted ${musicTracks.length} music tracks`);
    
    // Generate minimal RSS feed in ITDV format
    const rssContent = generateMinimalRSS(musicTracks, {
      title: 'Homegrown Hits music playlist',
      description: 'Every music reference from Homegrown Hits podcast',
      link: channelLink,
      language: channelLanguage,
      imageUrl: imageUrl,
      imageTitle: imageTitle
    });
    
    // Save the playlist
    const outputDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'homegrown-hits-minimal-playlist.xml');
    await fs.writeFile(outputPath, rssContent);
    
    console.log(`✅ Successfully created Homegrown Hits minimal playlist!`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🎵 Total tracks: ${musicTracks.length}\n`);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error creating playlist:', error.message);
    throw error;
  }
}

function extractTracksFromDescription(description) {
  const tracks = [];
  
  // First, try to extract tracks from anchor tags (which is the main format in this feed)
  const anchorPattern = /<a[^>]*href=['"]([^'"]*)['"][^>]*>([^<]+)<\/a>/gi;
  const anchorMatches = [...description.matchAll(anchorPattern)];
  
  for (const match of anchorMatches) {
    const href = match[1].trim();
    const trackText = match[2].trim();
    
    if (trackText && trackText.length > 3) {
      // Skip non-music items
      if (trackText.match(/^(You can read|Play |Build a|Interested in|Call the|SPECIAL THANKS|Get started)/i)) {
        continue;
      }
      
      // Extract podcast ID and episode ID from href
      let feedGuid = null;
      let itemGuid = null;
      
      // Parse URLs like: https://podcastindex.org/podcast/6736401?episode=17777519512
      const podcastMatch = href.match(/podcastindex\.org\/podcast\/(\d+)\?episode=(\d+)/);
      if (podcastMatch) {
        const podcastId = podcastMatch[1];
        const episodeId = podcastMatch[2];
        // Generate GUIDs based on the podcast and episode IDs
        feedGuid = generateGuidFromId(podcastId);
        itemGuid = generateGuidFromId(episodeId);
      } else {
        // Fallback: generate GUIDs based on the track text
        feedGuid = generateGuidFromString(trackText);
        itemGuid = generateGuidFromString(trackText + Date.now());
      }
      
      // Extract artist and song from "Artist - Song" format
      const trackMatch = trackText.match(/^(.+?)\s*-\s*(.+)$/);
      if (trackMatch) {
        tracks.push({
          artist: trackMatch[1].trim(),
          song: trackMatch[2].trim(),
          full: trackText,
          feedGuid: feedGuid,
          itemGuid: itemGuid
        });
      } else if (trackText.length > 3 && !trackText.match(/^(http|www|https)/i)) {
        // If no clear artist-song format, treat as song title (but skip URLs)
        tracks.push({
          artist: 'Unknown Artist',
          song: trackText,
          full: trackText,
          feedGuid: feedGuid,
          itemGuid: itemGuid
        });
      }
    }
  }
  
  return tracks;
}

function generateGuidFromId(id) {
  // Generate a UUID-like string based on the ID
  // This creates a consistent GUID for the same ID
  const hash = crypto.createHash('md5').update(id.toString()).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

function generateGuidFromString(str) {
  // Generate a UUID-like string based on the string content
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

function generateMinimalRSS(tracks, channelInfo) {
  const now = new Date().toUTCString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${channelInfo.title}</title>
<description>
${channelInfo.description}
</description>
<link>${channelInfo.link}</link>
<language>${channelInfo.language}</language>
<pubDate>${now}</pubDate>
<lastBuildDate>${now}</lastBuildDate>
<image>
<url>
${channelInfo.imageUrl}
</url>
</image>
<podcast:medium>musicL</podcast:medium>
<podcast:guid>homegrown-hits-music-playlist</podcast:guid>`;

  tracks.forEach(track => {
    xml += `
<item>
<podcast:remoteItem feedGuid="${track.feedGuid}" itemGuid="${track.itemGuid}"/>
</item>`;
  });

  xml += `
</channel>
</rss>`;

  return xml;
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createHomegrownHitsMinimalPlaylist()
    .then(() => {
      console.log('🎉 Minimal playlist creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Minimal playlist creation failed:', error);
      process.exit(1);
    });
}

export default createHomegrownHitsMinimalPlaylist;
