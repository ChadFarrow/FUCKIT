#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔧 Testing authentication with new credentials...\n');

console.log('📋 API Key:', PODCAST_INDEX_API_KEY);
console.log('📋 API Secret length:', PODCAST_INDEX_API_SECRET?.length || 'undefined');
console.log('📋 API Secret preview:', PODCAST_INDEX_API_SECRET?.substring(0, 10) + '...' || 'undefined');

function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  console.log('\n🔍 Auth generation details:');
  console.log('📅 Unix timestamp:', unixTime);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  
  console.log('📝 Hash input length:', data4Hash.length);
  console.log('📝 Hash input preview:', data4Hash.substring(0, 20) + '...');
  
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  console.log('🔐 Generated hash:', hash);
  
  const headers = {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
  
  console.log('\n📤 Headers to send:');
  console.log(JSON.stringify(headers, null, 2));
  
  return headers;
}

async function testAuth() {
  const headers = generateAuthHeaders();
  
  // Test with a simple endpoint
  const url = 'https://api.podcastindex.org/api/1.0/stats/current';
  
  console.log('\n🧪 Testing stats endpoint...');
  console.log('📡 URL:', url);
  
  try {
    const response = await fetch(url, { headers });
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Authentication successful!');
      const data = await response.json();
      console.log('📋 API is working, stats:', Object.keys(data));
      return true;
    } else {
      const text = await response.text();
      console.log('❌ Auth failed:', text.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.error('💥 Request failed:', error.message);
    return false;
  }
}

testAuth();