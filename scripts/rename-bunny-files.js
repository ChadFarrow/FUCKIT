#!/usr/bin/env node

/**
 * Rename Bunny Storage Files to Match RSS Feed Expectations
 * 
 * This script:
 * 1. Reads the parsed RSS feeds to see what filenames are expected
 * 2. Lists actual files in Bunny storage
 * 3. Renames encoded files to match expected simple names
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

// Extract expected filenames from RSS feeds
async function getExpectedFilenames() {
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    const parsedData = JSON.parse(feedsData);
    const feeds = parsedData.feeds || parsedData; // Handle both formats
    
    const expectedFiles = new Set();
    
    feeds.forEach(feed => {
      feed.episodes?.forEach(episode => {
        if (episode.artworkUrl && episode.artworkUrl.includes('FUCKIT.b-cdn.net/cache/artwork/')) {
          const filename = episode.artworkUrl.split('/').pop();
          if (filename) {
            expectedFiles.add(filename);
          }
        }
      });
    });
    
    return Array.from(expectedFiles);
  } catch (error) {
    console.error('❌ Could not read parsed feeds:', error.message);
    process.exit(1);
  }
}

// Decode filename to get original URL
function decodeFilename(filename) {
  const match = filename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
  if (match) {
    try {
      const base64Part = match[1];
      return atob(base64Part);
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Generate expected filename from original URL
function generateExpectedFilename(originalUrl, extension) {
  if (originalUrl.includes('/albums/')) {
    const albumPart = originalUrl.split('/albums/')[1];
    const nameWithoutExt = albumPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
    return `artwork-${nameWithoutExt}.${extension}`;
  }
  
  // For other URLs, try to extract a meaningful name
  const urlParts = originalUrl.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  const nameWithoutExt = lastPart.replace(/\.(png|jpg|jpeg|gif)$/i, '');
  
  // Clean up the name
  const cleanName = nameWithoutExt
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  
  return `artwork-${cleanName}.${extension}`;
}

async function renameBunnyFiles() {
  console.log('🔄 Renaming Bunny storage files to match RSS feed expectations...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      process.exit(1);
    }

    // Get expected filenames from RSS feeds
    console.log('📋 Reading expected filenames from RSS feeds...');
    const expectedFiles = await getExpectedFilenames();
    console.log(`📊 Found ${expectedFiles.length} expected artwork files`);

    // Get existing files in storage
    const listUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/`;
    
    console.log('📂 Fetching existing files from Bunny storage...');
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list storage files: ${listResponse.status}`);
    }

    const existingFiles = await listResponse.json();
    const filesList = existingFiles.filter(f => !f.IsDirectory);
    console.log(`📊 Found ${filesList.length} files in storage`);

    // Create mapping of expected to existing files
    const renameMap = new Map();
    
    for (const expectedFile of expectedFiles) {
      // Check if expected file already exists
      const existsAlready = filesList.some(f => f.ObjectName === expectedFile);
      if (existsAlready) {
        console.log(`✅ ${expectedFile} already exists`);
        continue;
      }
      
      // Try to find a matching encoded file
      for (const existingFile of filesList) {
        const originalUrl = decodeFilename(existingFile.ObjectName);
        if (originalUrl) {
          const extension = existingFile.ObjectName.split('.').pop();
          const generatedExpected = generateExpectedFilename(originalUrl, extension);
          
          if (generatedExpected === expectedFile) {
            renameMap.set(existingFile.ObjectName, expectedFile);
            console.log(`🎯 Map: ${existingFile.ObjectName} → ${expectedFile}`);
            break;
          }
        }
      }
    }

    console.log(`\n📊 Found ${renameMap.size} files to rename`);

    if (renameMap.size === 0) {
      console.log('✅ No files need renaming!');
      return;
    }

    // Perform renames by copying files with new names
    let renameCount = 0;
    for (const [oldName, newName] of renameMap) {
      try {
        console.log(`\n🔄 Renaming: ${oldName} → ${newName}`);
        
        // Download the file
        const downloadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${oldName}`;
        const downloadResponse = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY
          }
        });
        
        if (!downloadResponse.ok) {
          console.log(`❌ Failed to download ${oldName}: ${downloadResponse.status}`);
          continue;
        }
        
        const fileData = await downloadResponse.arrayBuffer();
        const extension = newName.split('.').pop();
        
        // Upload with new name
        const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${newName}`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': `image/${extension}`
          },
          body: fileData
        });
        
        if (uploadResponse.ok) {
          console.log(`✅ Created: ${newName}`);
          renameCount++;
          
          // Optional: Delete old file (commented out for safety)
          // const deleteUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/cache/artwork/${oldName}`;
          // await fetch(deleteUrl, { method: 'DELETE', headers: { 'AccessKey': BUNNY_STORAGE_API_KEY } });
          // console.log(`🗑️  Deleted: ${oldName}`);
        } else {
          console.log(`❌ Failed to upload ${newName}: ${uploadResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`❌ Error renaming ${oldName}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Rename complete!`);
    console.log(`📊 Successfully created ${renameCount} new files with expected names`);
    console.log(`📝 Original encoded files are kept for safety`);
    console.log(`🔄 CDN cache will update automatically`);
    
  } catch (error) {
    console.error('❌ Error renaming files:', error.message);
    process.exit(1);
  }
}

// Run the rename
renameBunnyFiles();