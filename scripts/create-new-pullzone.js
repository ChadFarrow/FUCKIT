#!/usr/bin/env node

const https = require('https');

const API_KEY = 'd33f9b6a-779d-4cce-8767-cd050a2819bf';

const createData = JSON.stringify({
  Name: 're-podtards-cdn-new',
  OriginUrl: 'https://ny.storage.bunnycdn.com/re-podtards-storage',
  OriginType: 0,  // HTTP URL (since we're using full URL)
  Type: 1,
  EnableGeoZoneUS: true,
  EnableGeoZoneEU: true,
  EnableGeoZoneASIA: true,
  EnableGeoZoneSA: true,
  EnableGeoZoneAF: true
});

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: '/pullzone',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': createData.length,
    'AccessKey': API_KEY
  }
};

console.log('🔧 Creating new Pull Zone...');
console.log('📡 Request:', createData);

const req = https.request(options, (res) => {
  console.log('📊 Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response:', data);
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const response = JSON.parse(data);
        console.log('✅ New Pull Zone created!');
        console.log('✅ ID:', response.Id);
        console.log('✅ Name:', response.Name);
        console.log('✅ OriginUrl:', response.OriginUrl);
        console.log('✅ OriginType:', response.OriginType);
        console.log('✅ Hostname:', response.Hostnames?.[0]?.Value);
        
        if (response.Hostnames?.[0]?.Value) {
          console.log('\n🎯 Test the new CDN:');
          console.log(`curl -I "https://${response.Hostnames[0].Value}/feeds/ableandthewolf-feed.xml"`);
        }
      } catch (e) {
        console.log('❌ Could not parse response');
      }
    } else {
      console.log('❌ Creation failed');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(createData);
req.end(); 