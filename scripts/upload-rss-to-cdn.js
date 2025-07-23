#!/usr/bin/env node

/**
 * Upload RSS feeds directly to Bunny.net CDN
 * Alternative solution to Pull Zone configuration
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Bunny.net CDN configuration
const BUNNY_CDN_API_KEY = process.env.BUNNY_CDN_API_KEY || 'd33f9b6a-779d-4cce-8767-cd050a2819bf';
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 're-podtards-cdn.b-cdn.net';
const BUNNY_CDN_ZONE = process.env.BUNNY_CDN_ZONE || 're-podtards-cdn';

// RSS feeds to upload
const rssFeeds = [
  {
    url: 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
    filename: 'feeds/music-from-the-doerfelverse.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
    filename: 'feeds/bloodshot-lies-album.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    filename: 'feeds/intothedoerfelverse.xml'
  },
  // Add more feeds as needed
];

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function uploadToCDN(filename, content) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BUNNY_CDN_HOSTNAME,
      port: 443,
      path: `/${filename}`,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_CDN_API_KEY,
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(content)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, filename });
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

async function uploadRSSFeeds() {
  console.log('🚀 Uploading RSS feeds to Bunny.net CDN...\n');
  
  const results = {
    total: rssFeeds.length,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  for (const feed of rssFeeds) {
    try {
      console.log(`📥 Downloading: ${feed.url}`);
      const content = await downloadFile(feed.url);
      
      console.log(`📤 Uploading: ${feed.filename}`);
      await uploadToCDN(feed.filename, content);
      
      console.log(`✅ Success: ${feed.filename}\n`);
      results.successful++;
      
    } catch (error) {
      console.log(`❌ Failed: ${feed.filename} - ${error.message}\n`);
      results.failed++;
      results.errors.push({ feed: feed.filename, error: error.message });
    }
  }
  
  console.log('📊 UPLOAD SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total feeds: ${results.total}`);
  console.log(`Successful: ${results.successful} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(({ feed, error }) => {
      console.log(`   ${feed}: ${error}`);
    });
  }
  
  if (results.successful > 0) {
    console.log('\n🎯 NEXT STEPS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Test CDN access:');
    console.log(`   curl -I "https://${BUNNY_CDN_HOSTNAME}/feeds/music-from-the-doerfelverse.xml"`);
    console.log('2. Re-enable CDN in app/page.tsx:');
    console.log('   Change: const isProduction = false;');
    console.log('   To: const isProduction = process.env.NODE_ENV === "production";');
    console.log('3. Deploy: vercel --prod');
  }
}

// Run the upload
uploadRSSFeeds().catch(console.error); 