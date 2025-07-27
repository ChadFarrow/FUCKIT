#!/usr/bin/env node

/**
 * Copy Cache Files to Albums Directory
 * 
 * This script copies artwork files from the cache directory to the albums directory
 * on Bunny.net storage to match the expected URLs in the parsed feeds data.
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

async function copyCacheToAlbums() {
  console.log('🔄 Copying cache files to albums directory...\n');
  
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
    
    // Read the parsed feeds data
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    const feedsData = JSON.parse(feedsContent);
    
    console.log(`📊 Found ${feedsData.feeds.length} feeds to process`);
    
    let copiedCount = 0;
    let errorCount = 0;
    const copyReport = {
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      copied: 0,
      errors: 0,
      details: []
    };
    
    // Process each feed
    for (const feed of feedsData.feeds) {
      if (feed.parsedData && feed.parsedData.album) {
        // Handle album cover art
        if (feed.parsedData.album.coverArt) {
          try {
            const coverArtUrl = feed.parsedData.album.coverArt;
            
            // Extract filename from artwork URL
            const url = new URL(coverArtUrl);
            const pathParts = url.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            
            // Extract the original URL from the base64 part
            const base64Part = filename.replace(/^artwork-.*?-/, '').replace(/\.[^.]+$/, '');
            const originalUrl = Buffer.from(base64Part, 'base64').toString('utf8');
            
            // Extract the original filename
            const originalUrlObj = new URL(originalUrl);
            const originalPathParts = originalUrlObj.pathname.split('/');
            const originalFilename = originalPathParts[originalPathParts.length - 1];
            
            // Create paths
            const cachePath = `cache/artwork/${filename}`;
            const albumPath = `albums/${originalFilename}`;
            
            copyReport.totalFiles++;
            
            // Download from cache
            console.log(`📥 Downloading from cache: ${cachePath}`);
            const downloadResponse = await fetch(`${STORAGE_URL}/${cachePath}`, {
              method: 'GET',
              headers: {
                'AccessKey': BUNNY_STORAGE_API_KEY
              }
            });
            
            if (!downloadResponse.ok) {
              throw new Error(`Download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`);
            }
            
            const buffer = await downloadResponse.buffer();
            
            // Upload to albums directory
            console.log(`📤 Uploading to albums: ${albumPath}`);
            const uploadResponse = await fetch(`${STORAGE_URL}/${albumPath}`, {
              method: 'PUT',
              headers: {
                'AccessKey': BUNNY_STORAGE_API_KEY,
                'Content-Type': downloadResponse.headers.get('content-type') || 'image/jpeg'
              },
              body: buffer
            });
            
            if (uploadResponse.ok) {
              console.log(`✅ Copied: ${cachePath} → ${albumPath}`);
              copiedCount++;
              copyReport.copied++;
              copyReport.details.push({
                album: feed.parsedData.album.title,
                cachePath,
                albumPath,
                status: 'success'
              });
            } else {
              const errorText = await uploadResponse.text();
              throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Error copying cover art for "${feed.parsedData.album.title}":`, error.message);
            errorCount++;
            copyReport.errors++;
            copyReport.details.push({
              album: feed.parsedData.album.title,
              error: error.message,
              status: 'error'
            });
          }
        }
        
        // Handle track artwork (if different from album artwork)
        if (feed.parsedData.album.tracks && Array.isArray(feed.parsedData.album.tracks)) {
          for (const track of feed.parsedData.album.tracks) {
            if (track.image && track.image !== feed.parsedData.album.coverArt) {
              try {
                const trackImageUrl = track.image;
                
                // Extract filename from artwork URL
                const url = new URL(trackImageUrl);
                const pathParts = url.pathname.split('/');
                const filename = pathParts[pathParts.length - 1];
                
                // Extract the original URL from the base64 part
                const base64Part = filename.replace(/^artwork-.*?-/, '').replace(/\.[^.]+$/, '');
                const originalUrl = Buffer.from(base64Part, 'base64').toString('utf8');
                
                // Extract the original filename
                const originalUrlObj = new URL(originalUrl);
                const originalPathParts = originalUrlObj.pathname.split('/');
                const originalFilename = originalPathParts[originalPathParts.length - 1];
                
                // Create paths
                const cachePath = `cache/artwork/${filename}`;
                const albumPath = `albums/${originalFilename}`;
                
                copyReport.totalFiles++;
                
                // Download from cache
                console.log(`📥 Downloading track image from cache: ${cachePath}`);
                const downloadResponse = await fetch(`${STORAGE_URL}/${cachePath}`, {
                  method: 'GET',
                  headers: {
                    'AccessKey': BUNNY_STORAGE_API_KEY
                  }
                });
                
                if (!downloadResponse.ok) {
                  throw new Error(`Download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`);
                }
                
                const buffer = await downloadResponse.buffer();
                
                // Upload to albums directory
                console.log(`📤 Uploading track image to albums: ${albumPath}`);
                const uploadResponse = await fetch(`${STORAGE_URL}/${albumPath}`, {
                  method: 'PUT',
                  headers: {
                    'AccessKey': BUNNY_STORAGE_API_KEY,
                    'Content-Type': downloadResponse.headers.get('content-type') || 'image/jpeg'
                  },
                  body: buffer
                });
                
                if (uploadResponse.ok) {
                  console.log(`✅ Copied track image: ${cachePath} → ${albumPath}`);
                  copiedCount++;
                  copyReport.copied++;
                  copyReport.details.push({
                    album: feed.parsedData.album.title,
                    track: track.title,
                    cachePath,
                    albumPath,
                    status: 'success'
                  });
                } else {
                  const errorText = await uploadResponse.text();
                  throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (error) {
                console.error(`❌ Error copying track image for "${track.title}":`, error.message);
                errorCount++;
                copyReport.errors++;
                copyReport.details.push({
                  album: feed.parsedData.album.title,
                  track: track.title,
                  error: error.message,
                  status: 'error'
                });
              }
            }
          }
        }
      }
    }
    
    // Save copy report
    const reportPath = path.join(__dirname, '..', 'cache-to-albums-copy-report.json');
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

copyCacheToAlbums(); 