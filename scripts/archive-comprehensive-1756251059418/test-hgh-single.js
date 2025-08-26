#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔧 Testing single HGH track with same auth that worked for stats...\n');

function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  console.log('🔍 Auth details:');
  console.log('📋 API Key:', apiKey);
  console.log('📋 API Secret length:', apiSecret?.length);
  console.log('📅 Timestamp:', unixTime);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  console.log('🔐 Generated hash:', hash);
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function testHGHFeed() {
  // Use the first HGH track GUID
  const feedGuid = '86f9ba78-7c4a-5bd2-a382-c6a88e9a96a0';
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  
  console.log(`🔍 Testing HGH feed lookup...`);
  console.log(`📡 URL: ${url}`);
  console.log(`🆔 Feed GUID: ${feedGuid}`);
  
  const headers = generateAuthHeaders();
  console.log('\n📤 Request headers:');
  console.log(JSON.stringify(headers, null, 2));
  
  try {
    const response = await fetch(url, { headers });
    console.log(`\n📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Feed lookup successful!');
      console.log(`🎙️ Feed title: ${data.feed?.title || 'Unknown'}`);
      console.log(`🆔 Feed ID: ${data.feed?.id || 'Unknown'}`);
      console.log(`🔗 Feed URL: ${data.feed?.url || 'Unknown'}`);
      console.log('📋 Response structure:', Object.keys(data));
      return data.feed;
    } else {
      const text = await response.text();
      console.log('❌ Feed lookup failed:');
      console.log(text.substring(0, 300));
      return null;
    }
  } catch (error) {
    console.error('💥 Request error:', error.message);
    return null;
  }
}

testHGHFeed();