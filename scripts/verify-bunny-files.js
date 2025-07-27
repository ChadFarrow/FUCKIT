#!/usr/bin/env node

/**
 * Verify which files actually exist in Bunny storage
 * and test access to specific failing files
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

async function verifyBunnyFiles() {
  console.log('🔍 Verifying Bunny storage files...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      return;
    }

    // Get list of files in storage
    const listUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/`;
    
    console.log('📂 Fetching file list from Bunny storage...');
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list storage files: ${listResponse.status}`);
    }

    const files = await listResponse.json();
    const imageFiles = files.filter(f => !f.IsDirectory && /\.(jpg|jpeg|png|gif)$/i.test(f.ObjectName));
    
    console.log(`📊 Found ${imageFiles.length} image files in storage\n`);
    
    // Check for specific failing files from console logs
    const failingFiles = [
      'artwork-music-from-the-doerfel-verse-artwork.png',
      'artwork-bloodshot-lies---the-album-artwork.png', 
      'artwork-into-the-doerfel-verse-artwork.png',
      'artwork-wrath-of-banjo-artwork.png',
      'artwork-ben-doerfel-artwork.png',
      'artwork-18-sundays-artwork.gif',
      'artwork-kurtisdrums-artwork.png'
    ];
    
    console.log('🎯 Checking specific failing files:');
    for (const filename of failingFiles) {
      const exists = imageFiles.some(f => f.ObjectName === filename);
      const fileInfo = imageFiles.find(f => f.ObjectName === filename);
      
      if (exists) {
        console.log(`✅ ${filename} - EXISTS (${fileInfo.Length} bytes, ${fileInfo.LastModified})`);
        
        // Test CDN access
        const cdnUrl = `https://FUCKIT.b-cdn.net/cache/artwork/${filename}`;
        try {
          const cdnResponse = await fetch(cdnUrl, { method: 'HEAD' });
          console.log(`   CDN: ${cdnResponse.status} ${cdnResponse.statusText}`);
        } catch (error) {
          console.log(`   CDN: ❌ ${error.message}`);
        }
      } else {
        console.log(`❌ ${filename} - MISSING`);
      }
    }
    
    // Show simple files that do exist
    console.log('\n📋 Simple files that exist:');
    const simpleFiles = imageFiles.filter(f => 
      f.ObjectName.startsWith('artwork-') && 
      !f.ObjectName.match(/[A-Za-z0-9+/=]{20,}/) // No long base64 strings
    );
    
    simpleFiles.slice(0, 10).forEach(file => {
      console.log(`   ${file.ObjectName} (${file.Length} bytes)`);
    });
    
    if (simpleFiles.length > 10) {
      console.log(`   ... and ${simpleFiles.length - 10} more`);
    }
    
    console.log(`\n📊 Total simple files: ${simpleFiles.length}`);
    console.log(`📊 Total encoded files: ${imageFiles.length - simpleFiles.length}`);
    
  } catch (error) {
    console.error('❌ Error verifying files:', error.message);
  }
}

verifyBunnyFiles();