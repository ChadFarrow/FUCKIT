#!/usr/bin/env node

/**
 * Fix Placeholder Files with Proper Content Types
 * 
 * Replace SVG files with wrong extensions with proper image placeholders
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

// Create a simple 1x1 pixel PNG placeholder
function createPngPlaceholder() {
  // 1x1 transparent PNG (43 bytes)
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);
}

// Create a simple 1x1 pixel GIF placeholder  
function createGifPlaceholder() {
  // 1x1 transparent GIF (43 bytes)
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x0C, 0x0A, 0x00, 0x3B
  ]);
}

// Create a simple 1x1 pixel JPEG placeholder
function createJpegPlaceholder() {
  // 1x1 gray JPEG (134 bytes)
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02,
    0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x9F, 0xFF, 0xD9
  ]);
}

async function fixPlaceholderFiles() {
  console.log('🔧 Fixing placeholder files with proper content types...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      return;
    }

    // Get list of files that are 263 bytes (SVG placeholders with wrong extension)
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
    const brokenPlaceholders = files.filter(f => 
      !f.IsDirectory && 
      f.Length === 263 && // SVG placeholder size
      f.ObjectName.startsWith('artwork-') &&
      !f.ObjectName.match(/[A-Za-z0-9+/=]{20,}/) // Simple filenames only
    );
    
    console.log(`🎯 Found ${brokenPlaceholders.length} broken placeholder files to fix\n`);
    
    if (brokenPlaceholders.length === 0) {
      console.log('✅ No broken placeholders found!');
      return;
    }

    let fixedCount = 0;
    for (const file of brokenPlaceholders) {
      try {
        console.log(`🔧 Fixing: ${file.ObjectName}`);
        
        const extension = file.ObjectName.split('.').pop().toLowerCase();
        let placeholderData;
        let contentType;
        
        switch (extension) {
          case 'png':
            placeholderData = createPngPlaceholder();
            contentType = 'image/png';
            break;
          case 'jpg':
          case 'jpeg':
            placeholderData = createJpegPlaceholder();
            contentType = 'image/jpeg';
            break;
          case 'gif':
            placeholderData = createGifPlaceholder();
            contentType = 'image/gif';
            break;
          default:
            console.log(`   ⚠️  Unknown extension: ${extension}, skipping`);
            continue;
        }
        
        // Upload proper placeholder
        const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${file.ObjectName}`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': contentType
          },
          body: placeholderData
        });
        
        if (uploadResponse.ok) {
          console.log(`   ✅ Fixed with proper ${extension.toUpperCase()} (${placeholderData.length} bytes)`);
          fixedCount++;
        } else {
          console.log(`   ❌ Failed to upload: ${uploadResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ❌ Error fixing ${file.ObjectName}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Fix complete!`);
    console.log(`📊 Successfully fixed ${fixedCount} placeholder files`);
    console.log(`🔄 CDN cache will update automatically`);
    
  } catch (error) {
    console.error('❌ Error fixing files:', error.message);
  }
}

fixPlaceholderFiles();