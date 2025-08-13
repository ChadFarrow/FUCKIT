#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

async function debugEpisodeLookup(feedGuid, itemGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  const headers = await generateAuthHeaders(apiKey, apiSecret);
  const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&feedguid=${encodeURIComponent(feedGuid)}`;
  
  console.log(`🔍 Full response for episode: ${itemGuid} in feed: ${feedGuid}`);
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function listAllEpisodesInFeed(feedId) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  const headers = await generateAuthHeaders(apiKey, apiSecret);
  const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}`;
  
  console.log(`\n🎵 Listing all episodes in feed ID: ${feedId}`);
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.items) {
      console.log(`📊 Found ${data.count} episodes:`);
      data.items.forEach((episode, index) => {
        console.log(`  ${index + 1}. "${episode.title}" (GUID: ${episode.guid})`);
      });
      return data.items;
    } else {
      console.log(`❌ No episodes found: ${data.description}`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error listing episodes: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🔬 Debugging episode lookup...\n');
  
  const feedGuid = "de032037-63e0-5c6b-820d-13d4319a2b19";
  const itemGuid = "e046f9dd-aca3-4c7a-b396-2148a90ac0f2";
  
  // First try the specific episode lookup
  await debugEpisodeLookup(feedGuid, itemGuid);
  
  // Then list all episodes in the feed to see what's actually there
  await listAllEpisodesInFeed(7295699);
}

if (require.main === module) {
  main().catch(console.error);
}