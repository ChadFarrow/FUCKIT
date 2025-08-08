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
    process.exit(1);
  }
  const ts = Math.floor(Date.now() / 1000);
  const authHash = sha1Hex(apiKey + apiSecret + ts);
  return {
    'X-Auth-Date': String(ts),
    'X-Auth-Key': apiKey,
    'Authorization': authHash,
    'User-Agent': 'feed-guid-lookup/1.0',
    'Accept': 'application/json'
  };
}

async function piGet(endpoint, params = {}) {
  const headers = buildPiHeaders();
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

async function lookupFeedGuid(feedGuid) {
  console.log(`Looking up feed GUID: ${feedGuid}`);
  console.log('---');
  
  const data = await piGet('/podcasts/byguid', { guid: feedGuid });
  
  if (!data || !data.feeds || data.feeds.length === 0) {
    console.log('❌ Feed not found in PodcastIndex');
    return;
  }
  
  const feed = data.feeds[0];
  console.log('✅ Feed found!');
  console.log('');
  console.log(`Title: ${feed.title}`);
  console.log(`Author: ${feed.author}`);
  console.log(`Description: ${feed.description?.substring(0, 200)}${feed.description?.length > 200 ? '...' : ''}`);
  console.log(`Language: ${feed.language}`);
  console.log(`Categories: ${feed.categories ? Object.values(feed.categories).join(', ') : 'None'}`);
  console.log(`Feed URL: ${feed.url}`);
  console.log(`Website: ${feed.link}`);
  console.log(`Last Updated: ${feed.lastUpdateTime ? new Date(feed.lastUpdateTime * 1000).toISOString() : 'Unknown'}`);
  console.log(`Episode Count: ${feed.episodeCount || 'Unknown'}`);
}

async function main() {
  const feedGuid = process.argv[2];
  if (!feedGuid) {
    console.error('Usage: node scripts/lookup-feed-guid.js <feedGuid>');
    console.error('Example: node scripts/lookup-feed-guid.js 3ae285ab-434c-59d8-aa2f-59c6129afb92');
    process.exit(1);
  }
  
  await lookupFeedGuid(feedGuid);
}

await main();
