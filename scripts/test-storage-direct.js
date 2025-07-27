#!/usr/bin/env node

/**
 * Test Direct Storage Access
 * 
 * Check if we can access files directly from Bunny storage
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = await fs.readFile(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return env;
  } catch (error) {
    console.error('❌ Could not load .env.local file:', error.message);
    process.exit(1);
  }
}

async function testStorageDirect() {
  console.log('🔍 Testing direct storage access...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    const BUNNY_CDN_HOSTNAME = env.BUNNY_CDN_HOSTNAME || 'FUCKIT.b-cdn.net';
    
    console.log('📋 Configuration:');
    console.log(`   Storage Zone: ${BUNNY_STORAGE_ZONE}`);
    console.log(`   Storage Region: ${BUNNY_STORAGE_REGION}`);
    console.log(`   CDN Hostname: ${BUNNY_CDN_HOSTNAME}\n`);
    
    // Test files
    const testFiles = [
      'artwork-ben-doerfel-artwork.png',
      'artwork-kurtisdrums-artwork.png',
      'artwork-18-sundays-artwork.gif'
    ];
    
    for (const filename of testFiles) {
      console.log(`\n🧪 Testing: ${filename}`);
      
      // Test 1: Direct storage access
      const storageUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${filename}`;
      console.log(`   Storage URL: ${storageUrl}`);
      
      const storageResponse = await fetch(storageUrl, {
        method: 'HEAD',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY
        }
      });
      
      console.log(`   Storage Response: ${storageResponse.status} ${storageResponse.statusText}`);
      if (storageResponse.ok) {
        console.log(`   Content-Type: ${storageResponse.headers.get('content-type')}`);
        console.log(`   Content-Length: ${storageResponse.headers.get('content-length')} bytes`);
      }
      
      // Test 2: CDN access
      const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/cache/artwork/${filename}`;
      console.log(`   CDN URL: ${cdnUrl}`);
      
      const cdnResponse = await fetch(cdnUrl, {
        method: 'HEAD'
      });
      
      console.log(`   CDN Response: ${cdnResponse.status} ${cdnResponse.statusText}`);
      console.log(`   CDN Content-Type: ${cdnResponse.headers.get('content-type')}`);
      
      // Get first 100 bytes to see what's being served
      if (cdnResponse.status === 200) {
        const cdnFullResponse = await fetch(cdnUrl);
        const buffer = await cdnFullResponse.buffer();
        const first100 = buffer.toString('utf8', 0, Math.min(100, buffer.length));
        console.log(`   CDN Content Preview: ${first100.replace(/\n/g, ' ').substring(0, 80)}...`);
      }
    }
    
    console.log('\n💡 Notes:');
    console.log('   - If storage returns 200 but CDN returns HTML, the pull zone origin is misconfigured');
    console.log('   - If storage returns 404, files need to be uploaded');
    console.log('   - If CDN returns correct content-type, caching might be the issue');
    
  } catch (error) {
    console.error('❌ Error testing storage:', error.message);
  }
}

testStorageDirect();