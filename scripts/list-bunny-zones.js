#!/usr/bin/env node

/**
 * List existing Bunny.net Pull Zones and Storage Zones
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.BUNNY_CDN_API_KEY;
const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;

if (!API_KEY) {
  console.error('❌ BUNNY_CDN_API_KEY not found in .env.local');
  process.exit(1);
}

function makeAPIRequest(endpoint, apiKey = API_KEY) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bunny.net',
      path: endpoint,
      method: 'GET',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            raw: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: {},
            raw: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function listZones() {
  console.log('📋 Listing Bunny.net Zones...\n');

  try {
    // List Pull Zones
    console.log('🌐 PULL ZONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const pullZones = await makeAPIRequest('/pullzone');
    
    if (pullZones.statusCode !== 200) {
      console.error(`❌ Failed to fetch pull zones: ${pullZones.statusCode}`);
      console.error(pullZones.raw);
    } else {
      pullZones.data.forEach((zone, index) => {
        console.log(`${index + 1}. ${zone.Name} (ID: ${zone.Id})`);
        console.log(`   📡 Hostname: ${zone.Hostnames?.[0]?.Value || 'N/A'}`);
        console.log(`   🔗 Origin: ${zone.OriginUrl}`);
        console.log(`   📊 Type: ${zone.Type === 0 ? 'Standard' : 'Storage'}`);
        console.log(`   ✅ Enabled: ${zone.Enabled ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // List Storage Zones
    console.log('💾 STORAGE ZONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (STORAGE_API_KEY) {
      const storageZones = await makeAPIRequest('/storagezone', STORAGE_API_KEY);
      
      if (storageZones.statusCode !== 200) {
        console.error(`❌ Failed to fetch storage zones: ${storageZones.statusCode}`);
        console.error(storageZones.raw);
      } else {
        storageZones.data.forEach((zone, index) => {
          console.log(`${index + 1}. ${zone.Name} (ID: ${zone.Id})`);
          console.log(`   🌍 Region: ${zone.Region || 'N/A'}`);
          console.log(`   💿 Used Storage: ${zone.UsedStorage || 0} bytes`);
          console.log(`   🔗 Hostname: ${zone.Hostnames?.[0] || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      console.log('⚠️  BUNNY_STORAGE_API_KEY not found - skipping storage zones');
    }

  } catch (error) {
    console.error('❌ Error listing zones:', error.message);
  }
}

// Run the listing
listZones();