#!/usr/bin/env node

const https = require('https');

const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;

function testDirectAccess() {
  const options = {
    hostname: 'ny.storage.bunnycdn.com',
    port: 443,
    path: '/re-podtards-storage/feeds/ableandthewolf-feed.xml',
    method: 'GET',
    headers: {
      'AccessKey': STORAGE_API_KEY
    }
  };

  console.log('🔧 Testing direct Storage Zone access...');

  const req = https.request(options, (res) => {
    console.log('📊 Status:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Success! RSS feed content length:', data.length);
        console.log('📄 First 200 characters:', data.substring(0, 200));
      } else {
        console.log('❌ Failed to access Storage Zone');
        console.log('📄 Response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error:', error);
  });

  req.end();
}

testDirectAccess(); 