#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load env from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const PODCASTINDEX_BASE = 'https://api.podcastindex.org/api/1.0';

function getEnv(name) {
  return process.env[name] ?? '';
}

function sha1Hex(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function buildPiHeaders() {
  const apiKey = getEnv('PODCASTINDEX_API_KEY');
  const apiSecret = getEnv('PODCASTINDEX_API_SECRET');
  if (!apiKey || !apiSecret) {
    console.error('Missing PODCASTINDEX_API_KEY or PODCASTINDEX_API_SECRET in .env.local');
    return null;
  }
  const ts = Math.floor(Date.now() / 1000);
  const authHash = sha1Hex(apiKey + apiSecret + ts);
  return {
    'X-Auth-Date': String(ts),
    'X-Auth-Key': apiKey,
    'Authorization': authHash,
    'User-Agent': 'playlist-updater/1.0',
    'Accept': 'application/json'
  };
}

async function piGet(endpoint, params = {}) {
  const headers = buildPiHeaders();
  if (!headers) return null;
  
  const url = new URL(PODCASTINDEX_BASE + endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    return null;
  }
}

async function fetchRSSFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    return xmlDoc;
  } catch (error) {
    console.error(`Failed to fetch RSS feed: ${error.message}`);
    return null;
  }
}

async function getLatestEpisodes(feedUrl, lastCheckDate = null) {
  console.log(`🔍 Checking for new episodes from: ${feedUrl}`);
  
  const xmlDoc = await fetchRSSFeed(feedUrl);
  if (!xmlDoc) return [];
  
  const items = xmlDoc.getElementsByTagName('item');
  const newEpisodes = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent;
    const title = item.getElementsByTagName('title')[0]?.textContent;
    const guid = item.getElementsByTagName('guid')[0]?.textContent;
    
    if (pubDate && title && guid) {
      const episodeDate = new Date(pubDate);
      
      // If no lastCheckDate or episode is newer than last check
      if (!lastCheckDate || episodeDate > lastCheckDate) {
        newEpisodes.push({
          title,
          guid,
          pubDate: episodeDate,
          description: item.getElementsByTagName('description')[0]?.textContent || ''
        });
      }
    }
  }
  
  return newEpisodes;
}

async function extractTracksFromEpisode(episodeDescription) {
  const tracks = [];
  
  // Extract tracks from anchor tags (common format)
  const anchorPattern = /<a[^>]*href=['\"]([^'\"]*)['\"][^>]*>([^<]+)<\/a>/gi;
  const anchorMatches = [...episodeDescription.matchAll(anchorPattern)];
  
  for (const match of anchorMatches) {
    const href = match[1].trim();
    const trackText = match[2].trim();
    
    if (trackText && trackText.length > 3) {
      // Skip non-music items
      if (trackText.match(/^(You can read|Play |Build a|Interested in|Call the|SPECIAL THANKS|Get started)/i)) {
        continue;
      }
      
      // Extract artist and song from "Artist - Song" format
      const trackMatch = trackText.match(/^(.+?)\s*-\s*(.+)$/);
      if (trackMatch) {
        tracks.push({
          artist: trackMatch[1].trim(),
          song: trackMatch[2].trim(),
          full: trackText,
          href
        });
      } else if (trackText.length > 3) {
        tracks.push({
          artist: 'Unknown Artist',
          song: trackText,
          full: trackText,
          href
        });
      }
    }
  }
  
  return tracks;
}

async function updatePlaylistWithNewEpisodes(playlistPath, newEpisodes, feedUrl) {
  console.log(`📝 Updating playlist: ${playlistPath}`);
  
  let playlistData = [];
  try {
    const existingContent = await fs.readFile(playlistPath, 'utf-8');
    playlistData = JSON.parse(existingContent);
  } catch (error) {
    console.log('No existing playlist data found, starting fresh');
  }
  
  const existingGuids = new Set(playlistData.map(item => item.itemGuid));
  let newTracksAdded = 0;
  
  for (const episode of newEpisodes) {
    console.log(`🎵 Processing episode: ${episode.title}`);
    
    const tracks = await extractTracksFromEpisode(episode.description);
    
    for (const track of tracks) {
      // Generate a unique GUID for this track
      const trackGuid = crypto.randomUUID();
      
      if (!existingGuids.has(trackGuid)) {
        playlistData.push({
          feedGuid: `generated-${Date.now()}`,
          itemGuid: trackGuid,
          title: track.song,
          artist: track.artist,
          feedUrl: feedUrl,
          feedTitle: episode.title,
          episodeId: null,
          feedId: null,
          episodeDate: episode.pubDate.toISOString()
        });
        
        existingGuids.add(trackGuid);
        newTracksAdded++;
      }
    }
  }
  
  if (newTracksAdded > 0) {
    await fs.writeFile(playlistPath, JSON.stringify(playlistData, null, 2));
    console.log(`✅ Added ${newTracksAdded} new tracks to playlist`);
  } else {
    console.log('ℹ️ No new tracks found');
  }
  
  return newTracksAdded;
}

async function main() {
  console.log('🚀 Starting playlist update process...\n');
  
  // Define the feeds to monitor
  const feedsToMonitor = [
    {
      name: 'ITDV',
      url: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      playlistPath: 'playlists/itdv-music-feed-fully-resolved.json'
    },
    {
      name: 'Homegrown Hits',
      url: 'https://feed.homegrownhits.xyz/feed.xml',
      playlistPath: 'playlists/homegrown-hits-music-playlist.json'
    }
  ];
  
  let totalNewTracks = 0;
  
  for (const feed of feedsToMonitor) {
    console.log(`\n📻 Checking ${feed.name} feed...`);
    
    try {
      // Get the last check date (you could store this in a file)
      const lastCheckDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Check last 24 hours
      
      const newEpisodes = await getLatestEpisodes(feed.url, lastCheckDate);
      
      if (newEpisodes.length > 0) {
        console.log(`🎉 Found ${newEpisodes.length} new episodes!`);
        
        const newTracks = await updatePlaylistWithNewEpisodes(
          feed.playlistPath, 
          newEpisodes, 
          feed.url
        );
        
        totalNewTracks += newTracks;
      } else {
        console.log('ℹ️ No new episodes found');
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${feed.name}: ${error.message}`);
    }
  }
  
  console.log(`\n🎵 Playlist update complete! Added ${totalNewTracks} new tracks total.`);
  
  // Update the last check timestamp
  const timestampPath = 'playlists/last-update-timestamp.json';
  await fs.writeFile(timestampPath, JSON.stringify({
    lastUpdate: new Date().toISOString(),
    tracksAdded: totalNewTracks
  }, null, 2));
  
  console.log(`📅 Updated timestamp: ${timestampPath}`);
}

// Run the update
main().catch(console.error);
