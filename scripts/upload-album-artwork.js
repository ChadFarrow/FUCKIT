#!/usr/bin/env node

/**
 * Upload Album Artwork to Bunny.net CDN
 * 
 * This script uploads album artwork files to the /albums/ path on the CDN
 * to match the URLs expected by the parsed feeds data.
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

async function uploadAlbumArtwork() {
  console.log('🎨 Uploading album artwork to Bunny.net CDN...\n');
  
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
    
    let uploadedCount = 0;
    let errorCount = 0;
    const uploadReport = {
      timestamp: new Date().toISOString(),
      totalAlbums: 0,
      uploaded: 0,
      errors: 0,
      details: []
    };
    
    // Process each feed
    for (const feed of feedsData.feeds) {
      if (feed.parsedData && feed.parsedData.album) {
        uploadReport.totalAlbums++;
        
        // Handle album cover art
        if (feed.parsedData.album.coverArt) {
          try {
            const coverArtUrl = feed.parsedData.album.coverArt;
            
            // Extract filename from artwork URL
            const url = new URL(coverArtUrl);
            const pathParts = url.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            
            // Create album path
            const albumPath = `albums/${filename}`;
            
            // Download the artwork
            console.log(`📥 Downloading: ${coverArtUrl}`);
            const response = await fetch(coverArtUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.buffer();
            
            // Upload to Bunny.net Storage
            console.log(`📤 Uploading: ${albumPath}`);
            const uploadResponse = await fetch(`${STORAGE_URL}/${albumPath}`, {
              method: 'PUT',
              headers: {
                'AccessKey': BUNNY_STORAGE_API_KEY,
                'Content-Type': response.headers.get('content-type') || 'image/jpeg'
              },
              body: buffer
            });
            
            if (uploadResponse.ok) {
              console.log(`✅ Uploaded: ${albumPath}`);
              uploadedCount++;
              uploadReport.uploaded++;
              uploadReport.details.push({
                album: feed.parsedData.album.title,
                originalUrl: coverArtUrl,
                cdnPath: albumPath,
                status: 'success'
              });
            } else {
              const errorText = await uploadResponse.text();
              throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Error uploading cover art for "${feed.parsedData.album.title}":`, error.message);
            errorCount++;
            uploadReport.errors++;
            uploadReport.details.push({
              album: feed.parsedData.album.title,
              originalUrl: feed.parsedData.album.coverArt,
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
                
                // Create track path
                const trackPath = `albums/${filename}`;
                
                // Download the artwork
                console.log(`📥 Downloading track image: ${trackImageUrl}`);
                const response = await fetch(trackImageUrl);
                
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const buffer = await response.buffer();
                
                // Upload to Bunny.net Storage
                console.log(`📤 Uploading: ${trackPath}`);
                const uploadResponse = await fetch(`${STORAGE_URL}/${trackPath}`, {
                  method: 'PUT',
                  headers: {
                    'AccessKey': BUNNY_STORAGE_API_KEY,
                    'Content-Type': response.headers.get('content-type') || 'image/jpeg'
                  },
                  body: buffer
                });
                
                if (uploadResponse.ok) {
                  console.log(`✅ Uploaded: ${trackPath}`);
                  uploadedCount++;
                  uploadReport.uploaded++;
                  uploadReport.details.push({
                    album: feed.parsedData.album.title,
                    track: track.title,
                    originalUrl: trackImageUrl,
                    cdnPath: trackPath,
                    status: 'success'
                  });
                } else {
                  const errorText = await uploadResponse.text();
                  throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (error) {
                console.error(`❌ Error uploading track image for "${track.title}":`, error.message);
                errorCount++;
                uploadReport.errors++;
                uploadReport.details.push({
                  album: feed.parsedData.album.title,
                  track: track.title,
                  originalUrl: track.image,
                  error: error.message,
                  status: 'error'
                });
              }
            }
          }
        }
      }
    }
    
    // Save upload report
    const reportPath = path.join(__dirname, '..', 'album-artwork-upload-report.json');
    await fs.writeFile(reportPath, JSON.stringify(uploadReport, null, 2));
    
    console.log('\n📊 Upload Summary:');
    console.log(`✅ Successfully uploaded: ${uploadedCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    if (uploadedCount > 0) {
      console.log('\n🎉 Album artwork is now available at:');
      console.log(`https://FUCKIT.b-cdn.net/albums/[filename]`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

uploadAlbumArtwork(); 