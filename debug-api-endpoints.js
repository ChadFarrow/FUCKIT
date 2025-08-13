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

async function testMultipleEndpoints() {
  const feedGuid = "1f2260ba-adcc-58c9-80c8-76b8eb92085e";
  const itemGuid = "4bcdb21b-57dd-48b4-bfbc-ee9f8111e46f";
  
  console.log('🔍 Testing multiple API endpoints for:');
  console.log(`   feedGuid: ${feedGuid}`);
  console.log(`   itemGuid: ${itemGuid}\n`);
  
  const headers = createAuthHeaders();
  
  // Test 1: Original endpoint (bypodcastguid)
  console.log('📡 TEST 1: /episodes/bypodcastguid');
  try {
    const url1 = `https://api.podcastindex.org/api/1.0/episodes/bypodcastguid?podcastguid=${encodeURIComponent(feedGuid)}&guid=${encodeURIComponent(itemGuid)}`;
    const response1 = await fetch(url1, { headers });
    const data1 = await response1.json();
    console.log(`   Status: ${response1.status}`);
    console.log(`   Result: ${JSON.stringify(data1).substring(0, 200)}...\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 2: Try by feedid if we can find it
  console.log('📡 TEST 2: /podcasts/byguid (check if feed exists)');
  try {
    const url2 = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    const response2 = await fetch(url2, { headers });
    const data2 = await response2.json();
    console.log(`   Status: ${response2.status}`);
    console.log(`   Result: ${JSON.stringify(data2).substring(0, 200)}...\n`);
    
    // If feed exists, try episodes by feedid
    if (data2.feed && data2.feed.id) {
      console.log('📡 TEST 3: /episodes/byfeedid (using found feedid)');
      const url3 = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${data2.feed.id}&max=50`;
      const response3 = await fetch(url3, { headers });
      const data3 = await response3.json();
      console.log(`   Status: ${response3.status}`);
      console.log(`   Episodes found: ${data3.items ? data3.items.length : 0}`);
      
      if (data3.items && data3.items.length > 0) {
        console.log(`   Sample episode GUIDs:`);
        data3.items.slice(0, 3).forEach((ep, i) => {
          console.log(`     ${i+1}. ${ep.guid || 'No GUID'}`);
        });
      }
    }
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 4: Try episodes by GUID directly  
  console.log('📡 TEST 4: /episodes/byguid (direct episode lookup)');
  try {
    const url4 = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}`;
    const response4 = await fetch(url4, { headers });
    const data4 = await response4.json();
    console.log(`   Status: ${response4.status}`);
    console.log(`   Result: ${JSON.stringify(data4).substring(0, 200)}...\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 5: Check if these are V4V-specific
  console.log('📡 TEST 5: /value/byguid (check V4V info)');
  try {
    const url5 = `https://api.podcastindex.org/api/1.0/value/byguid?guid=${encodeURIComponent(feedGuid)}`;
    const response5 = await fetch(url5, { headers });
    const data5 = await response5.json();
    console.log(`   Status: ${response5.status}`);
    console.log(`   Result: ${JSON.stringify(data5).substring(0, 200)}...\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
}

testMultipleEndpoints();