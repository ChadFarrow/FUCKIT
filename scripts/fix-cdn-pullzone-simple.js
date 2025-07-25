#!/usr/bin/env node

/**
 * Simple CDN Fix - Copy feeds from storage to main CDN zone
 * Since the Pull Zone configuration API isn't working, we'll copy the feeds 
 * from storage to the main CDN zone so they're accessible.
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const CDN_API_KEY = process.env.BUNNY_CDN_API_KEY;
const STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME;
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const CDN_ZONE_ID = '4228588'; // From the pull zone listing

// Test feeds to copy
const TEST_FEEDS = [
  'music-from-the-doerfelverse.xml',
  'bloodshot-lies-album.xml',
  'intothedoerfelverse.xml',
  'ableandthewolf-feed.xml',
  'doerfels-pubfeed.xml'
];

function makeStorageRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STORAGE_HOSTNAME,
      path: `/${STORAGE_ZONE}${path}`,
      method: method,
      headers: {
        'AccessKey': STORAGE_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: responseData,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

function makeCDNRequest(path, method = 'PUT', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bunny.net',
      path: `/storagezone/${CDN_ZONE_ID}/files${path}`,
      method: method,
      headers: {
        'AccessKey': CDN_API_KEY,
        'Content-Type': 'application/xml'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

async function copyFeedsToCDN() {
  console.log('🔄 Copying RSS feeds from Storage to CDN zone...\n');

  let successCount = 0;
  let failCount = 0;

  for (const feedFile of TEST_FEEDS) {
    try {
      console.log(`📡 Processing: ${feedFile}`);
      
      // Download from storage
      const storageResult = await makeStorageRequest(`/feeds/${feedFile}`);
      
      if (storageResult.statusCode !== 200) {
        console.log(`   ❌ Failed to read from storage: ${storageResult.statusCode}`);
        failCount++;
        continue;
      }
      
      console.log(`   ✅ Downloaded from storage (${storageResult.data.length} bytes)`);
      
      // Upload to CDN zone
      const cdnResult = await makeCDNRequest(`/feeds/${feedFile}`, 'PUT', storageResult.data);
      
      if (cdnResult.statusCode === 200 || cdnResult.statusCode === 201) {
        console.log(`   ✅ Uploaded to CDN zone`);
        successCount++;
      } else {
        console.log(`   ❌ Failed to upload to CDN: ${cdnResult.statusCode}`);
        console.log(`   📄 Response: ${cdnResult.data.substring(0, 100)}`);
        failCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing ${feedFile}: ${error.message}`);
      failCount++;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Copy Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (successCount > 0) {
    console.log('\n🧪 Testing CDN access...');
    
    // Test one feed
    const testUrl = 'https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml';
    console.log(`🔗 Test URL: ${testUrl}`);
    
    const { spawn } = require('child_process');
    const curl = spawn('curl', ['-I', testUrl]);
    
    curl.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('HTTP/2 200')) {
        console.log('🎉 SUCCESS! RSS feeds are now accessible via CDN!');
      } else if (output.includes('HTTP/2')) {
        console.log(`📄 Response: ${output.split('\n')[0]}`);
        console.log('⏱️  May need a few minutes for CDN cache to update');
      }
    });

    curl.on('close', (code) => {
      console.log('\n✅ Copy operation completed!');
      console.log('\n🎯 NEXT STEPS:');
      console.log('1. Wait 2-3 minutes for CDN propagation');
      console.log('2. Test RSS feed access via CDN');
      console.log('3. If working, re-enable CDN in app/page.tsx');
    });
  }
}

// Run the copy operation
copyFeedsToCDN().catch(console.error);