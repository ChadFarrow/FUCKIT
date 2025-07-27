#!/usr/bin/env node

/**
 * Check if RSS feeds exist in Bunny Storage
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'ny.storage.bunnycdn.com';
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;

if (!STORAGE_API_KEY || !STORAGE_ZONE) {
  console.error('❌ Storage configuration missing from .env.local');
  console.error('Required: BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_ZONE');
  process.exit(1);
}

function makeStorageRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STORAGE_HOSTNAME,
      path: `/${STORAGE_ZONE}${path}`,
      method: 'GET',
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

async function checkStorageFeeds() {
  console.log('🗂️  Checking RSS feeds in Bunny Storage...\n');
  console.log(`📦 Storage Zone: ${STORAGE_ZONE}`);
  console.log(`🌐 Storage Host: ${STORAGE_HOSTNAME}`);
  console.log('');

  try {
    // Check if /feeds/ directory exists
    console.log('1️⃣ Checking /feeds/ directory...');
    const feedsDir = await makeStorageRequest('/feeds/');
    
    if (feedsDir.statusCode === 200) {
      console.log('   ✅ /feeds/ directory exists');
      
      // Try to parse the directory listing
      try {
        const files = JSON.parse(feedsDir.data);
        console.log(`   📁 Found ${files.length} items in /feeds/`);
        
        // List first few files
        files.slice(0, 5).forEach((file, index) => {
          const type = file.IsDirectory ? '📁' : '📄';
          const size = file.IsDirectory ? '' : ` (${file.Length} bytes)`;
          console.log(`   ${index + 1}. ${type} ${file.ObjectName}${size}`);
        });
        
        if (files.length > 5) {
          console.log(`   ... and ${files.length - 5} more items`);
        }
        
      } catch (parseError) {
        console.log('   📄 Directory listing (raw):', feedsDir.data.substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ /feeds/ directory not accessible: ${feedsDir.statusCode}`);
      console.log(`   📄 Response: ${feedsDir.data.substring(0, 200)}`);
    }

    // Test specific RSS feed
    console.log('\n2️⃣ Testing specific RSS feed...');
    const testFeed = '/feeds/music-from-the-doerfelverse.xml';
    const feedResult = await makeStorageRequest(testFeed);
    
    if (feedResult.statusCode === 200) {
      console.log(`   ✅ RSS feed accessible: ${testFeed}`);
      console.log(`   📏 Size: ${feedResult.headers['content-length'] || 'Unknown'} bytes`);
      console.log(`   📄 Content-Type: ${feedResult.headers['content-type'] || 'Unknown'}`);
      
      // Show first line of RSS content
      const firstLine = feedResult.data.split('\n')[0];
      console.log(`   📝 First line: ${firstLine}`);
    } else {
      console.log(`   ❌ RSS feed not accessible: ${feedResult.statusCode}`);
      console.log(`   📄 Response: ${feedResult.data.substring(0, 200)}`);
    }

    // Check if we can access from CDN
    console.log('\n3️⃣ Testing CDN access to storage...');
    
    // Create direct storage URL
    const directStorageUrl = `https://${STORAGE_HOSTNAME}/${STORAGE_ZONE}/feeds/music-from-the-doerfelverse.xml`;
    console.log(`   🔗 Direct URL: ${directStorageUrl}`);
    
    const { spawn } = require('child_process');
    const curl = spawn('curl', ['-I', '-H', `AccessKey: ${STORAGE_API_KEY}`, directStorageUrl]);
    
    let curlOutput = '';
    curl.stdout.on('data', (data) => {
      curlOutput += data.toString();
    });
    
    curl.on('close', (code) => {
      if (curlOutput.includes('HTTP/2 200') || curlOutput.includes('HTTP/1.1 200')) {
        console.log('   ✅ Storage accessible via direct URL');
      } else {
        console.log('   ❌ Storage not accessible via direct URL');
        console.log(`   📄 Response: ${curlOutput.split('\n')[0]}`);
      }
      
      console.log('\n📋 SUMMARY:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (feedResult.statusCode === 200) {
        console.log('✅ RSS feeds are properly stored in Bunny Storage');
        console.log('🔧 CDN Pull Zone needs configuration to serve from storage');
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Configure CDN Pull Zone origin to point to storage');
        console.log('2. Or upload RSS feeds directly to CDN zone');
        console.log('3. Test CDN access after configuration');
      } else {
        console.log('❌ RSS feeds not found in storage');
        console.log('📦 Need to upload RSS feeds to storage first');
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Run RSS feed upload script');
        console.log('2. Verify feeds are in storage');
        console.log('3. Configure CDN Pull Zone');
      }
    });

  } catch (error) {
    console.error('❌ Error checking storage:', error.message);
  }
}

// Run the check
checkStorageFeeds();