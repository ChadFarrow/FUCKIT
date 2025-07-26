#!/usr/bin/env node

/**
 * Upload Deduplicated Cache to Bunny.net Storage
 * 
 * This script:
 * 1. Reads the cache metadata from data/cache/cache-metadata.json
 * 2. Deduplicates artwork by keeping only album artwork (no trackNumber)
 * 3. Uploads unique cached artwork and audio files to Bunny.net Storage
 * 4. Updates the cache metadata with CDN URLs
 * 5. Generates a report of the upload process
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
async function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = await fs.readFile(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0 && !key.startsWith('#')) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.local:', error.message);
    return {};
  }
}

// Bunny Storage Configuration
let BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_REGION;

async function initializeEnv() {
  const envVars = await loadEnvFile();
  BUNNY_STORAGE_API_KEY = envVars.BUNNY_STORAGE_API_KEY;
  BUNNY_STORAGE_ZONE = envVars.BUNNY_STORAGE_ZONE;
  BUNNY_STORAGE_REGION = envVars.BUNNY_STORAGE_REGION || 'NY';
}

/**
 * Upload file to Bunny.net Storage
 */
async function uploadToBunny(filePath, remotePath, contentType) {
  try {
    const storageUrl = `https://${BUNNY_STORAGE_REGION.toLowerCase()}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${remotePath}`;
    
    console.log(`📤 Uploading: ${path.basename(filePath)} -> ${remotePath}`);
    
    const fileBuffer = await fs.readFile(filePath);
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': contentType,
      },
      body: fileBuffer
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Return the storage URL that can be accessed via CDN
    const cdnUrl = `https://re-podtards-cdn.b-cdn.net/${remotePath}`;
    console.log(`✅ Uploaded: ${cdnUrl}`);
    return cdnUrl;
  } catch (error) {
    console.error(`❌ Failed to upload ${path.basename(filePath)}:`, error.message);
    return null;
  }
}

/**
 * Deduplicate cache items
 */
function deduplicateCacheItems(cacheItems) {
  console.log('🔍 Deduplicating cache items...\n');
  
  const uniqueItems = [];
  const artworkByUrl = {};
  const audioByUrl = {};
  
  // Process artwork items first
  const artworkItems = cacheItems.filter(item => item.type === 'artwork');
  console.log(`🎨 Processing ${artworkItems.length} artwork items...`);
  
  artworkItems.forEach(item => {
    if (!artworkByUrl[item.originalUrl]) {
      // First time seeing this URL - keep it
      artworkByUrl[item.originalUrl] = item;
      uniqueItems.push(item);
      console.log(`   ✅ Keeping: ${item.id} (${!item.trackNumber ? 'ALBUM ART' : `Track ${item.trackNumber}`})`);
    } else {
      // Duplicate URL - skip it
      console.log(`   ⏭️  Skipping duplicate: ${item.id} (${!item.trackNumber ? 'ALBUM ART' : `Track ${item.trackNumber}`})`);
    }
  });
  
  // Process audio items
  const audioItems = cacheItems.filter(item => item.type === 'audio');
  console.log(`🎵 Processing ${audioItems.length} audio items...`);
  
  audioItems.forEach(item => {
    if (!audioByUrl[item.originalUrl]) {
      // First time seeing this URL - keep it
      audioByUrl[item.originalUrl] = item;
      uniqueItems.push(item);
      console.log(`   ✅ Keeping: ${item.id} (${!item.trackNumber ? 'ALBUM AUDIO' : `Track ${item.trackNumber}`})`);
    } else {
      // Duplicate URL - skip it
      console.log(`   ⏭️  Skipping duplicate: ${item.id} (${!item.trackNumber ? 'ALBUM AUDIO' : `Track ${item.trackNumber}`})`);
    }
  });
  
  console.log(`\n📊 Deduplication Results:`);
  console.log(`   Original items: ${cacheItems.length}`);
  console.log(`   Unique items: ${uniqueItems.length}`);
  console.log(`   Duplicates removed: ${cacheItems.length - uniqueItems.length}`);
  console.log(`   Unique artwork: ${Object.keys(artworkByUrl).length}`);
  console.log(`   Unique audio: ${Object.keys(audioByUrl).length}`);
  
  return uniqueItems;
}

/**
 * Process deduplicated cache metadata and upload files
 */
async function uploadDeduplicatedCache() {
  console.log('🚀 Starting deduplicated cache upload to Bunny.net Storage...\n');
  
  // Initialize environment variables
  await initializeEnv();
  
  if (!BUNNY_STORAGE_API_KEY || !BUNNY_STORAGE_ZONE) {
    console.error('❌ BUNNY_STORAGE_API_KEY or BUNNY_STORAGE_ZONE not found in environment variables');
    console.log('💡 Run: node scripts/setup-bunny-storage.js');
    process.exit(1);
  }
  
  console.log(`📡 Storage Configuration:`);
  console.log(`   Storage Zone: ${BUNNY_STORAGE_ZONE}`);
  console.log(`   Region: ${BUNNY_STORAGE_REGION}`);
  console.log(`   API Key: ${BUNNY_STORAGE_API_KEY ? '✅ Set' : '❌ Missing'}\n`);
  
  try {
    // Read cache metadata
    const metadataPath = path.join(__dirname, '..', 'data', 'cache', 'cache-metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    const cacheItems = JSON.parse(metadataContent);
    
    console.log(`📊 Found ${cacheItems.length} cached items\n`);
    
    // Deduplicate items
    const uniqueItems = deduplicateCacheItems(cacheItems);
    
    const results = {
      totalItems: cacheItems.length,
      uniqueItems: uniqueItems.length,
      duplicatesRemoved: cacheItems.length - uniqueItems.length,
      uploadedItems: 0,
      failedItems: 0,
      uploadedArtwork: 0,
      uploadedAudio: 0,
      errors: [],
      updatedMetadata: []
    };
    
    // Process each unique cache item
    for (const item of uniqueItems) {
      try {
        const cacheDir = path.join(__dirname, '..', 'data', 'cache', item.type);
        const localFilePath = path.join(cacheDir, `${item.id}.${item.type === 'artwork' ? 'jpg' : 'mp3'}`);
        
        // Check if file exists locally
        try {
          await fs.access(localFilePath);
        } catch (error) {
          console.log(`⚠️  File not found: ${path.basename(localFilePath)}`);
          results.failedItems++;
          results.errors.push({
            id: item.id,
            error: 'File not found locally'
          });
          continue;
        }
        
        // Determine remote path and content type
        const contentType = item.type === 'artwork' ? 'image/jpeg' : 'audio/mpeg';
        const remotePath = `cache/${item.type}/${item.id}.${item.type === 'artwork' ? 'jpg' : 'mp3'}`;
        
        // Upload to Bunny
        const cdnUrl = await uploadToBunny(localFilePath, remotePath, contentType);
        
        if (cdnUrl) {
          results.uploadedItems++;
          if (item.type === 'artwork') {
            results.uploadedArtwork++;
          } else {
            results.uploadedAudio++;
          }
          
          // Update metadata with CDN URL
          const updatedItem = {
            ...item,
            cdnUrl: cdnUrl,
            uploadedAt: new Date().toISOString()
          };
          results.updatedMetadata.push(updatedItem);
          
        } else {
          results.failedItems++;
          results.errors.push({
            id: item.id,
            error: 'Upload failed'
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${item.id}:`, error.message);
        results.failedItems++;
        results.errors.push({
          id: item.id,
          error: error.message
        });
      }
    }
    
    // Save updated metadata with CDN URLs
    const updatedMetadataPath = path.join(__dirname, '..', 'data', 'cache', 'cache-metadata-deduplicated.json');
    await fs.writeFile(updatedMetadataPath, JSON.stringify(results.updatedMetadata, null, 2));
    
    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEDUPLICATED UPLOAD SUMMARY');
    console.log('='.repeat(60));
    console.log(`Original Items: ${results.totalItems}`);
    console.log(`Unique Items: ${results.uniqueItems}`);
    console.log(`Duplicates Removed: ${results.duplicatesRemoved}`);
    console.log(`Uploaded Items: ${results.uploadedItems}`);
    console.log(`Failed Items: ${results.failedItems}`);
    console.log(`Artwork Uploaded: ${results.uploadedArtwork}`);
    console.log(`Audio Uploaded: ${results.uploadedAudio}`);
    console.log(`Success Rate: ${results.uniqueItems > 0 ? Math.round((results.uploadedItems / results.uniqueItems) * 100) : 0}%`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(error => {
        console.log(`   ${error.id}: ${error.error}`);
      });
    }
    
    console.log(`\n📄 Updated metadata saved to: ${updatedMetadataPath}`);
    console.log('\n✅ Deduplicated cache upload to Bunny.net Storage complete!');
    
    // Save detailed report
    const reportPath = path.join(__dirname, '..', 'bunny-cache-deduplicated-upload-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error reading cache metadata:', error.message);
    process.exit(1);
  }
}

uploadDeduplicatedCache(); 