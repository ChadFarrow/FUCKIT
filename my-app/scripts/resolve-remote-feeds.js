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
    'User-Agent': 'remote-feed-resolver/1.0',
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

async function resolveRemoteFeed(feedGuid, itemGuid) {
  console.log(`Resolving feedGuid: ${feedGuid}, itemGuid: ${itemGuid}`);
  
  // First, try to get the feed info from PodcastIndex
  let feedInfo = null;
  const feedData = await piGet('/podcasts/byguid', { guid: feedGuid });
  if (feedData && feedData.feed) {
    feedInfo = feedData.feed;
    console.log(`Found feed in PodcastIndex: ${feedInfo.title} (ID: ${feedInfo.id})`);
  } else {
    console.log(`Feed not found in PodcastIndex: ${feedGuid}`);
    return { feedGuid, itemGuid, title: null, artist: null, feedUrl: null, feedTitle: null };
  }
  
  // Now try to get the specific episode by GUID
  let episodeInfo = null;
  const episodeData = await piGet('/episodes/byguid', { guid: itemGuid });
  if (episodeData && episodeData.episode) {
    episodeInfo = episodeData.episode;
    console.log(`Found episode in PodcastIndex: ${episodeInfo.title}`);
  } else {
    console.log(`Episode not found in PodcastIndex: ${itemGuid}`);
    
    // If episode not found by GUID, try to get episodes from the feed and search
    if (feedInfo.id) {
      console.log(`Searching for episode in feed ${feedInfo.id}...`);
      const episodesData = await piGet('/episodes/byfeedid', { 
        id: feedInfo.id,
        max: 100 // Get more episodes to search through
      });
      
      if (episodesData && episodesData.items) {
        // Search for the itemGuid in the episodes
        for (const episode of episodesData.items) {
          if (episode.guid === itemGuid || episode.id === itemGuid) {
            episodeInfo = episode;
            console.log(`Found episode in feed search: ${episode.title}`);
            break;
          }
        }
      }
    }
  }
  
  if (!episodeInfo) {
    console.log(`Could not resolve episode ${itemGuid} in feed ${feedGuid}`);
    return { 
      feedGuid, 
      itemGuid, 
      title: null, 
      artist: null, 
      feedUrl: feedInfo?.url || null,
      feedTitle: feedInfo?.title || null
    };
  }
  
  console.log(`Resolved: ${episodeInfo.title} by ${episodeInfo.author || feedInfo.author}`);
  
  return {
    feedGuid,
    itemGuid,
    title: episodeInfo.title,
    artist: episodeInfo.author || feedInfo.author,
    feedUrl: feedInfo.url,
    feedTitle: feedInfo.title,
    episodeId: episodeInfo.id,
    feedId: feedInfo.id
  };
}

async function main() {
  console.log('Resolving remote feeds from ITDV music playlist using PodcastIndex...\n');
  
  // Read the existing resolved data
  const resolvedPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-resolved.json');
  let existingData = [];
  
  try {
    const existingContent = await fs.readFile(resolvedPath, 'utf-8');
    existingData = JSON.parse(existingContent);
  } catch (error) {
    console.log('No existing resolved data found, starting fresh');
  }
  
  const results = [];
  const processed = new Set();
  
  for (const item of existingData) {
    const key = `${item.feedGuid}-${item.itemGuid}`;
    if (processed.has(key)) continue;
    processed.add(key);
    
    if (!item.title || item.title === '(unresolved)' || item.title === null) {
      console.log(`\n--- Resolving ${item.feedGuid} / ${item.itemGuid} ---`);
      const resolved = await resolveRemoteFeed(item.feedGuid, item.itemGuid);
      results.push(resolved);
      
      // Add a small delay to be respectful to PodcastIndex API
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      results.push(item);
    }
  }
  
  // Save results
  const outputPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  // Also save as CSV for easy viewing
  const csvPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.csv');
  const csvHeader = 'feedGuid,itemGuid,title,artist,feedUrl,feedTitle,episodeId,feedId\n';
  const csvContent = results.map(item => 
    `"${item.feedGuid}","${item.itemGuid}","${item.title || ''}","${item.artist || ''}","${item.feedUrl || ''}","${item.feedTitle || ''}","${item.episodeId || ''}","${item.feedId || ''}"`
  ).join('\n');
  await fs.writeFile(csvPath, csvHeader + csvContent);
  
  console.log(`\nResolved ${results.length} items`);
  console.log(`Results saved to:`);
  console.log(`  JSON: ${outputPath}`);
  console.log(`  CSV: ${csvPath}`);
  
  // Show summary
  const resolvedCount = results.filter(r => r.title).length;
  console.log(`\nSummary:`);
  console.log(`  Total items: ${results.length}`);
  console.log(`  Resolved: ${resolvedCount}`);
  console.log(`  Unresolved: ${results.length - resolvedCount}`);
  
  // Show some examples of resolved items
  const resolvedItems = results.filter(r => r.title);
  if (resolvedItems.length > 0) {
    console.log(`\nExample resolved items:`);
    resolvedItems.slice(0, 5).forEach(item => {
      console.log(`  ${item.title} by ${item.artist || 'Unknown Artist'}`);
    });
  }
}

await main();
