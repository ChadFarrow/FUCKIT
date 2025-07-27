#!/usr/bin/env node

/**
 * Check what original RSS feeds expect vs what's in Bunny storage
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

async function checkOriginalVsBunny() {
  console.log('🔍 Checking original RSS feeds vs Bunny storage...\n');
  
  try {
    const env = await loadEnv();
    
    // Sample URLs from the original feed we just checked
    const originalUrls = [
      'https://www.doerfelverse.com/art/bloodshot-lies-the-album.png',
      'https://www.doerfelverse.com/art/movie.png', 
      'https://www.doerfelverse.com/art/heartbreak.png',
      'https://www.doerfelverse.com/art/still-a-man.png',
      'https://www.doerfelverse.com/art/so-far-away.png'
    ];
    
    console.log('📋 Original RSS feed expects these URLs:');
    originalUrls.forEach(url => {
      console.log(`   ${url}`);
    });
    
    // What should these be in Bunny storage?
    console.log('\n🎯 These should be copied to Bunny as:');
    originalUrls.forEach(url => {
      const filename = url.split('/').pop();
      const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '');
      const extension = filename.split('.').pop();
      const bunnyFilename = `artwork-${nameWithoutExt}.${extension}`;
      console.log(`   ${url}`);
      console.log(`   → FUCKIT.b-cdn.net/cache/artwork/${bunnyFilename}\n`);
    });
    
    // Check what's actually in Bunny
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      return;
    }

    const listUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/`;
    
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
    
    console.log('📂 Bunny storage has these simple artwork files:');
    const simpleFiles = imageFiles.filter(f => f.ObjectName.startsWith('artwork-') && !f.ObjectName.match(/[A-Za-z0-9+/=]{20,}/));
    simpleFiles.slice(0, 10).forEach(file => {
      console.log(`   ${file.ObjectName}`);
    });
    
    console.log(`\n📊 Total: ${simpleFiles.length} simple files, ${imageFiles.length} total files`);
    
    console.log('\n💡 The issue:');
    console.log('   - Original RSS feeds use: doerfelverse.com/art/filename.png');
    console.log('   - App should copy these to: FUCKIT.b-cdn.net/cache/artwork/artwork-filename.png');
    console.log('   - Simple names match what user wants for easy maintenance');
    
  } catch (error) {
    console.error('❌ Error checking files:', error.message);
  }
}

checkOriginalVsBunny();