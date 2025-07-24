#!/usr/bin/env node

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs/promises';
import path from 'path';

/**
 * Upload Doerfels publisher feed to Bunny CDN
 */

async function uploadDoerfelsFeed() {
  try {
    console.log('🚀 Uploading Doerfels publisher feed to Bunny CDN...\n');
    
    // Get storage configuration
    const storageConfig = {
      hostname: process.env.BUNNY_STORAGE_HOSTNAME || 'ny.storage.bunnycdn.com',
      zone: process.env.BUNNY_STORAGE_ZONE || 're-podtards-storage',
      apiKey: process.env.BUNNY_STORAGE_API_KEY,
    };
    
    if (!storageConfig.apiKey) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in .env.local');
      process.exit(1);
    }
    
    console.log(`📡 Storage Configuration:`);
    console.log(`   Hostname: ${storageConfig.hostname}`);
    console.log(`   Zone: ${storageConfig.zone}`);
    console.log(`   API Key: ✅ Set\n`);
    
    // Read the Doerfels publisher feed
    const feedPath = path.join(process.cwd(), 'doerfels-publisher-feed.xml');
    const feedContent = await fs.readFile(feedPath, 'utf-8');
    
    console.log(`📄 Read feed file: ${feedPath}`);
    console.log(`📊 Feed size: ${feedContent.length} bytes\n`);
    
    // Upload to Bunny CDN
    const storageUrl = `https://${storageConfig.hostname}/${storageConfig.zone}/feeds/doerfels-pubfeed.xml`;
    const cdnUrl = `https://re-podtards-cdn.b-cdn.net/feeds/doerfels-pubfeed.xml`;
    
    console.log(`📤 Uploading to: ${storageUrl}`);
    console.log(`🌐 Will be available at: ${cdnUrl}\n`);
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storageConfig.apiKey,
        'Content-Type': 'application/xml',
      },
      body: feedContent
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Successfully uploaded Doerfels publisher feed!`);
    console.log(`🔗 CDN URL: ${cdnUrl}`);
    
    // Test the CDN URL
    console.log(`\n🧪 Testing CDN URL...`);
    const testResponse = await fetch(cdnUrl);
    
    if (testResponse.ok) {
      console.log(`✅ CDN URL is accessible!`);
      console.log(`📊 Response size: ${testResponse.headers.get('content-length')} bytes`);
    } else {
      console.log(`⚠️  CDN URL returned ${testResponse.status} - may need time to propagate`);
    }
    
  } catch (error) {
    console.error(`❌ Error uploading feed:`, error.message);
    process.exit(1);
  }
}

// Run the upload
uploadDoerfelsFeed(); 