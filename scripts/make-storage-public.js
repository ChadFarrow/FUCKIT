#!/usr/bin/env node

const https = require('https');

const STORAGE_ZONE_ID = '1120580'; // From the earlier response
const API_KEY = '62d305ab-39a0-48c1-96a30779ca9b-e0f9-4752'; // Storage API key

// Try to make the Storage Zone public
const updateData = JSON.stringify({
  PublicRead: true
});

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: `/storagezone/${STORAGE_ZONE_ID}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': updateData.length,
    'AccessKey': API_KEY
  }
};

console.log('🔧 Making Storage Zone public...');
console.log('📡 Request:', updateData);

const req = https.request(options, (res) => {
  console.log('📊 Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response:', data);
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        console.log('✅ Updated PublicRead:', response.PublicRead);
      } catch (e) {
        console.log('❌ Could not parse response');
      }
    } else {
      console.log('❌ Update failed');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(updateData);
req.end(); 