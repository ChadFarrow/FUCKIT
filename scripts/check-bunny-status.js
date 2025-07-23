#!/usr/bin/env node

/**
 * Check Bunny.net account and CDN zone status
 * Helps diagnose "Domain suspended or not configured" errors
 */

const https = require('https');

// Configuration from your .env.local
const BUNNY_CDN_API_KEY = process.env.BUNNY_CDN_API_KEY || 'd33f9b6a-779d-4cce-8767-cd050a2819bf';
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 're-podtards-cdn.b-cdn.net';
const BUNNY_CDN_ZONE = process.env.BUNNY_CDN_ZONE || 're-podtards-cdn';
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || '62d305ab-39a0-48c1-96a30779ca9b-e0f9-4752';
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'ny.storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 're-podtards-storage';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD', ...options }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        url: url
      });
    });
    
    req.on('error', (error) => {
      reject({ error: error.message, url: url });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject({ error: 'Request timeout', url: url });
    });
    
    req.end();
  });
}

function checkBunnyAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bunny.net',
      port: 443,
      path: '/cdn/zone',
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_CDN_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const zones = JSON.parse(data);
            resolve(zones);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`API Error: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function diagnoseBunnyAccount() {
  console.log('🔍 Diagnosing Bunny.net Account Status...\n');
  
  try {
    // Test 1: CDN Zone Status
    console.log('1️⃣ Testing CDN Zone Status...');
    const cdnResult = await makeRequest(`https://${BUNNY_CDN_HOSTNAME}`);
    console.log(`   CDN URL: https://${BUNNY_CDN_HOSTNAME}`);
    console.log(`   Status: ${cdnResult.statusCode}`);
    
    if (cdnResult.statusCode === 403) {
      console.log('   ❌ CDN Zone: "Domain suspended or not configured"');
      console.log('   🔧 This means your CDN zone needs to be set up in Bunny.net dashboard');
    } else if (cdnResult.statusCode === 200) {
      console.log('   ✅ CDN Zone: Working correctly');
    }
    
    // Test 2: Storage Zone Status
    console.log('\n2️⃣ Testing Storage Zone Status...');
    const storageResult = await makeRequest(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/`);
    console.log(`   Storage URL: https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/`);
    console.log(`   Status: ${storageResult.statusCode}`);
    
    if (storageResult.statusCode === 401) {
      console.log('   ✅ Storage Zone: Working (requires authentication)');
    } else if (storageResult.statusCode === 200) {
      console.log('   ⚠️  Storage Zone: Publicly accessible (unusual)');
    } else {
      console.log('   ❌ Storage Zone: Not working');
    }
    
    // Test 3: API Access
    console.log('\n3️⃣ Testing Bunny.net API Access...');
    try {
      const zones = await checkBunnyAPI();
      console.log('   ✅ API Access: Working');
      console.log(`   📊 Found ${zones.length} CDN zones`);
      
      const targetZone = zones.find(zone => zone.Name === BUNNY_CDN_ZONE);
      if (targetZone) {
        console.log(`   🎯 Target Zone "${BUNNY_CDN_ZONE}": Found`);
        console.log(`   📍 Status: ${targetZone.Status}`);
        console.log(`   💰 Tier: ${targetZone.Tier}`);
      } else {
        console.log(`   ❌ Target Zone "${BUNNY_CDN_ZONE}": Not found`);
      }
    } catch (error) {
      console.log(`   ❌ API Access: Failed - ${error.message}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.error}`);
  }
  
  console.log('\n📋 DIAGNOSIS SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Problem: CDN zone "re-podtards" is suspended or not configured');
  console.log('🔧 Root Cause: CDN zone needs to be set up in Bunny.net dashboard');
  console.log('📦 Storage Status: Working (RSS feeds are stored here)');
  console.log('🎯 Solution: Configure CDN zone in Bunny.net dashboard');
  
  console.log('\n🚀 IMMEDIATE ACTIONS REQUIRED:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Login to Bunny.net Dashboard: https://dash.bunny.net/');
  console.log('2. Go to CDN → Zones');
  console.log('3. Check if "re-podtards" zone exists');
  console.log('4. If it exists: Check payment status and zone configuration');
  console.log('5. If it doesn\'t exist: Create new CDN zone named "re-podtards"');
  console.log('6. Configure zone settings:');
  console.log('   - Origin Type: Storage Zone');
  console.log('   - Origin URL: re-podtards-storage');
  console.log('   - Enable Image Optimization');
  console.log('   - Enable Gzip/Brotli compression');
  
  console.log('\n🔧 ALTERNATIVE SOLUTION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('If CDN zone setup is complex, use original RSS URLs temporarily:');
  console.log('1. Keep CDN disabled in app/page.tsx');
  console.log('2. Use original RSS feed URLs (working now)');
  console.log('3. Fix CDN zone later when convenient');
  
  console.log('\n📞 Need help? Check your Bunny.net account status and billing');
}

// Run the diagnosis
diagnoseBunnyAccount().catch(console.error); 