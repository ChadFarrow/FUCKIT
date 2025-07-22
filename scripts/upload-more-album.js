#!/usr/bin/env node

/**
 * Script to upload the "More" album RSS feed to Bunny.net storage
 */

const https = require('https');

// Bunny.net storage configuration
const BUNNY_STORAGE_API_KEY = '62d305ab-39a0-48c1-96a30779ca9b-e0f9-4752';
const BUNNY_STORAGE_HOSTNAME = 'ny.storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = 're-podtards-storage';
const BUNNY_CDN_URL = 'https://re-podtards.b-cdn.net';

const feedUrl = 'https://wavlake.com/feed/music/b54b9a19-b6ed-46c1-806c-7e82f7550edc';
const filename = 'wavlake-b54b9a19-b6ed-46c1-806c-7e82f7550edc.xml';

/**
 * Download a file from a URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);
    
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`🔄 Redirected to: ${redirectUrl}`);
        downloadFile(redirectUrl).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`✅ Downloaded ${data.length} bytes from ${url}`);
        resolve(data);
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Failed to download ${url}: ${error.message}`));
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

/**
 * Upload a file to Bunny.net storage
 */
function uploadToBunny(filename, content) {
  return new Promise((resolve, reject) => {
    console.log(`📤 Uploading to Bunny.net: feeds/${filename}`);
    
    const postData = Buffer.from(content, 'utf8');
    
    const options = {
      hostname: BUNNY_STORAGE_HOSTNAME,
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE}/feeds/${filename}`,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/xml',
        'Content-Length': postData.length
      }
    };
    
    const request = https.request(options, (response) => {
      let responseData = '';
      
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode === 201) {
          const cdnUrl = `${BUNNY_CDN_URL}/feeds/${filename}`;
          console.log(`✅ Uploaded successfully: ${cdnUrl}`);
          resolve(cdnUrl);
        } else {
          console.error(`❌ Upload failed: ${response.statusCode} ${response.statusMessage}`);
          console.error('Response:', responseData);
          reject(new Error(`Upload failed: ${response.statusCode} ${response.statusMessage}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Upload failed: ${error.message}`));
    });
    
    request.write(postData);
    request.end();
  });
}

async function main() {
  try {
    console.log('🚀 Uploading "More" album RSS feed to CDN...\n');
    
    // Download the RSS feed
    const content = await downloadFile(feedUrl);
    
    // Upload to Bunny.net
    const cdnUrl = await uploadToBunny(filename, content);
    
    console.log('\n🔄 URL mapping for code update:');
    console.log(`'${feedUrl}' → '${cdnUrl}'`);
    
    console.log('\n🎉 Successfully uploaded "More" album feed to CDN!');
  } catch (error) {
    console.error('\n💥 Upload failed:', error.message);
    process.exit(1);
  }
}

main();