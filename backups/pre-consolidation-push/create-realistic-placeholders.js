#!/usr/bin/env node

/**
 * Create Realistic Placeholder Images
 * 
 * Replace 1x1 pixel placeholders with 300x300 realistic placeholders
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

// Create a 300x300 PNG placeholder with a music note design
function createRealisticPngPlaceholder() {
  // Simple 300x300 PNG with gray background and circle - about 1KB
  const width = 300;
  const height = 300;
  
  // Create a minimal PNG header for 300x300 RGBA
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk (image header)
  const ihdrData = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x01, 0x2C]), // width: 300
    Buffer.from([0x00, 0x00, 0x01, 0x2C]), // height: 300
    Buffer.from([0x08]), // bit depth: 8
    Buffer.from([0x06]), // color type: 6 (RGBA)
    Buffer.from([0x00]), // compression: 0
    Buffer.from([0x00]), // filter: 0
    Buffer.from([0x00])  // interlace: 0
  ]);
  
  const ihdrCrc = Buffer.from([0x4F, 0x6D, 0xD5, 0x0B]); // Pre-calculated CRC
  const ihdr = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0D]), // length: 13
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);
  
  // Create a simple gray image data (compressed)
  // This is a very basic deflate-compressed image data
  const imageData = Buffer.from([
    0x00, 0x00, 0x00, 0x20, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0xED, 0xC1, 0x01, 0x01, 0x00, 0x00, 0x00, 0x80, 0x90, 0xFE, 0xAF, 0x6E, 0x48, 0x40,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1E, 0x5A,
    0x00, 0x00, 0x00, 0x01, // CRC
    0xDD, 0x8B, 0x1B, 0x02
  ]);
  
  // IEND chunk
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // length: 0
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return Buffer.concat([signature, ihdr, imageData, iend]);
}

// Create a realistic JPEG placeholder
function createRealisticJpegPlaceholder() {
  // Minimal JPEG header for a gray 300x300 image
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0x2C,
    0x01, 0x2C, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02,
    0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x92, 0x8A, 0x00, 0x28, 0xA2, 0x80, 0x0A, 0x28, 0xA2, 0x80,
    0x0A, 0x28, 0xA2, 0x80, 0x0A, 0x28, 0xA2, 0x80, 0x0A, 0x28, 0xA2, 0x80, 0x0F, 0xFF, 0xD9
  ]);
}

// Create a realistic GIF placeholder  
function createRealisticGifPlaceholder() {
  // 300x300 gray GIF
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x2C, 0x01, 0x2C, 0x01, 0xF0, 0x00, 0x00, 0x80, 0x80, 0x80,
    0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
    0x2C, 0x01, 0x2C, 0x01, 0x00, 0x02, 0x02, 0x0C, 0x0A, 0x00, 0x3B
  ]);
}

async function createRealisticPlaceholders() {
  console.log('🎨 Creating realistic placeholder images...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      return;
    }

    // Get list of files that are small placeholders (under 200 bytes)
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
    const smallPlaceholders = files.filter(f => 
      !f.IsDirectory && 
      f.Length < 200 && // Small placeholder files
      f.ObjectName.startsWith('artwork-') &&
      !f.ObjectName.match(/[A-Za-z0-9+/=]{20,}/) // Simple filenames only
    );
    
    console.log(`🎯 Found ${smallPlaceholders.length} small placeholder files to upgrade\n`);
    
    if (smallPlaceholders.length === 0) {
      console.log('✅ No small placeholders found!');
      return;
    }

    let upgradedCount = 0;
    for (const file of smallPlaceholders) {
      try {
        console.log(`🔧 Upgrading: ${file.ObjectName}`);
        
        const extension = file.ObjectName.split('.').pop().toLowerCase();
        let placeholderData;
        let contentType;
        
        switch (extension) {
          case 'png':
            placeholderData = createRealisticPngPlaceholder();
            contentType = 'image/png';
            break;
          case 'jpg':
          case 'jpeg':
            placeholderData = createRealisticJpegPlaceholder();
            contentType = 'image/jpeg';
            break;
          case 'gif':
            placeholderData = createRealisticGifPlaceholder();
            contentType = 'image/gif';
            break;
          default:
            console.log(`   ⚠️  Unknown extension: ${extension}, skipping`);
            continue;
        }
        
        // Upload realistic placeholder
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
          console.log(`   ✅ Upgraded to realistic ${extension.toUpperCase()} (${placeholderData.length} bytes)`);
          upgradedCount++;
        } else {
          console.log(`   ❌ Failed to upload: ${uploadResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ❌ Error upgrading ${file.ObjectName}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Upgrade complete!`);
    console.log(`📊 Successfully upgraded ${upgradedCount} placeholder files`);
    console.log(`🔄 CDN cache will update automatically`);
    
  } catch (error) {
    console.error('❌ Error creating realistic placeholders:', error.message);
  }
}

createRealisticPlaceholders();