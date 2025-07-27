#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
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

async function checkBunnyFiles() {
  console.log('🔍 Checking what files exist vs what RSS feeds expect...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      process.exit(1);
    }

    // Get expected files from RSS feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    const parsedData = JSON.parse(feedsData);
    const feeds = parsedData.feeds || parsedData;
    
    const expectedFiles = new Set();
    feeds.forEach(feed => {
      // Check album cover art
      if (feed.parsedData?.album?.coverArt && feed.parsedData.album.coverArt.includes('FUCKIT.b-cdn.net/cache/artwork/')) {
        const filename = feed.parsedData.album.coverArt.split('/').pop();
        if (filename) {
          expectedFiles.add(filename);
        }
      }
      
      // Check track images
      feed.parsedData?.album?.tracks?.forEach(track => {
        if (track.image && track.image.includes('FUCKIT.b-cdn.net/cache/artwork/')) {
          const filename = track.image.split('/').pop();
          if (filename) {
            expectedFiles.add(filename);
          }
        }
      });
    });
    
    console.log(`📋 RSS feeds expect ${expectedFiles.size} artwork files`);
    
    // Get actual files in storage
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
    const actualFiles = new Set(imageFiles.map(f => f.ObjectName));
    
    console.log(`📂 Bunny storage has ${actualFiles.size} image files`);
    
    // Check what's missing
    const missing = [];
    const existing = [];
    
    for (const expectedFile of expectedFiles) {
      if (actualFiles.has(expectedFile)) {
        existing.push(expectedFile);
      } else {
        missing.push(expectedFile);
      }
    }
    
    console.log(`\n✅ Files that exist: ${existing.length}`);
    console.log(`❌ Files that are missing: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log('\n🔍 Missing files (first 10):');
      missing.slice(0, 10).forEach(file => {
        console.log(`   ${file}`);
        
        // Try to decode and find what simple name this should have
        const match = file.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
        if (match) {
          try {
            const base64Part = match[1];
            const originalUrl = atob(base64Part);
            console.log(`     → Decoded: ${originalUrl}`);
            
            if (originalUrl.includes('/albums/')) {
              const albumPart = originalUrl.split('/albums/')[1];
              const nameWithoutExt = albumPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
              const simpleName = `artwork-${nameWithoutExt}.${match[2]}`;
              console.log(`     → Simple name should be: ${simpleName}`);
            }
          } catch (error) {
            console.log(`     → Could not decode`);
          }
        }
        console.log();
      });
    }
    
    // Check for extra files
    const extra = [];
    for (const actualFile of actualFiles) {
      if (!expectedFiles.has(actualFile)) {
        extra.push(actualFile);
      }
    }
    
    if (extra.length > 0) {
      console.log(`\n🗂️  Extra files in storage (not in RSS): ${extra.length}`);
      console.log('First 5 extra files:');
      extra.slice(0, 5).forEach(file => {
        console.log(`   ${file}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking files:', error.message);
    process.exit(1);
  }
}

checkBunnyFiles();