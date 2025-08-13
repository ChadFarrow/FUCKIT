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

async function generateAuthHeader() {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp);
  const hash4 = hash.digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Feed-Tester/1.0',
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash4
  };
}

async function testFeed(feedGuid) {
  try {
    const headers = await generateAuthHeader();
    console.log(`🔍 Testing feed GUID: ${feedGuid}`);
    
    const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${feedGuid}`, {
      headers
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response:`, errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ API Response:`, JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  // Test a few feed GUIDs from our tracks
  const testGuids = [
    'f446aaea-c40e-553b-b212-8e0525bcab59', // Snakecharmer
    '1df430e3-20f6-595e-9af2-8f9d5123c19b', // Hammslamm
    '419b741c-a3de-5e39-acb4-74bda853510b'  // Lidless Sky
  ];
  
  for (const guid of testGuids) {
    await testFeed(guid);
    console.log('---');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch(console.error);
