#!/usr/bin/env node

const https = require('https');

const STORAGE_ZONE_ID = '1120580';
const API_KEY = 'd33f9b6a-779d-4cce-8767-cd050a2819bf';

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: `/storagezone/${STORAGE_ZONE_ID}`,
  method: 'GET',
  headers: {
    'AccessKey': API_KEY
  }
};

console.log('🔍 Checking Storage Zone status...');

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
        console.log('\n📋 Storage Zone Configuration:');
        console.log('✅ Name:', response.Name);
        console.log('✅ Region:', response.Region);
        console.log('✅ Password:', response.Password ? 'Set' : 'Not Set');
        console.log('✅ ReadOnlyPassword:', response.ReadOnlyPassword ? 'Set' : 'Not Set');
        console.log('✅ ReplicationRegions:', response.ReplicationRegions?.join(', ') || 'None');
        console.log('✅ FilesStored:', response.FilesStored);
        console.log('✅ StorageUsed:', response.StorageUsed);
        
        console.log('\n🎯 Status: Storage Zone is properly configured');
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