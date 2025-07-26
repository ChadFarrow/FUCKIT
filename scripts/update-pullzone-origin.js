#!/usr/bin/env node

const https = require('https');

const PULL_ZONE_ID = '4228588';
const API_KEY = process.env.BUNNY_CDN_API_KEY;

// Try updating just the OriginUrl first
const updateData = JSON.stringify({
  OriginUrl: 're-podtards-storage'
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

console.log('🔧 Updating Pull Zone origin...');
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
        console.log('✅ Updated OriginUrl:', response.OriginUrl);
        console.log('✅ Updated OriginType:', response.OriginType);
        
        if (response.OriginUrl === 're-podtards-storage') {
          console.log('🎉 Success! Pull Zone now points to Storage Zone');
        } else {
          console.log('⚠️  OriginUrl not updated as expected');
        }
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