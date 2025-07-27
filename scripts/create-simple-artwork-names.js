#!/usr/bin/env node

/**
 * Create Simple Artwork Names from RSS Feed URLs
 * 
 * The RSS feeds expect simple names like:
 * artwork-music-from-the-doerfel-verse-artwork.png
 * 
 * But storage has encoded names like:
 * artwork-music-from-the-doerfel-verse-aHR0cHM6Ly9GVUNLSVQuYi1jZG4ubmV0L2FsYnVtcy9tdXNpYy1mcm9tLXRoZS1kb2VyZmVsLXZlcnNlLWFydHdvcmsucG5n.png
 * 
 * This script copies files to the simple expected names.
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

// Safely decode base64 URL from filename
function decodeFilename(filename) {
  try {
    const match = filename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
    if (match) {
      try {
        const base64Part = match[1];
        const originalUrl = atob(base64Part);
        
        // Only return if it looks like a valid URL
        if (originalUrl.startsWith('http') && originalUrl.includes('/albums/')) {
          return originalUrl;
        }
      } catch (error) {
        console.log(`⚠️  Could not decode ${filename}: ${error.message}`);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Generate simple filename from original URL
function generateSimpleFilename(originalUrl, extension) {
  if (originalUrl.includes('/albums/')) {
    const albumPart = originalUrl.split('/albums/')[1];
    const nameWithoutExt = albumPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
    return `artwork-${nameWithoutExt}.${extension}`;
  }
  return null;
}

async function createSimpleArtworkNames() {
  console.log('🎨 Creating simple artwork names from encoded files...\n');
  
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
    const imageFiles = files.filter(f => !f.IsDirectory && /\.(jpg|jpeg|png|gif)$/i.test(f.ObjectName));
    console.log(`📊 Found ${imageFiles.length} image files in storage`);

    // Process files and create mapping
    const conversions = [];
    
    for (const file of imageFiles) {
      const originalName = file.ObjectName;
      
      // Only process encoded names (contain base64)
      if (!originalName.match(/artwork-.*?-[A-Za-z0-9+/=]+\.(jpg|jpeg|png|gif)$/)) {
        continue;
      }
      
      console.log(`🔍 Processing: ${originalName}`);
      const originalUrl = decodeFilename(originalName);
      if (!originalUrl) {
        console.log(`❌ Could not decode or not /albums/ URL`);
        continue;
      }
      console.log(`✅ Decoded: ${originalUrl}`);
      
      const extension = originalName.split('.').pop();
      const simpleName = generateSimpleFilename(originalUrl, extension);
      
      if (simpleName && simpleName !== originalName) {
        conversions.push({
          originalName,
          simpleName,
          originalUrl
        });
      }
    }
    
    console.log(`🎯 Found ${conversions.length} files to convert to simple names`);
    
    if (conversions.length === 0) {
      console.log('✅ No files need conversion!');
      return;
    }

    // Show first few examples
    console.log('\n📋 Examples of conversions:');
    conversions.slice(0, 3).forEach(conv => {
      console.log(`   ${conv.originalName}`);
      console.log(`   → ${conv.simpleName}`);
      console.log(`   (from: ${conv.originalUrl})\n`);
    });

    // Perform conversions
    let successCount = 0;
    for (const conv of conversions) {
      try {
        console.log(`🔄 Converting: ${conv.simpleName}`);
        
        // Check if simple name already exists
        const checkUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${conv.simpleName}`;
        const checkResponse = await fetch(checkUrl, {
          method: 'HEAD',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY
          }
        });
        
        if (checkResponse.ok) {
          console.log(`✅ Already exists: ${conv.simpleName}`);
          successCount++;
          continue;
        }
        
        // Download original file
        const downloadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${conv.originalName}`;
        const downloadResponse = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY
          }
        });
        
        if (!downloadResponse.ok) {
          console.log(`❌ Failed to download ${conv.originalName}: ${downloadResponse.status}`);
          continue;
        }
        
        const fileData = await downloadResponse.arrayBuffer();
        const extension = conv.simpleName.split('.').pop();
        
        // Upload with simple name
        const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${conv.simpleName}`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': `image/${extension}`
          },
          body: fileData
        });
        
        if (uploadResponse.ok) {
          console.log(`✅ Created: ${conv.simpleName}`);
          successCount++;
        } else {
          console.log(`❌ Failed to upload ${conv.simpleName}: ${uploadResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error converting ${conv.originalName}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Conversion complete!`);
    console.log(`📊 Successfully created ${successCount} simple artwork files`);
    console.log(`🔄 Files are now accessible with both encoded and simple names`);
    console.log(`💡 CDN URLs can now use simple paths like: FUCKIT.b-cdn.net/cache/artwork/artwork-album-name.png`);
    
  } catch (error) {
    console.error('❌ Error creating simple artwork names:', error.message);
    process.exit(1);
  }
}

// Run the conversion
createSimpleArtworkNames();