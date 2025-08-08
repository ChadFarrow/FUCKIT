#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    feedUrl: null,
    outputFile: null,
    title: null,
    description: null,
    link: null,
    imageUrl: null,
    guid: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--feed':
      case '-f':
        options.feedUrl = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.outputFile = nextArg;
        i++;
        break;
      case '--title':
      case '-t':
        options.title = nextArg;
        i++;
        break;
      case '--description':
      case '-d':
        options.description = nextArg;
        i++;
        break;
      case '--link':
      case '-l':
        options.link = nextArg;
        i++;
        break;
      case '--image':
      case '-i':
        options.imageUrl = nextArg;
        i++;
        break;
      case '--guid':
      case '-g':
        options.guid = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
🎵 Generic Minimal Playlist Generator

Usage: node create-generic-minimal-playlist.js [options]

Required Options:
  --feed, -f <url>           RSS feed URL to process
  --output, -o <filename>    Output filename (will be saved in playlists/ directory)

Optional Options:
  --title, -t <title>        Playlist title (default: extracted from feed)
  --description, -d <desc>   Playlist description (default: extracted from feed)
  --link, -l <url>          Playlist link (default: extracted from feed)
  --image, -i <url>         Playlist image URL (default: extracted from feed)
  --guid, -g <guid>         Playlist GUID (default: auto-generated)
  --help, -h                Show this help message

Examples:
  # Create ITDV-style playlist from Homegrown Hits
  node create-generic-minimal-playlist.js \\
    --feed https://feed.homegrownhits.xyz/feed.xml \\
    --output homegrown-hits-minimal.xml \\
    --title "Homegrown Hits music playlist" \\
    --description "Every music reference from Homegrown Hits podcast" \\
    --link https://homegrownhits.xyz \\
    --image https://bowlafterbowl.com/wp-content/uploads/2023/09/HomegrownHitsArt.png \\
    --guid homegrown-hits-music-playlist

  # Create playlist from any podcast feed with auto-extracted metadata
  node create-generic-minimal-playlist.js \\
    --feed https://example.com/feed.xml \\
    --output my-playlist.xml
`);
}

async function createGenericMinimalPlaylist(options) {
  try {
    console.log('🎵 Creating generic minimal music playlist...\n');
    
    if (!options.feedUrl) {
      throw new Error('Feed URL is required. Use --feed <url> or --help for usage.');
    }
    
    if (!options.outputFile) {
      throw new Error('Output filename is required. Use --output <filename> or --help for usage.');
    }
    
    console.log(`📡 Processing feed: ${options.feedUrl}`);
    
    // Fetch and parse RSS feed
    const response = await fetch(options.feedUrl);
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
    
    // Extract channel metadata
    const channelTitle = options.title || channel.getElementsByTagName('title')[0]?.textContent || 'Music Playlist';
    const channelDescription = options.description || channel.getElementsByTagName('description')[0]?.textContent || 'Music playlist RSS feed';
    const channelLink = options.link || channel.getElementsByTagName('link')[0]?.textContent || '';
    const channelLanguage = channel.getElementsByTagName('language')[0]?.textContent || 'en';
    const channelImage = channel.getElementsByTagName('image')[0];
    const imageUrl = options.imageUrl || channelImage?.getElementsByTagName('url')[0]?.textContent || '';
    const imageTitle = channelImage?.getElementsByTagName('title')[0]?.textContent || channelTitle;
    
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
      title: channelTitle,
      description: channelDescription,
      link: channelLink,
      language: channelLanguage,
      imageUrl: imageUrl,
      imageTitle: imageTitle,
      guid: options.guid || generateGuidFromString(channelTitle)
    });
    
    // Save the playlist
    const outputDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, options.outputFile);
    await fs.writeFile(outputPath, rssContent);
    
    console.log(`✅ Successfully created minimal playlist!`);
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
<podcast:guid>${channelInfo.guid}</podcast:guid>`;

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
  const options = parseArguments();
  
  if (process.argv.length === 2 || options.feedUrl === null) {
    printHelp();
    process.exit(1);
  }
  
  createGenericMinimalPlaylist(options)
    .then(() => {
      console.log('🎉 Generic minimal playlist creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Generic minimal playlist creation failed:', error);
      process.exit(1);
    });
}

export default createGenericMinimalPlaylist;
