#!/usr/bin/env node

const https = require('https');

const PULL_ZONE_ID = '4228588';
const API_KEY = process.env.BUNNY_CDN_API_KEY;

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: `/pullzone/${PULL_ZONE_ID}`,
  method: 'GET',
  headers: {
    'AccessKey': API_KEY
  }
};

console.log('🔍 Checking Pull Zone status...');

const req = https.request(options, (res) => {
  console.log('📊 Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        console.log('\n📋 Pull Zone Configuration:');
        console.log('✅ Name:', response.Name);
        console.log('✅ Enabled:', response.Enabled);
        console.log('✅ Suspended:', response.Suspended);
        console.log('✅ OriginUrl:', response.OriginUrl);
        console.log('✅ OriginType:', response.OriginType);
        console.log('✅ StorageZoneId:', response.StorageZoneId);
        console.log('✅ Type:', response.Type);
        console.log('✅ Hostnames:', response.Hostnames?.map(h => h.Value).join(', '));
        
        if (response.OriginType === 0) {
          console.log('\n🔧 Current: Pulling from HTTP URL');
        } else if (response.OriginType === 1) {
          console.log('\n🔧 Current: Pulling from Storage Zone');
        }
        
        console.log('\n🎯 To fix: Change OriginType from 0 to 1 and OriginUrl to "re-podtards-storage"');
      } catch (e) {
        console.log('❌ Could not parse response:', data);
      }
    } else {
      console.log('❌ Error response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.end(); 