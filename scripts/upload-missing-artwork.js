#!/usr/bin/env node

/**
 * Upload Missing Artwork Files
 * 
 * The app expects simplified filenames like:
 * artwork-into-the-doerfel-verse-artwork.png
 * 
 * But storage has encoded filenames like:
 * artwork-into-the-doerfel-verse-aHR0cHM6Ly9GVUNLSVQuYi1jZG4ubmV0L2FsYnVtcy9pbnRvLXRoZS1kb2VyZmVsLXZlcnNlLWFydHdvcmsuUG5n.png
 * 
 * This script copies/renames files to the expected names.
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

// Decode base64 from filename
function decodeFilename(filename) {
  const match = filename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
  if (match) {
    try {
      const base64Part = match[1];
      const originalUrl = atob(base64Part);
      return originalUrl;
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Extract simple name from URL
function getSimpleName(url) {
  if (url.includes('/albums/')) {
    const filename = url.split('/albums/')[1];
    return filename.replace(/\.(png|jpg|jpeg|gif)$/i, '');
  }
  return null;
}

async function uploadMissingArtwork() {
  console.log('🎨 Uploading missing artwork files...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      process.exit(1);
    }

    // Get list of existing files in storage
    const listUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/`;
    
    console.log('📂 Fetching existing files from storage...');
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
    console.log(`📊 Found ${files.length} files in storage`);

    // Process each file
    let copyCount = 0;
    for (const file of files) {
      if (file.IsDirectory) continue;
      
      const originalName = file.ObjectName;
      console.log(`\n🔍 Processing: ${originalName}`);
      
      // Decode the filename to get original URL
      const originalUrl = decodeFilename(originalName);
      if (!originalUrl) {
        console.log(`⚠️  Could not decode filename, skipping`);
        continue;
      }
      
      console.log(`📋 Decoded URL: ${originalUrl}`);
      
      // Get simple name
      const simpleName = getSimpleName(originalUrl);
      if (!simpleName) {
        console.log(`⚠️  Could not extract simple name, skipping`);
        continue;
      }
      
      // Get file extension from original file
      const extension = originalName.split('.').pop();
      const expectedName = `artwork-${simpleName}.${extension}`;
      
      console.log(`🎯 Expected name: ${expectedName}`);
      
      // Check if simplified version already exists
      const checkUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${expectedName}`;
      const checkResponse = await fetch(checkUrl, {
        method: 'HEAD',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY
        }
      });
      
      if (checkResponse.ok) {
        console.log(`✅ File already exists as ${expectedName}`);
        continue;
      }
      
      // Download original file
      console.log(`📥 Downloading original file...`);
      const downloadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${originalName}`;
      const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY
        }
      });
      
      if (!downloadResponse.ok) {
        console.log(`❌ Failed to download: ${downloadResponse.status}`);
        continue;
      }
      
      const fileData = await downloadResponse.arrayBuffer();
      
      // Upload with simplified name
      console.log(`📤 Uploading as ${expectedName}...`);
      const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${expectedName}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY,
          'Content-Type': `image/${extension}`
        },
        body: fileData
      });
      
      if (uploadResponse.ok) {
        console.log(`✅ Successfully uploaded: ${expectedName}`);
        copyCount++;
      } else {
        console.log(`❌ Failed to upload: ${uploadResponse.status}`);
      }
      
      // Add small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n🎉 Upload complete!`);
    console.log(`📊 Created ${copyCount} simplified artwork files`);
    console.log(`🔄 Files are now accessible with both encoded and simple names`);
    
  } catch (error) {
    console.error('❌ Error uploading missing artwork:', error.message);
    process.exit(1);
  }
}

// Run the upload
uploadMissingArtwork();