#!/usr/bin/env node

/**
 * Setup Bunny.net Pull Zone via API
 * 
 * This script creates a Pull Zone to bridge Storage → CDN
 * so that images can be served publicly.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.log('⚠️  Could not load .env.local file:', error.message);
  }
}

// Load environment variables
loadEnvFile();

// Configuration - Update these with your actual values
const API_KEY = process.env.BUNNY_CDN_API_KEY;
const ZONE_NAME = process.env.BUNNY_CDN_ZONE || 're-podtards';
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 're-podtards-cache';

if (!API_KEY) {
  console.log('❌ BUNNY_CDN_API_KEY environment variable not set');
  console.log('📝 Please check your .env.local file contains:');
  console.log('   BUNNY_CDN_API_KEY=your-api-key-here');
  process.exit(1);
}

console.log('✅ API key loaded successfully');

const createData = JSON.stringify({
  Name: `${ZONE_NAME}-albums`,
  OriginUrl: `https://ny.storage.bunnycdn.com/${STORAGE_ZONE}`,
  OriginType: 0,  // HTTP URL
  Type: 1,
  EnableGeoZoneUS: true,
  EnableGeoZoneEU: true,
  EnableGeoZoneASIA: true,
  EnableGeoZoneSA: true,
  EnableGeoZoneAF: true,
  // Security settings for public access
  AccessControlOriginHeaderExtensions: [],
  EnableAccessControlOriginHeader: false,
  EnableTokenAuthentication: false,
  // Optimization settings
  EnableWebPVary: true,
  EnableAvifVary: true,
  EnableCacheSlice: true,
  EnableCacheControl: true,
  CacheControlMaxAgeOverride: 3600
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

console.log('🔧 Creating Pull Zone for album images...');
console.log('📡 Configuration:', {
  Name: `${ZONE_NAME}-albums`,
  OriginUrl: `https://ny.storage.bunnycdn.com/${STORAGE_ZONE}`,
  Zone: ZONE_NAME
});

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
        console.log('\n✅ Pull Zone created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Details:');
        console.log(`   ID: ${response.Id}`);
        console.log(`   Name: ${response.Name}`);
        console.log(`   Origin URL: ${response.OriginUrl}`);
        console.log(`   Hostname: ${response.Hostnames?.[0]?.Value || 'Not assigned'}`);
        
        if (response.Hostnames?.[0]?.Value) {
          console.log('\n🎯 Test the new CDN:');
          console.log(`   curl -I "https://${response.Hostnames[0].Value}/albums/music-from-the-doerfel-verse-artwork.png"`);
          
          console.log('\n📝 Update your CDN configuration:');
          console.log(`   BUNNY_CDN_HOSTNAME=${response.Hostnames[0].Value}`);
        }
        
        console.log('\n🚀 Next steps:');
        console.log('1. Test the CDN URL above');
        console.log('2. Update your environment variables if needed');
        console.log('3. Restart your development server');
        
      } catch (e) {
        console.log('❌ Could not parse response:', e.message);
      }
    } else {
      console.log('❌ Pull Zone creation failed');
      console.log('📄 Error response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network error:', error.message);
});

req.write(createData);
req.end(); 