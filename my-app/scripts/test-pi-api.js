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
  console.log(`API Key: ${apiKey ? 'Present' : 'Missing'}`);
  console.log(`API Secret: ${apiSecret ? 'Present' : 'Missing'}`);
  
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
    'User-Agent': 'test-pi-api/1.0',
    'Accept': 'application/json'
  };
}

async function testApi() {
  console.log('Testing PodcastIndex API...\n');
  
  const headers = buildPiHeaders();
  if (!headers) {
    console.log('Cannot test API without credentials');
    return;
  }
  
  // Test with a known feed GUID (the main ITDV feed)
  const testGuid = '41aace28-8679-5ef1-9958-75cf76c2b5f0';
  console.log(`Testing with known feed GUID: ${testGuid}`);
  
  const url = new URL(PODCASTINDEX_BASE + '/podcasts/byguid');
  url.searchParams.append('guid', testGuid);
  
  try {
    const response = await fetch(url.toString(), { headers });
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.feeds && data.feeds.length > 0) {
      console.log(`\n✅ Found feed: ${data.feeds[0].title}`);
    } else {
      console.log('\n❌ Feed not found in PodcastIndex');
    }
    
  } catch (error) {
    console.error(`API test failed: ${error.message}`);
  }
}

await testApi();
