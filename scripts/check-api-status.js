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

async function checkDifferentEndpoints() {
  console.log('🔍 Checking different API endpoints to see rate limit status...\n');
  
  const endpoints = [
    { name: 'Stats', url: 'https://api.podcastindex.org/api/1.0/stats/current', needsAuth: false },
    { name: 'Categories', url: 'https://api.podcastindex.org/api/1.0/categories/list', needsAuth: true },
    { name: 'Recent Episodes', url: 'https://api.podcastindex.org/api/1.0/recent/episodes?max=1', needsAuth: true }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🧪 Testing ${endpoint.name}...`);
      
      const headers = endpoint.needsAuth ? generateAuthHeaders() : { 'User-Agent': 'PodcastMusicSite/1.0' };
      
      const response = await fetch(endpoint.url, { headers });
      
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 200) {
        console.log('✅ This endpoint is working!');
        const data = await response.json();
        console.log('📋 Response keys:', Object.keys(data));
      } else if (response.status === 429) {
        console.log('❌ Still rate limited on this endpoint');
      } else {
        const text = await response.text();
        console.log(`❌ Error: ${text.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.error(`💥 ${endpoint.name} failed: ${error.message}`);
    }
    
    console.log(''); // Empty line
    
    // Wait between endpoint tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Try a very simple search query
  console.log('🧪 Testing simple search (no GUID lookup)...');
  try {
    const searchUrl = 'https://api.podcastindex.org/api/1.0/search/byterm?q=music&max=1';
    const headers = generateAuthHeaders();
    
    const response = await fetch(searchUrl, { headers });
    console.log(`📊 Search Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ Search is working! Rate limit may be specific to GUID lookups');
    } else if (response.status === 429) {
      console.log('❌ All API access is rate limited');
    }
    
  } catch (error) {
    console.error(`💥 Search failed: ${error.message}`);
  }
}

checkDifferentEndpoints();