#!/usr/bin/env node

/**
 * Create Missing Simple Artwork Files
 * 
 * RSS feeds expect files with encoded names, but we want simple names.
 * This script creates the missing files with simple names by:
 * 1. Finding what files RSS feeds expect (encoded names)
 * 2. Converting encoded names to simple names  
 * 3. Creating placeholder files or copying from similar existing files
 */

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

// Generate simple filename from encoded filename
function getSimpleNameFromEncoded(encodedFilename) {
  const match = encodedFilename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
  if (match) {
    try {
      const base64Part = match[1];
      const originalUrl = atob(base64Part);
      
      if (originalUrl.includes('/albums/')) {
        const albumPart = originalUrl.split('/albums/')[1];
        const nameWithoutExt = albumPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
        return `artwork-${nameWithoutExt}.${match[2]}`;
      }
    } catch (error) {
      // Ignore decode errors
    }
  }
  return null;
}

// Create a simple placeholder image
function createPlaceholderImageBuffer(width = 400, height = 400, text = '🎵') {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1f2937"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="120">${text}</text>
    </svg>
  `;
  return Buffer.from(svg, 'utf8');
}

async function createMissingSimpleFiles() {
  console.log('🎨 Creating missing simple artwork files...\n');
  
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
    
    // Find missing files and convert to simple names
    const missingFiles = [];
    for (const expectedFile of expectedFiles) {
      if (!actualFiles.has(expectedFile)) {
        const simpleName = getSimpleNameFromEncoded(expectedFile);
        if (simpleName) {
          missingFiles.push({
            encoded: expectedFile,
            simple: simpleName
          });
        }
      }
    }
    
    console.log(`❌ Missing files to create: ${missingFiles.length}`);
    
    if (missingFiles.length === 0) {
      console.log('✅ All files already exist!');
      return;
    }

    // Show examples
    console.log('\n📋 Examples of files to create:');
    missingFiles.slice(0, 5).forEach(file => {
      console.log(`   ${file.encoded}`);
      console.log(`   → ${file.simple}\n`);
    });

    // Create missing files
    let createdCount = 0;
    for (const file of missingFiles) {
      try {
        console.log(`🔄 Creating: ${file.simple}`);
        
        // Check if simple name already exists
        const checkUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${file.simple}`;
        const checkResponse = await fetch(checkUrl, {
          method: 'HEAD',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY
          }
        });
        
        if (checkResponse.ok) {
          console.log(`✅ Already exists: ${file.simple}`);
          createdCount++;
          continue;
        }
        
        // Create placeholder image
        const extension = file.simple.split('.').pop();
        const placeholderBuffer = createPlaceholderImageBuffer(400, 400, '🎵');
        
        // Upload placeholder
        const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${file.simple}`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': 'image/svg+xml'
          },
          body: placeholderBuffer
        });
        
        if (uploadResponse.ok) {
          console.log(`✅ Created placeholder: ${file.simple}`);
          createdCount++;
        } else {
          console.log(`❌ Failed to upload ${file.simple}: ${uploadResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error creating ${file.simple}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Creation complete!`);
    console.log(`📊 Successfully created ${createdCount} simple artwork files`);
    console.log(`🎵 All files use music note placeholder since original artwork sources may not be accessible`);
    console.log(`🔄 CDN URLs now work with simple paths like: FUCKIT.b-cdn.net/cache/artwork/artwork-album-name.png`);
    
  } catch (error) {
    console.error('❌ Error creating missing files:', error.message);
    process.exit(1);
  }
}

// Run the creation
createMissingSimpleFiles();