#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const RSS_FEED_URL = 'https://feed.homegrownhits.xyz/feed.xml';

async function createHomegrownHitsPlaylist() {
  try {
    console.log('🎵 Creating music playlist from Homegrown Hits podcast...\n');
    
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
    
    // Create RSS feed structure
    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
<channel>
  <title>Homegrown Hits Music Playlist</title>
  <description>Music playlist RSS feed created from Homegrown Hits podcast</description>
  <link>${channelLink}</link>
  <language>${channelLanguage}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>Homegrown Hits Music Playlist Generator</generator>
  <podcast:medium>music</podcast:medium>
  <image>
    <url>${imageUrl}</url>
    <title>${imageTitle}</title>
  </image>`;
    
    let itemsXml = '';
    let trackCount = 0;
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const title = episode.getElementsByTagName('title')[0]?.textContent || `Episode ${i + 1}`;
      const pubDate = episode.getElementsByTagName('pubDate')[0]?.textContent || new Date().toUTCString();
      const guid = episode.getElementsByTagName('guid')[0]?.textContent || `homegrown-hits-ep-${i + 1}`;
      const description = episode.getElementsByTagName('description')[0]?.textContent || '';
      const duration = episode.getElementsByTagName('itunes:duration')[0]?.textContent || '0';
      const enclosure = episode.getElementsByTagName('enclosure')[0];
      
      // Extract tracks from description
      const tracks = extractTracksFromDescription(description);
      
      if (tracks.length > 0) {
        trackCount += tracks.length;
        
        // Create episode item
        let episodeXml = `
  <item>
    <title>${escapeXml(title)} (Music Playlist)</title>
    <description>${escapeXml(createEpisodeDescription(description, tracks))}</description>
    <pubDate>${pubDate}</pubDate>
    <guid>${guid}-music-playlist</guid>
    <itunes:duration>${duration}</itunes:duration>`;
        
        // Add remote items for each track (placeholder - would need actual feed GUIDs)
        tracks.forEach((track, index) => {
          episodeXml += `
    <podcast:remoteItem feedGuid="${track.feedGuid}" itemGuid="${track.itemGuid}" />`;
        });
        
        // Add enclosure if available
        if (enclosure) {
          const enclosureUrl = enclosure.getAttribute('url') || '';
          const enclosureType = enclosure.getAttribute('type') || 'audio/mpeg';
          const enclosureLength = enclosure.getAttribute('length') || '0';
          episodeXml += `
    <enclosure url="${enclosureUrl}" type="${enclosureType}" length="${enclosureLength}" />`;
        }
        
        episodeXml += `
  </item>`;
        
        itemsXml += episodeXml;
      }
    }
    
    const fullRss = rssFeed + itemsXml + `
</channel>
</rss>`;
    
    // Save the playlist
    const outputDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'homegrown-hits-music-playlist.xml');
    await fs.writeFile(outputPath, fullRss);
    
    console.log(`✅ Successfully created Homegrown Hits music playlist!`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🎵 Processed ${episodes.length} episodes with ${trackCount} total tracks\n`);
    
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
  
  // If no tracks found from anchors, try the original pattern
  if (tracks.length === 0) {
    const trackPatterns = [
      /TRACKS:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
      /Track list:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
      /Tracks:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi
    ];
    
    for (const pattern of trackPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        const trackSection = matches[1] || matches[0];
        const trackLines = trackSection.split('\n').filter(line => line.trim());
        
        for (const line of trackLines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.match(/^(Call the|You can|Play |Interested|Build a|SPECIAL THANKS)/i)) {
            // Extract artist and song from "Artist - Song" format
            const trackMatch = trimmedLine.match(/^(.+?)\s*-\s*(.+)$/);
            if (trackMatch) {
              tracks.push({
                artist: trackMatch[1].trim(),
                song: trackMatch[2].trim(),
                full: trimmedLine,
                feedGuid: generateGuidFromString(trimmedLine),
                itemGuid: generateGuidFromString(trimmedLine + Date.now())
              });
            } else if (trimmedLine.length > 3) {
              // If no clear artist-song format, treat as song title
              tracks.push({
                artist: 'Unknown Artist',
                song: trimmedLine,
                full: trimmedLine,
                feedGuid: generateGuidFromString(trimmedLine),
                itemGuid: generateGuidFromString(trimmedLine + Date.now())
              });
            }
          }
        }
        break;
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

function createEpisodeDescription(originalDescription, tracks) {
  let description = `<p><strong>🎵 Music Playlist Episode</strong></p>
<p>${originalDescription}</p>`;
  
  if (tracks.length > 0) {
    description += `<p><strong>Referenced Music:</strong></p>
<ul>`;
    
    tracks.forEach(track => {
      if (track.feedGuid && track.itemGuid) {
        description += `
<li>Feed: ${track.feedGuid}, Item: ${track.itemGuid}</li>`;
      } else {
        description += `
<li>${escapeXml(track.full)}</li>`;
      }
    });
    
    description += `
</ul>
<p><em>Generated from Homegrown Hits podcast using Podcast Index namespace</em></p>`;
  }
  
  return description;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createHomegrownHitsPlaylist()
    .then(() => {
      console.log('🎉 Playlist creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Playlist creation failed:', error);
      process.exit(1);
    });
}

export default createHomegrownHitsPlaylist;
