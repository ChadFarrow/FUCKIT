#!/usr/bin/env node

/**
 * Diagnostic script to fix Bunny.net CDN 403 errors
 * This script helps identify and resolve CDN configuration issues
 */

const https = require('https');

// Configuration
const CDN_URL = 'https://re-podtards.b-cdn.net';
const STORAGE_URL = 'https://ny.storage.bunnycdn.com/re-podtards-storage';
const TEST_FEED = '/feeds/music-from-the-doerfelverse.xml';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
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

async function diagnoseCDN() {
  console.log('🔍 Diagnosing Bunny.net CDN Configuration...\n');
  
  try {
    // Test 1: CDN access (should be 403 currently)
    console.log('1️⃣ Testing CDN access...');
    const cdnResult = await makeRequest(CDN_URL + TEST_FEED);
    console.log(`   CDN URL: ${cdnResult.url}`);
    console.log(`   Status: ${cdnResult.statusCode} ${cdnResult.statusCode === 200 ? '✅' : '❌'}`);
    
    if (cdnResult.statusCode === 403) {
      console.log('   ⚠️  CDN returning 403 - Pull Zone not configured');
    } else if (cdnResult.statusCode === 200) {
      console.log('   ✅ CDN working correctly!');
    }
    
    // Test 2: Storage access (should be 401 - requires auth)
    console.log('\n2️⃣ Testing Storage access...');
    const storageResult = await makeRequest(STORAGE_URL + TEST_FEED);
    console.log(`   Storage URL: ${storageResult.url}`);
    console.log(`   Status: ${storageResult.statusCode} ${storageResult.statusCode === 401 ? '✅' : '❌'}`);
    
    if (storageResult.statusCode === 401) {
      console.log('   ✅ Storage requires authentication (expected)');
    }
    
    // Test 3: Main CDN domain
    console.log('\n3️⃣ Testing main CDN domain...');
    const mainCdnResult = await makeRequest(CDN_URL);
    console.log(`   Main CDN: ${mainCdnResult.url}`);
    console.log(`   Status: ${mainCdnResult.statusCode} ${mainCdnResult.statusCode === 200 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.error}`);
  }
  
  console.log('\n📋 DIAGNOSIS SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Problem: RSS feeds returning 403 Forbidden');
  console.log('🔧 Root Cause: Missing Pull Zone configuration');
  console.log('📦 Current State: RSS feeds in Storage (requires auth)');
  console.log('🎯 Solution: Create Pull Zone to bridge Storage → CDN');
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Login to Bunny.net Dashboard: https://dash.bunny.net/');
  console.log('2. Go to CDN → Pull Zones');
  console.log('3. Click "Add Pull Zone"');
  console.log('4. Configure:');
  console.log('   - Name: re-podtards-feeds');
  console.log('   - Origin Type: Storage Zone');
  console.log('   - Origin URL: re-podtards-storage');
  console.log('   - Zone: re-podtards');
  console.log('5. Test again: node scripts/fix-cdn-config.js');
  
  console.log('\n🔧 ALTERNATIVE SOLUTION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('If Pull Zone is complex, upload RSS feeds directly to CDN:');
  console.log('1. Go to CDN → re-podtards → Files');
  console.log('2. Create /feeds/ folder');
  console.log('3. Upload RSS XML files directly');
  console.log('4. Re-enable CDN in app/page.tsx');
  
  console.log('\n📞 Need help? Check BUNNY_CDN_SETUP.md for detailed instructions');
}

// Run the diagnosis
diagnoseCDN().catch(console.error); 