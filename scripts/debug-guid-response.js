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

async function debugFeedLookup(feedGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  const headers = await generateAuthHeaders(apiKey, apiSecret);
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
  
  console.log(`🔍 Full response for feed: ${feedGuid}`);
  
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

async function main() {
  console.log('🔬 Debugging GUID lookup responses...\n');
  
  // Test the first GUID that returned "Found matching feeds"
  await debugFeedLookup("de032037-63e0-5c6b-820d-13d4319a2b19");
}

if (require.main === module) {
  main().catch(console.error);
}