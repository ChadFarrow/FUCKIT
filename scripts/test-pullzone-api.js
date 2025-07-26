#!/usr/bin/env node

const https = require('https');

const PULL_ZONE_ID = '4228588';
const API_KEY = process.env.BUNNY_CDN_API_KEY;

const updateData = JSON.stringify({
  OriginUrl: 're-podtards-storage',
  OriginType: 1
});

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: `/pullzone/${PULL_ZONE_ID}`,
  method: 'PATCH',  // Try PATCH instead of POST
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': updateData.length,
    'AccessKey': API_KEY
  }
};

console.log('🔧 Testing Pull Zone API update with PATCH...');
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
        console.log('✅ OriginUrl:', response.OriginUrl);
        console.log('✅ OriginType:', response.OriginType);
      } catch (e) {
        console.log('❌ Could not parse response');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(updateData);
req.end(); 