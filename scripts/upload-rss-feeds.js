#!/usr/bin/env node

/**
 * Script to download RSS feeds and upload them to Bunny.net storage
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Bunny.net storage configuration from .env.local
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_HOSTNAME = 'ny.storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = 're-podtards-storage';
const BUNNY_CDN_URL = 'https://re-podtards-cdn.b-cdn.net';

// RSS feeds to upload (newly added ones)
const rssFeeds = [
  {
    url: 'https://ableandthewolf.com/static/media/feed.xml',
    filename: 'ableandthewolf-feed.xml'
  },
  {
    url: 'https://static.staticsave.com/mspfiles/deathdreams.xml',
    filename: 'deathdreams.xml'
  },
  {
    url: 'https://static.staticsave.com/mspfiles/waytogo.xml',
    filename: 'waytogo.xml'
  },
  {
    url: 'https://www.doerfelverse.com/artists/opus/opus/opus.xml',
    filename: 'opus.xml'
  },
  {
    url: 'https://feed.falsefinish.club/Vance%20Latta/Vance%20Latta%20-%20Love%20In%20Its%20Purest%20Form/love%20in%20its%20purest%20form.xml',
    filename: 'vance-latta-love-in-its-purest-form.xml'
  },
  {
    url: 'https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now%20i%20feel%20it.xml',
    filename: 'c-kostra-now-i-feel-it.xml'
  },
  {
    url: 'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml',
    filename: 'mellow-cassette-pilot.xml'
  },
  {
    url: 'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml',
    filename: 'mellow-cassette-radio-brigade.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/997060e3-9dc1-4cd8-b3c1-3ae06d54bb03',
    filename: 'wavlake-997060e3-9dc1-4cd8-b3c1-3ae06d54bb03.xml'
  }
];

/**
 * Download a file from a URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);
    
    const protocol = url.startsWith('https:') ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
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
    
    request.setTimeout(10000, () => {
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

/**
 * Process all RSS feeds
 */
async function processFeeds() {
  console.log('🚀 Starting RSS feed upload process...\n');
  
  const results = [];
  
  for (const feed of rssFeeds) {
    try {
      console.log(`\n📄 Processing: ${feed.filename}`);
      
      // Download the RSS feed
      const content = await downloadFile(feed.url);
      
      // Upload to Bunny.net
      const cdnUrl = await uploadToBunny(feed.filename, content);
      
      results.push({
        originalUrl: feed.url,
        cdnUrl: cdnUrl,
        filename: feed.filename,
        success: true
      });
      
      // Add a small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to process ${feed.filename}: ${error.message}`);
      results.push({
        originalUrl: feed.url,
        cdnUrl: null,
        filename: feed.filename,
        success: false,
        error: error.message
      });
    }
  }
  
  console.log('\n📊 Upload Summary:');
  console.log('==================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful uploads: ${successful.length}`);
  console.log(`❌ Failed uploads: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n🔄 URL Mappings for code update:');
    console.log('=====================================');
    successful.forEach(result => {
      console.log(`'${result.originalUrl}' → '${result.cdnUrl}'`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    console.log('==================');
    failed.forEach(result => {
      console.log(`${result.filename}: ${result.error}`);
    });
  }
  
  return results;
}

// Run the script
if (require.main === module) {
  processFeeds()
    .then((results) => {
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      console.log(`\n🎉 Process completed: ${successful}/${total} feeds uploaded successfully`);
      process.exit(successful === total ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}