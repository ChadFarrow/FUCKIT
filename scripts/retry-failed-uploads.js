#!/usr/bin/env node

/**
 * Retry Failed Uploads to Bunny.net Storage
 * 
 * This script retries uploading the files that failed during the main upload process.
 * It reads the failed-uploads.txt file and attempts to upload each file again.
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
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.log('⚠️  .env.local not found, using existing environment variables');
  }
}

async function retryFailedUploads() {
  console.log('🔄 Starting retry of failed uploads...\n');
  
  try {
    // Load environment variables
    await loadEnvFile();
    
    // Check required environment variables
    const storageZone = process.env.BUNNY_STORAGE_ZONE;
    const apiKey = process.env.BUNNY_STORAGE_API_KEY;
    const region = process.env.BUNNY_STORAGE_REGION || 'NY';
    
    if (!storageZone || !apiKey) {
      throw new Error('Missing required environment variables: BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY');
    }
    
    console.log('📡 Storage Configuration:');
    console.log(`   Storage Zone: ${storageZone}`);
    console.log(`   Region: ${region}`);
    console.log(`   API Key: ${apiKey ? '✅ Set' : '❌ Missing'}\n`);
    
    // Read failed uploads list
    const failedUploadsPath = path.join(__dirname, '..', 'failed-uploads.txt');
    const failedUploadsContent = await fs.readFile(failedUploadsPath, 'utf8');
    const failedFiles = failedUploadsContent.trim().split('\n').filter(line => line.trim());
    
    console.log(`📋 Found ${failedFiles.length} failed uploads to retry\n`);
    
    if (failedFiles.length === 0) {
      console.log('✅ No failed uploads to retry!');
      return;
    }
    
    // Read cache metadata to get file paths
    const metadataPath = path.join(__dirname, '..', 'data', 'cache', 'cache-metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    const cacheItems = JSON.parse(metadataContent);
    
    // Create a map of filename to cache item
    const cacheMap = new Map();
    cacheItems.forEach(item => {
      const filename = item.filename || item.id;
      if (filename) {
        cacheMap.set(filename, item);
      }
    });
    
    let successCount = 0;
    let failureCount = 0;
    const retryResults = [];
    
    // Retry each failed upload
    for (let i = 0; i < failedFiles.length; i++) {
      const filename = failedFiles[i];
      console.log(`🔄 Retrying ${i + 1}/${failedFiles.length}: ${filename}`);
      
      // Remove .mp3 extension to match cache ID format
      const cacheId = filename.replace(/\.mp3$/, '');
      const cacheItem = cacheMap.get(cacheId);
      if (!cacheItem) {
        console.log(`   ❌ Cache item not found for ${filename}`);
        failureCount++;
        retryResults.push({ filename, status: 'not_found', error: 'Cache item not found' });
        continue;
      }
      
      try {
        // Determine file type and path
        const isAudio = filename.startsWith('audio-');
        const fileType = isAudio ? 'audio' : 'artwork';
        const localPath = path.join(__dirname, '..', 'data', 'cache', fileType, filename);
        
        // Check if file exists locally
        try {
          await fs.access(localPath);
        } catch (error) {
          console.log(`   ❌ Local file not found: ${localPath}`);
          failureCount++;
          retryResults.push({ filename, status: 'file_not_found', error: 'Local file not found' });
          continue;
        }
        
        // Upload to Bunny.net
        const cdnPath = `cache/${fileType}/${filename}`;
        const uploadUrl = `https://${region.toLowerCase()}.storage.bunnycdn.com/${storageZone}/${cdnPath}`;
        
        const fileBuffer = await fs.readFile(localPath);
        
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': apiKey,
            'Content-Type': isAudio ? 'audio/mpeg' : 'image/jpeg',
            'Content-Length': fileBuffer.length.toString()
          },
          body: fileBuffer
        });
        
        if (response.ok) {
          const cdnUrl = `https://re-podtards-cdn.b-cdn.net/${cdnPath}`;
          console.log(`   ✅ Retry successful: ${cdnUrl}`);
          successCount++;
          retryResults.push({ filename, status: 'success', cdnUrl });
          
          // Update cache metadata with CDN URL
          if (isAudio) {
            cacheItem.cdnAudio = cdnUrl;
          } else {
            cacheItem.cdnArtwork = cdnUrl;
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Retry failed: ${response.status} - ${errorText}`);
          failureCount++;
          retryResults.push({ filename, status: 'failed', error: `${response.status}: ${errorText}` });
        }
        
        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Retry error: ${error.message}`);
        failureCount++;
        retryResults.push({ filename, status: 'error', error: error.message });
      }
    }
    
    // Save updated cache metadata
    await fs.writeFile(metadataPath, JSON.stringify(cacheItems, null, 2));
    
    // Generate retry report
    const retryReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRetries: failedFiles.length,
        successful: successCount,
        failed: failureCount,
        successRate: ((successCount / failedFiles.length) * 100).toFixed(1) + '%'
      },
      results: retryResults
    };
    
    const reportPath = path.join(__dirname, '..', 'retry-upload-report.json');
    await fs.writeFile(reportPath, JSON.stringify(retryReport, null, 2));
    
    console.log('\n📊 Retry Summary:');
    console.log(`   Total retries: ${failedFiles.length}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failureCount}`);
    console.log(`   Success rate: ${retryReport.summary.successRate}`);
    console.log(`   Report saved: ${reportPath}`);
    
    if (successCount > 0) {
      console.log('\n✅ Retry completed successfully!');
    } else {
      console.log('\n⚠️  All retries failed. Check network connection and API credentials.');
    }
    
  } catch (error) {
    console.error('❌ Error during retry process:', error.message);
    process.exit(1);
  }
}

// Run the retry process
retryFailedUploads(); 