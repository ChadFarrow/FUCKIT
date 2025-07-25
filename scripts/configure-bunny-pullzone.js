#!/usr/bin/env node

/**
 * Bunny.net Pull Zone Configuration Script
 * Configures RSS feeds CDN Pull Zone to serve from Storage
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.BUNNY_CDN_API_KEY;
const ZONE_NAME = 're-podtards-cdn';
const STORAGE_ZONE = 're-podtards-storage';

if (!API_KEY) {
  console.error('❌ BUNNY_CDN_API_KEY not found in .env.local');
  process.exit(1);
}

function makeAPIRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bunny.net',
      path: endpoint,
      method: method,
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

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

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function configurePullZone() {
  console.log('🔧 Configuring Bunny.net Pull Zone for RSS Feeds...\n');

  try {
    // Step 1: List existing pull zones
    console.log('1️⃣ Checking existing Pull Zones...');
    const pullZones = await makeAPIRequest('/pullzone');
    
    if (pullZones.statusCode !== 200) {
      console.error(`❌ Failed to fetch pull zones: ${pullZones.statusCode}`);
      console.error(pullZones.raw);
      return;
    }

    console.log(`   Found ${pullZones.data.length} existing pull zones`);
    
    // Find our main pull zone
    const mainPullZone = pullZones.data.find(pz => pz.Name === ZONE_NAME);
    if (!mainPullZone) {
      console.error(`❌ Main pull zone '${ZONE_NAME}' not found`);
      return;
    }
    
    console.log(`   ✅ Found main pull zone: ${mainPullZone.Name} (ID: ${mainPullZone.Id})`);
    console.log(`   📡 Hostname: ${mainPullZone.Hostnames[0]?.Value || 'N/A'}`);

    // Step 2: Check if feeds subdirectory configuration exists
    console.log('\n2️⃣ Checking Pull Zone configuration...');
    
    // Get detailed pull zone info
    const pullZoneDetails = await makeAPIRequest(`/pullzone/${mainPullZone.Id}`);
    if (pullZoneDetails.statusCode !== 200) {
      console.error(`❌ Failed to get pull zone details: ${pullZoneDetails.statusCode}`);
      return;
    }

    console.log(`   📋 Origin URL: ${pullZoneDetails.data.OriginUrl}`);
    console.log(`   🔧 Origin Type: ${pullZoneDetails.data.Type === 0 ? 'Standard' : 'Storage'}`);

    // Step 3: Configure origin rules for /feeds/ path
    console.log('\n3️⃣ Configuring origin rules for /feeds/ path...');
    
    // Add origin rule to serve /feeds/ from storage
    const originRule = {
      ActionType: 1, // Override origin
      TriggerMatchingType: 0, // Any
      PatternMatches: ['/feeds/*'],
      ActionParameter1: `https://ny.storage.bunnycdn.com/${STORAGE_ZONE}`,
      Enabled: true,
      Description: 'Serve RSS feeds from storage'
    };

    const addRuleResponse = await makeAPIRequest(
      `/pullzone/${mainPullZone.Id}/originrule`,
      'POST',
      originRule
    );

    if (addRuleResponse.statusCode === 201 || addRuleResponse.statusCode === 200) {
      console.log('   ✅ Origin rule added successfully');
    } else if (addRuleResponse.statusCode === 400 && addRuleResponse.raw.includes('already exists')) {
      console.log('   ✅ Origin rule already exists');
    } else {
      console.log(`   ⚠️  Origin rule response: ${addRuleResponse.statusCode}`);
      console.log(`   📄 Response: ${addRuleResponse.raw}`);
    }

    // Step 4: Purge cache to apply changes
    console.log('\n4️⃣ Purging CDN cache...');
    const purgeResponse = await makeAPIRequest(`/pullzone/${mainPullZone.Id}/purgeCache`, 'POST');
    
    if (purgeResponse.statusCode === 200 || purgeResponse.statusCode === 204) {
      console.log('   ✅ Cache purged successfully');
    } else {
      console.log(`   ⚠️  Cache purge response: ${purgeResponse.statusCode}`);
    }

    // Step 5: Test the configuration
    console.log('\n5️⃣ Testing RSS feed access...');
    
    // Wait a moment for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const testFeedUrl = `https://${mainPullZone.Hostnames[0]?.Value}/feeds/music-from-the-doerfelverse.xml`;
    console.log(`   🧪 Testing: ${testFeedUrl}`);
    
    // Use curl to test (since we need to test from outside)
    const { spawn } = require('child_process');
    const curl = spawn('curl', ['-I', testFeedUrl]);
    
    curl.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('HTTP/2 200')) {
        console.log('   ✅ RSS feed accessible via CDN!');
      } else if (output.includes('HTTP/2 404')) {
        console.log('   ⚠️  Still getting 404 - may need time to propagate');
      } else if (output.includes('HTTP/2')) {
        console.log(`   📄 Response: ${output.split('\n')[0]}`);
      }
    });

    curl.on('close', (code) => {
      console.log('\n✅ Pull Zone configuration completed!');
      console.log('\n📋 SUMMARY:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🎯 Pull Zone: ${mainPullZone.Name}`);
      console.log(`📡 CDN Hostname: ${mainPullZone.Hostnames[0]?.Value}`);
      console.log(`🗂️  Storage Zone: ${STORAGE_ZONE}`);
      console.log('📄 RSS Feeds: /feeds/* → Storage Zone');
      console.log('\n🧪 Test RSS feed access:');
      console.log(`curl -I "${testFeedUrl}"`);
      console.log('\n⏱️  Note: CDN changes may take 1-2 minutes to fully propagate');
    });

  } catch (error) {
    console.error('❌ Error configuring pull zone:', error.message);
  }
}

// Run the configuration
configurePullZone();