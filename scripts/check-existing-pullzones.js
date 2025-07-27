#!/usr/bin/env node

/**
 * Check existing Bunny.net Pull Zones
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

loadEnvFile();

const API_KEY = process.env.BUNNY_CDN_API_KEY;

if (!API_KEY) {
  console.log('❌ BUNNY_CDN_API_KEY not found');
  process.exit(1);
}

const options = {
  hostname: 'api.bunny.net',
  port: 443,
  path: '/pullzone',
  method: 'GET',
  headers: {
    'AccessKey': API_KEY
  }
};

console.log('🔍 Checking existing Pull Zones...');

const req = https.request(options, (res) => {
  console.log('📊 Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const pullZones = JSON.parse(data);
        console.log('\n✅ Found Pull Zones:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (pullZones.length === 0) {
          console.log('📭 No Pull Zones found');
        } else {
          pullZones.forEach((zone, index) => {
            console.log(`${index + 1}. ${zone.Name}`);
            console.log(`   ID: ${zone.Id}`);
            console.log(`   Origin: ${zone.OriginUrl}`);
            console.log(`   Hostname: ${zone.Hostnames?.[0]?.Value || 'None'}`);
            console.log(`   Type: ${zone.Type}`);
            console.log('');
          });
        }
        
        // Check if we already have a suitable Pull Zone
        const albumsZone = pullZones.find(zone => 
          zone.Name.includes('albums') || 
          zone.OriginUrl.includes('re-podtards-cache')
        );
        
        if (albumsZone) {
          console.log('🎯 Found existing Pull Zone for albums!');
          console.log(`   Name: ${albumsZone.Name}`);
          console.log(`   Hostname: ${albumsZone.Hostnames?.[0]?.Value || 'None'}`);
          console.log('\n🚀 Test it with:');
          console.log(`   curl -I "https://${albumsZone.Hostnames?.[0]?.Value || 'your-hostname'}/albums/music-from-the-doerfel-verse-artwork.png"`);
        }
        
      } catch (e) {
        console.log('❌ Could not parse response:', e.message);
        console.log('📄 Raw response:', data);
      }
    } else {
      console.log('❌ Failed to get Pull Zones');
      console.log('📄 Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network error:', error.message);
});

req.end(); 