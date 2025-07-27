#!/usr/bin/env node

/**
 * Check what images are in Bunny Storage
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

async function checkStorageImages() {
  console.log('🖼️  Checking images in Bunny Storage...\n');
  console.log(`📦 Storage Zone: ${STORAGE_ZONE}`);
  console.log(`🌐 Storage Host: ${STORAGE_HOSTNAME}`);
  console.log('');

  try {
    // Check root directory
    console.log('1️⃣ Checking root directory...');
    const rootDir = await makeStorageRequest('/');
    
    if (rootDir.statusCode === 200) {
      console.log('   ✅ Root directory accessible');
      
      try {
        const files = JSON.parse(rootDir.data);
        console.log(`   📁 Found ${files.length} items in root`);
        
        files.forEach((file, index) => {
          const type = file.IsDirectory ? '📁' : '📄';
          const size = file.IsDirectory ? '' : ` (${file.Length} bytes)`;
          console.log(`   ${index + 1}. ${type} ${file.ObjectName}${size}`);
        });
        
      } catch (parseError) {
        console.log('   📄 Directory listing (raw):', rootDir.data.substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ Root directory not accessible: ${rootDir.statusCode}`);
    }

    // Check /albums/ directory
    console.log('\n2️⃣ Checking /albums/ directory...');
    const albumsDir = await makeStorageRequest('/albums/');
    
    if (albumsDir.statusCode === 200) {
      console.log('   ✅ /albums/ directory exists');
      
      try {
        const files = JSON.parse(albumsDir.data);
        console.log(`   📁 Found ${files.length} items in /albums/`);
        
        // List first 10 files
        files.slice(0, 10).forEach((file, index) => {
          const type = file.IsDirectory ? '📁' : '📄';
          const size = file.IsDirectory ? '' : ` (${file.Length} bytes)`;
          console.log(`   ${index + 1}. ${type} ${file.ObjectName}${size}`);
        });
        
        if (files.length > 10) {
          console.log(`   ... and ${files.length - 10} more items`);
        }
        
      } catch (parseError) {
        console.log('   📄 Directory listing (raw):', albumsDir.data.substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ /albums/ directory not accessible: ${albumsDir.statusCode}`);
    }

    // Check /cache/ directory
    console.log('\n3️⃣ Checking /cache/ directory...');
    const cacheDir = await makeStorageRequest('/cache/');
    
    if (cacheDir.statusCode === 200) {
      console.log('   ✅ /cache/ directory exists');
      
      try {
        const files = JSON.parse(cacheDir.data);
        console.log(`   📁 Found ${files.length} items in /cache/`);
        
        // List first 10 files
        files.slice(0, 10).forEach((file, index) => {
          const type = file.IsDirectory ? '📁' : '📄';
          const size = file.IsDirectory ? '' : ` (${file.Length} bytes)`;
          console.log(`   ${index + 1}. ${type} ${file.ObjectName}${size}`);
        });
        
        if (files.length > 10) {
          console.log(`   ... and ${files.length - 10} more items`);
        }
        
      } catch (parseError) {
        console.log('   📄 Directory listing (raw):', cacheDir.data.substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ /cache/ directory not accessible: ${cacheDir.statusCode}`);
    }

    // Check /cache/artwork/ directory
    console.log('\n4️⃣ Checking /cache/artwork/ directory...');
    const artworkDir = await makeStorageRequest('/cache/artwork/');
    
    if (artworkDir.statusCode === 200) {
      console.log('   ✅ /cache/artwork/ directory exists');
      
      try {
        const files = JSON.parse(artworkDir.data);
        console.log(`   📁 Found ${files.length} items in /cache/artwork/`);
        
        // List first 15 files
        files.slice(0, 15).forEach((file, index) => {
          const type = file.IsDirectory ? '📁' : '📄';
          const size = file.IsDirectory ? '' : ` (${file.Length} bytes)`;
          console.log(`   ${index + 1}. ${type} ${file.ObjectName}${size}`);
        });
        
        if (files.length > 15) {
          console.log(`   ... and ${files.length - 15} more items`);
        }
        
      } catch (parseError) {
        console.log('   📄 Directory listing (raw):', artworkDir.data.substring(0, 200) + '...');
      }
    } else {
      console.log(`   ❌ /cache/artwork/ directory not accessible: ${artworkDir.statusCode}`);
    }

  } catch (error) {
    console.error('❌ Error checking storage:', error.message);
  }
}

checkStorageImages(); 