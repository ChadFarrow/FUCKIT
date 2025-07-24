#!/usr/bin/env node

const https = require('https');

// Get API key from environment variable
const API_KEY = process.env.BUNNY_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: BUNNY_API_KEY environment variable not set');
  console.log('💡 Set it with: export BUNNY_API_KEY="your-api-key"');
  process.exit(1);
}

const PULL_ZONE_ID = process.env.BUNNY_PULL_ZONE_ID || '4240975';
const STORAGE_ZONE_ID = process.env.BUNNY_STORAGE_ZONE_ID || '1120580';

function checkPullZone() {
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
          
          console.log('\n🎯 Status: Pull Zone is properly configured');
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
}

function checkStorageZone() {
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
}

// Check command line arguments
const command = process.argv[2];

if (command === 'pullzone') {
  checkPullZone();
} else if (command === 'storagezone') {
  checkStorageZone();
} else {
  console.log('🔍 Bunny.net Status Checker (Secure)');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/check-bunny-status-secure.js pullzone    # Check Pull Zone');
  console.log('  node scripts/check-bunny-status-secure.js storagezone # Check Storage Zone');
  console.log('');
  console.log('Environment Variables:');
  console.log('  BUNNY_API_KEY          - Your Bunny.net API key (required)');
  console.log('  BUNNY_PULL_ZONE_ID     - Pull Zone ID (default: 4240975)');
  console.log('  BUNNY_STORAGE_ZONE_ID  - Storage Zone ID (default: 1120580)');
  console.log('');
  console.log('Example:');
  console.log('  export BUNNY_API_KEY="your-api-key"');
  console.log('  node scripts/check-bunny-status-secure.js pullzone');
} 