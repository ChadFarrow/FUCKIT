#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load env from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const ITDV_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';
const PLAYLIST_PATH = 'playlists/itdv-music-feed-fully-resolved.json';
const TIMESTAMP_PATH = 'playlists/itdv-last-update.json';

async function fetchITDVFeed() {
  try {
    console.log('🔍 Fetching ITDV RSS feed...');
    const response = await fetch(ITDV_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    return xmlDoc;
  } catch (error) {
    console.error(`Failed to fetch ITDV feed: ${error.message}`);
    return null;
  }
}

async function getLastUpdateTime() {
  try {
    const timestampContent = await fs.readFile(TIMESTAMP_PATH, 'utf-8');
    const timestamp = JSON.parse(timestampContent);
    return new Date(timestamp.lastUpdate);
  } catch (error) {
    // If no timestamp file exists, return a date from 7 days ago
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
}

async function getNewEpisodes(xmlDoc, lastUpdateTime) {
  const items = xmlDoc.getElementsByTagName('item');
  const newEpisodes = [];
  
  console.log(`📅 Checking for episodes newer than: ${lastUpdateTime.toISOString()}`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent;
    const title = item.getElementsByTagName('title')[0]?.textContent;
    const guid = item.getElementsByTagName('guid')[0]?.textContent;
    const description = item.getElementsByTagName('description')[0]?.textContent || '';
    
    if (pubDate && title && guid) {
      const episodeDate = new Date(pubDate);
      
      if (episodeDate > lastUpdateTime) {
        console.log(`🎉 Found new episode: ${title} (${episodeDate.toISOString()})`);
        newEpisodes.push({
          title,
          guid,
          pubDate: episodeDate,
          description
        });
      }
    }
  }
  
  return newEpisodes;
}

async function extractTracksFromEpisode(episodeDescription) {
  const tracks = [];
  
  // Extract tracks from anchor tags (common format in ITDV)
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

async function updateITDVPlaylist(newEpisodes) {
  console.log('📝 Updating ITDV playlist...');
  
  let playlistData = [];
  try {
    const existingContent = await fs.readFile(PLAYLIST_PATH, 'utf-8');
    playlistData = JSON.parse(existingContent);
    console.log(`📊 Loaded existing playlist with ${playlistData.length} tracks`);
  } catch (error) {
    console.log('No existing playlist data found, starting fresh');
  }
  
  const existingGuids = new Set(playlistData.map(item => item.itemGuid));
  let newTracksAdded = 0;
  
  for (const episode of newEpisodes) {
    console.log(`🎵 Processing episode: ${episode.title}`);
    
    const tracks = await extractTracksFromEpisode(episode.description);
    console.log(`  Found ${tracks.length} tracks in episode`);
    
    for (const track of tracks) {
      // Generate a unique GUID for this track
      const trackGuid = crypto.randomUUID();
      
      if (!existingGuids.has(trackGuid)) {
        const newTrack = {
          feedGuid: `itdv-${Date.now()}`,
          itemGuid: trackGuid,
          title: track.song,
          artist: track.artist,
          feedUrl: ITDV_FEED_URL,
          feedTitle: episode.title,
          episodeId: null,
          feedId: null,
          episodeDate: episode.pubDate.toISOString()
        };
        
        playlistData.push(newTrack);
        existingGuids.add(trackGuid);
        newTracksAdded++;
        
        console.log(`  ✅ Added: ${track.artist} - ${track.song}`);
      }
    }
  }
  
  if (newTracksAdded > 0) {
    await fs.writeFile(PLAYLIST_PATH, JSON.stringify(playlistData, null, 2));
    console.log(`🎉 Successfully added ${newTracksAdded} new tracks to ITDV playlist!`);
  } else {
    console.log('ℹ️ No new tracks found to add');
  }
  
  return newTracksAdded;
}

async function updateTimestamp() {
  const timestamp = {
    lastUpdate: new Date().toISOString(),
    feedUrl: ITDV_FEED_URL
  };
  
  await fs.writeFile(TIMESTAMP_PATH, JSON.stringify(timestamp, null, 2));
  console.log(`📅 Updated timestamp: ${TIMESTAMP_PATH}`);
}

async function main() {
  console.log('🚀 Starting ITDV playlist update...\n');
  
  try {
    // Fetch the ITDV feed
    const xmlDoc = await fetchITDVFeed();
    if (!xmlDoc) {
      console.error('❌ Failed to fetch ITDV feed');
      return;
    }
    
    // Get the last update time
    const lastUpdateTime = await getLastUpdateTime();
    
    // Get new episodes
    const newEpisodes = await getNewEpisodes(xmlDoc, lastUpdateTime);
    
    if (newEpisodes.length === 0) {
      console.log('ℹ️ No new episodes found since last update');
      return;
    }
    
    console.log(`🎉 Found ${newEpisodes.length} new episodes!`);
    
    // Update the playlist with new tracks
    const newTracks = await updateITDVPlaylist(newEpisodes);
    
    // Update the timestamp
    await updateTimestamp();
    
    console.log(`\n🎵 ITDV playlist update complete! Added ${newTracks} new tracks.`);
    console.log(`📊 Total tracks in playlist: ${(await fs.readFile(PLAYLIST_PATH, 'utf-8')).split('"itemGuid"').length - 1}`);
    
  } catch (error) {
    console.error(`❌ Error updating ITDV playlist: ${error.message}`);
  }
}

// Run the update
main().catch(console.error);
