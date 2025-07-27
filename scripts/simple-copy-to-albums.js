#!/usr/bin/env node

/**
 * Simple Copy Cache to Albums
 * 
 * This script copies artwork files from cache to albums directory
 * with proper filenames based on the base64-encoded original URLs.
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

async function simpleCopyToAlbums() {
  console.log('🔄 Simple copy: cache to albums directory...\n');
  
  try {
    // Load environment variables
    const env = await loadEnv();
    
    // Bunny.net Storage configuration
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY environment variable is required');
      process.exit(1);
    }
    
    const STORAGE_URL = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
    
    // List of known files to copy (from the cache that we know exists)
    const filesToCopy = [
      {
        cachePath: 'cache/artwork/artwork-music-from-the-doerfelverse-aHR0cHM6Ly93d3cuZG9lcmZlbHZlcnNlLmNvbS9hcnQvY2Fyb2wtb2YtdGhlLWJlbGxzLnBuZw.jpg',
        albumPath: 'albums/carol-of-the-bells.png'
      },
      {
        cachePath: 'cache/artwork/artwork-music-from-the-doerfelverse-aHR0cHM6Ly93d3cuZG9lcmZlbHZlcnNlLmNvbS9hcnQvY2Fyb2wtb2YtdGhlLWJlbGxzLnBuZw.jpg',
        albumPath: 'albums/music-from-the-doerfel-verse-artwork.png'
      }
    ];
    
    let copiedCount = 0;
    let errorCount = 0;
    const copyReport = {
      timestamp: new Date().toISOString(),
      totalFiles: filesToCopy.length,
      copied: 0,
      errors: 0,
      details: []
    };
    
    // Copy each file
    for (const file of filesToCopy) {
      try {
        console.log(`📥 Downloading from cache: ${file.cachePath}`);
        const downloadResponse = await fetch(`${STORAGE_URL}/${file.cachePath}`, {
          method: 'GET',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY
          }
        });
        
        if (!downloadResponse.ok) {
          throw new Error(`Download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`);
        }
        
        const buffer = await downloadResponse.buffer();
        
        console.log(`📤 Uploading to albums: ${file.albumPath}`);
        const uploadResponse = await fetch(`${STORAGE_URL}/${file.albumPath}`, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': downloadResponse.headers.get('content-type') || 'image/jpeg'
          },
          body: buffer
        });
        
        if (uploadResponse.ok) {
          console.log(`✅ Copied: ${file.cachePath} → ${file.albumPath}`);
          copiedCount++;
          copyReport.copied++;
          copyReport.details.push({
            cachePath: file.cachePath,
            albumPath: file.albumPath,
            status: 'success'
          });
        } else {
          const errorText = await uploadResponse.text();
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error copying file:`, error.message);
        errorCount++;
        copyReport.errors++;
        copyReport.details.push({
          cachePath: file.cachePath,
          albumPath: file.albumPath,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    // Save copy report
    const reportPath = path.join(__dirname, '..', 'simple-copy-report.json');
    await fs.writeFile(reportPath, JSON.stringify(copyReport, null, 2));
    
    console.log('\n📊 Copy Summary:');
    console.log(`✅ Successfully copied: ${copiedCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    if (copiedCount > 0) {
      console.log('\n🎉 Album artwork is now available at:');
      console.log(`https://FUCKIT.b-cdn.net/albums/[filename]`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

simpleCopyToAlbums(); 