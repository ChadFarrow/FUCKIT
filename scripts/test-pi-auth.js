#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔑 Testing PodcastIndex API authentication...');
console.log(`API Key: ${PODCAST_INDEX_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`API Secret: ${PODCAST_INDEX_API_SECRET ? '✅ Set' : '❌ Missing'}`);

function generateAuthHeader() {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp);
  const hash4 = hash.digest('hex');
  
  const headers = {
    'User-Agent': 'PodtardsArtworkFixer/1.0',
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash4
  };
  
  console.log('🔐 Generated headers:', headers);
  return headers;
}

async function testAPI() {
  try {
    const headers = generateAuthHeader();
    const testGuid = '378ffb10-c09a-5fe2-a95b-65aa8279e91b';
    
    console.log(`\n🌐 Testing API call to: https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${testGuid}`);
    
    const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${testGuid}`, {
      headers
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response:`, errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Success! Feed data:`, JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAPI();
