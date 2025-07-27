#!/usr/bin/env node

/**
 * Upload Cached Album Artwork to Bunny CDN Albums Directory
 * 
 * This script uploads existing cached album artwork to the /albums/ path 
 * to fix the 404 errors we're seeing in the logs.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
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

// Extract album name from artwork filename
function extractAlbumName(filename) {
  // Remove the artwork- prefix and extract the base album name
  const withoutPrefix = filename.replace(/^artwork-/, '');
  const albumMatch = withoutPrefix.match(/^([^-]+(?:-[^-]+)*)-aHR0/);
  if (albumMatch) {
    return albumMatch[1];
  }
  return withoutPrefix.split('-')[0];
}

async function uploadCachedAlbums() {
  console.log('🎨 Uploading cached album artwork to Bunny CDN...\n');
  
  try {
    // Load environment variables
    const env = await loadEnv();
    
    // Configuration - use the main FUCKIT zone for albums
    const BUNNY_STORAGE_ZONE = 'fuckit';
    const BUNNY_STORAGE_REGION = 'LA';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      process.exit(1);
    }

    // Find all cached artwork files
    const cacheDir = path.join(__dirname, '..', 'data', 'cache', 'artwork');
    
    let files;
    try {
      files = await fs.readdir(cacheDir);
    } catch (error) {
      console.error('❌ Could not read cache directory:', error.message);
      process.exit(1);
    }

    // Filter for main album artwork (not track-specific)
    const albumFiles = files.filter(file => {
      return file.startsWith('artwork-') && 
             !file.includes('-track') && 
             (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.gif') || file.endsWith('.jpeg'));
    });

    console.log(`📂 Found ${albumFiles.length} album artwork files to upload`);

    let uploadCount = 0;
    let errorCount = 0;

    for (const file of albumFiles) {
      try {
        const albumName = extractAlbumName(file);
        const extension = path.extname(file);
        const albumFileName = `${albumName}-artwork${extension}`;
        
        console.log(`📤 Uploading: ${file} → albums/${albumFileName}`);

        // Read the file
        const filePath = path.join(cacheDir, file);
        const fileData = await fs.readFile(filePath);

        // Upload to Bunny Storage
        const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/albums/${albumFileName}`;
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': `image/${extension.substring(1)}`
          },
          body: fileData
        });

        if (uploadResponse.ok) {
          console.log(`✅ Uploaded: albums/${albumFileName}`);
          uploadCount++;
        } else {
          console.error(`❌ Failed to upload ${albumFileName}: ${uploadResponse.status} ${uploadResponse.statusText}`);
          errorCount++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Upload Summary:`);
    console.log(`✅ Successfully uploaded: ${uploadCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);

    if (uploadCount > 0) {
      console.log(`\n🔄 Purging CDN cache...`);
      
      // Purge CDN cache for albums directory
      const purgeUrl = `https://api.bunny.net/pullzone/${env.BUNNY_CDN_ZONE || '4228588'}/purgeCache`;
      
      try {
        const purgeResponse = await fetch(purgeUrl, {
          method: 'POST',
          headers: {
            'AccessKey': env.BUNNY_CDN_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: "https://fuckit.b-cdn.net/albums/*"
          })
        });

        if (purgeResponse.ok) {
          console.log('✅ CDN cache purged successfully');
        } else {
          console.log('⚠️  Could not purge CDN cache - changes may take time to propagate');
        }
      } catch (error) {
        console.log('⚠️  Could not purge CDN cache:', error.message);
      }
    }

    console.log('\n🎉 Upload complete! Album artwork should now be available at CDN URLs.');

  } catch (error) {
    console.error('❌ Script error:', error.message);
    process.exit(1);
  }
}

// Run the upload
uploadCachedAlbums();