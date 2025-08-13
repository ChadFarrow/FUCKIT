#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Podcast Index API authentication
function createAuthHeaders() {
  const unixTime = Math.floor(Date.now() / 1000);
  const data4Hash = API_KEY + API_SECRET + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': API_KEY,
    'Authorization': hash,
    'User-Agent': 'FUCKIT-Music-App/1.0'
  };
}

async function debugSingleItem() {
  const feedGuid = "1f2260ba-adcc-58c9-80c8-76b8eb92085e";
  const itemGuid = "4bcdb21b-57dd-48b4-bfbc-ee9f8111e46f";
  
  const headers = createAuthHeaders();
  const url = `https://api.podcastindex.org/api/1.0/episodes/bypodcastguid?podcastguid=${encodeURIComponent(feedGuid)}&guid=${encodeURIComponent(itemGuid)}`;
  
  console.log('🔍 Testing API call:');
  console.log(`URL: ${url}`);
  console.log(`Headers:`, headers);
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: headers 
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('\n📋 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugSingleItem();