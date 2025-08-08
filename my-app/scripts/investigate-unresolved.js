#!/usr/bin/env node

import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

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
    'User-Agent': 'investigate-unresolved/1.0',
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

async function investigateUnresolved() {
  console.log('Investigating unresolved items...\n');
  
  const unresolvedItems = [
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "7c823adf-1e53-4df1-98c0-979da81ec916" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" }
  ];
  
  for (const item of unresolvedItems) {
    console.log(`\n--- Investigating ${item.feedGuid} / ${item.itemGuid} ---`);
    
    // Try to get feed info
    const feedData = await piGet('/podcasts/byguid', { guid: item.feedGuid });
    if (feedData && feedData.feed) {
      console.log(`✅ Found feed: ${feedData.feed.title} (ID: ${feedData.feed.id})`);
      console.log(`   URL: ${feedData.feed.url}`);
      
      // Try to get episodes from this feed
      const episodesData = await piGet('/episodes/byfeedid', { 
        id: feedData.feed.id,
        max: 100
      });
      
      if (episodesData && episodesData.items) {
        console.log(`   Found ${episodesData.items.length} episodes`);
        
        // Search for the specific itemGuid
        const foundEpisode = episodesData.items.find(ep => 
          ep.guid === item.itemGuid || ep.id === item.itemGuid
        );
        
        if (foundEpisode) {
          console.log(`✅ Found episode: ${foundEpisode.title}`);
        } else {
          console.log(`❌ Episode not found in feed`);
        }
      }
    } else {
      console.log(`❌ Feed not found in PodcastIndex`);
      
      // Try some alternative approaches
      console.log('Trying alternative approaches...');
      
      // Try searching by episode GUID directly
      const episodeData = await piGet('/episodes/byguid', { guid: item.itemGuid });
      if (episodeData && episodeData.episode) {
        console.log(`✅ Found episode directly: ${episodeData.episode.title}`);
        console.log(`   Feed ID: ${episodeData.episode.feedId}`);
      } else {
        console.log(`❌ Episode not found by GUID`);
      }
    }
  }
}

await investigateUnresolved();
