#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
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
    console.error('❌ Missing PodcastIndex API credentials in .env.local');
    console.error('Please add:');
    console.error('PODCASTINDEX_API_KEY=your_api_key');
    console.error('PODCASTINDEX_API_SECRET=your_api_secret');
    return null;
  }
  
  const ts = Math.floor(Date.now() / 1000);
  const authHash = sha1Hex(apiKey + apiSecret + ts);
  return {
    'X-Auth-Date': String(ts),
    'X-Auth-Key': apiKey,
    'Authorization': authHash,
    'User-Agent': 'ITDV-Playlist-Resolver/1.0',
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

async function resolveMissingFeed() {
  console.log('🔍 Resolving missing feed 5a95f9d8-35e3-51f5-a269-ba1df36b4bd8 using Podcast Index ID 7365153...\n');
  
  // First, get the feed info using the ID
  const feedData = await piGet('/podcasts/byfeedid', { id: 7365153 });
  if (!feedData || !feedData.feed) {
    console.log('❌ Feed not found with ID 7365153');
    return;
  }
  
  const feed = feedData.feed;
  console.log('✅ Found feed!');
  console.log(`Title: ${feed.title}`);
  console.log(`Author: ${feed.author}`);
  console.log(`Feed URL: ${feed.url}`);
  console.log(`Website: ${feed.link}`);
  console.log(`Episode Count: ${feed.episodeCount || 'Unknown'}`);
  console.log('');
  
  // Get episodes from this feed
  const episodesData = await piGet('/episodes/byfeedid', { 
    id: 7365153,
    max: 100
  });
  
  if (!episodesData || !episodesData.items) {
    console.log('❌ No episodes found for this feed');
    return;
  }
  
  console.log(`📊 Found ${episodesData.items.length} episodes`);
  console.log('');
  
  // Look for the specific missing item GUIDs
  const missingItemGuids = [
    '7c823adf-1e53-4df1-98c0-979da81ec916',
    '822d7113-eab2-4857-82d2-cc0c1a52ce2b', 
    '24d8aa8b-317c-4f03-86d2-65c454370fb8'
  ];
  
  const resolvedTracks = [];
  
  for (const itemGuid of missingItemGuids) {
    console.log(`🔍 Looking for item GUID: ${itemGuid}`);
    
    // Search for the episode by GUID
    const episode = episodesData.items.find(ep => 
      ep.guid === itemGuid || ep.id === itemGuid || ep.id?.toString() === itemGuid
    );
    
    if (episode) {
      console.log(`✅ Found: ${episode.title}`);
      resolvedTracks.push({
        feedGuid: '5a95f9d8-35e3-51f5-a269-ba1df36b4bd8',
        itemGuid: itemGuid,
        title: episode.title,
        artist: feed.author || feed.title,
        feedUrl: feed.url,
        feedTitle: feed.title,
        episodeId: episode.id,
        feedId: 7365153
      });
    } else {
      console.log(`❌ Not found`);
      resolvedTracks.push({
        feedGuid: '5a95f9d8-35e3-51f5-a269-ba1df36b4bd8',
        itemGuid: itemGuid,
        title: null,
        artist: null,
        feedUrl: feed.url,
        feedTitle: feed.title,
        episodeId: null,
        feedId: 7365153
      });
    }
  }
  
  console.log('\n📝 Resolved tracks:');
  resolvedTracks.forEach((track, index) => {
    if (track.title) {
      console.log(`${index + 1}. ✅ ${track.title} by ${track.artist}`);
    } else {
      console.log(`${index + 1}. ❌ ${track.itemGuid} (not found)`);
    }
  });
  
  // Update the resolved data file
  const resolvedPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.json');
  let existingData = [];
  
  try {
    const existingContent = await fs.readFile(resolvedPath, 'utf-8');
    existingData = JSON.parse(existingContent);
  } catch (error) {
    console.log('No existing resolved data found');
  }
  
  // Update the existing data with the resolved tracks
  const updatedData = existingData.map(item => {
    const resolvedTrack = resolvedTracks.find(rt => rt.itemGuid === item.itemGuid);
    if (resolvedTrack) {
      return {
        ...item,
        title: resolvedTrack.title || item.title,
        artist: resolvedTrack.artist || item.artist,
        feedUrl: resolvedTrack.feedUrl || item.feedUrl,
        feedTitle: resolvedTrack.feedTitle || item.feedTitle,
        episodeId: resolvedTrack.episodeId || item.episodeId,
        feedId: resolvedTrack.feedId || item.feedId
      };
    }
    return item;
  });
  
  // Save the updated data
  await fs.writeFile(resolvedPath, JSON.stringify(updatedData, null, 2));
  console.log(`\n💾 Updated resolved data saved to: ${resolvedPath}`);
  
  // Also save as CSV for easy viewing
  const csvPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.csv');
  const csvHeader = 'feedGuid,itemGuid,title,artist,feedUrl,feedTitle,episodeId,feedId\n';
  const csvContent = updatedData.map(item => 
    `"${item.feedGuid}","${item.itemGuid}","${item.title || ''}","${item.artist || ''}","${item.feedUrl || ''}","${item.feedTitle || ''}","${item.episodeId || ''}","${item.feedId || ''}"`
  ).join('\n');
  await fs.writeFile(csvPath, csvHeader + csvContent);
  console.log(`📊 Updated CSV saved to: ${csvPath}`);
}

resolveMissingFeed().catch(console.error);
