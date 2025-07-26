#!/usr/bin/env node

const https = require('https');

const PULL_ZONE_ID = '4240975'; // New Pull Zone ID
const API_KEY = process.env.BUNNY_CDN_API_KEY;

// Try to configure authentication for the Storage Zone
const updateData = JSON.stringify({
  OriginHostHeader: 'ny.storage.bunnycdn.com',
  AddHostHeader: true
});

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: `/pullzone/${PULL_ZONE_ID}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': updateData.length,
    'AccessKey': API_KEY
  }
};

console.log('🔧 Configuring CDN authentication...');
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
        console.log('✅ Updated AddHostHeader:', response.AddHostHeader);
        console.log('✅ Updated OriginHostHeader:', response.OriginHostHeader);
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