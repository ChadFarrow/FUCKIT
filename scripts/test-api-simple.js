#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function testKnownGoodFeed() {
  // Test with an ITDV feed GUID that we know works
  const feedGuid = '3ae285ab-434c-59d8-aa2f-59c6129afb92'; // Neon Hawk from ITDV
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  const headers = generateAuthHeaders();
  
  console.log('🧪 Testing with known good ITDV feed GUID...');
  console.log(`📡 URL: ${url}`);
  
  try {
    const response = await fetch(url, { headers });
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API is working!');
      console.log(`🎙️ Feed: ${data.feed?.title || 'Unknown'}`);
      console.log(`🆔 Feed ID: ${data.feed?.id || 'Unknown'}`);
      return true;
    } else {
      const text = await response.text();
      console.log('❌ API call failed:', text.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.error('💥 Request error:', error.message);
    return false;
  }
}

async function testHGHFeed() {
  // Test with first HGH feed GUID
  const feedGuid = '86f9ba78-7c4a-5bd2-a382-c6a88e9a96a0'; // First HGH track
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  const headers = generateAuthHeaders();
  
  console.log('\n🧪 Testing with first HGH feed GUID...');
  console.log(`📡 URL: ${url}`);
  
  try {
    const response = await fetch(url, { headers });
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ HGH feed found!');
      console.log(`🎙️ Feed: ${data.feed?.title || 'Unknown'}`);
      console.log(`🆔 Feed ID: ${data.feed?.id || 'Unknown'}`);
      return data.feed;
    } else {
      const text = await response.text();
      console.log('❌ HGH feed lookup failed:', text.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error('💥 Request error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔧 Simple API test...\n');
  
  // Test 1: Known good feed
  const itdvWorks = await testKnownGoodFeed();
  
  if (!itdvWorks) {
    console.log('❌ API authentication or connection issue');
    return;
  }
  
  // Wait between calls
  console.log('⏳ Waiting 5 seconds between calls...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: HGH feed
  const hghFeed = await testHGHFeed();
  
  if (hghFeed) {
    console.log('\n🎉 Success! HGH feeds ARE in the Podcast Index!');
    console.log('💡 The rate limiting was the issue, not missing feeds.');
  } else {
    console.log('\n🤔 HGH feed not found, but API is working for ITDV feeds');
  }
}

main().catch(console.error);