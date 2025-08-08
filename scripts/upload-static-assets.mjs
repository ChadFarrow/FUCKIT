#!/usr/bin/env node

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Upload Next.js Static Assets to Bunny.net CDN
 * 
 * This script uploads all files from .next/static/ to your Bunny.net CDN
 * so they can be served with the assetPrefix configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get Storage configuration from environment
 */
function getStorageConfig() {
  const config = {
    hostname: process.env.BUNNY_STORAGE_HOSTNAME || 'ny.storage.bunnycdn.com',
    zone: process.env.BUNNY_STORAGE_ZONE || 're-podtards-storage',
    apiKey: process.env.BUNNY_STORAGE_API_KEY,
  };
  
  if (!config.apiKey) {
    throw new Error('BUNNY_STORAGE_API_KEY environment variable is required');
  }
  
  return config;
}

/**
 * Upload a single file to Bunny.net Storage
 */
async function uploadFileToStorage(filePath, storagePath, storageConfig) {
  try {
    console.log(`📤 Uploading: ${filePath} -> ${storagePath}`);
    
    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.woff2') contentType = 'font/woff2';
    else if (ext === '.woff') contentType = 'font/woff';
    else if (ext === '.ttf') contentType = 'font/ttf';
    else if (ext === '.eot') contentType = 'application/vnd.ms-fontobject';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.map') contentType = 'application/json';
    
    // Upload to Bunny.net Storage
    const storageUrl = `https://${storageConfig.hostname}/${storageConfig.zone}/${storagePath}`;
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storageConfig.apiKey,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: fileBuffer
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Return the CDN URL that can be accessed via CDN
    const cdnUrl = `https://re-podtards-cdn.b-cdn.net/${storagePath}`;
    console.log(`✅ Uploaded: ${cdnUrl}`);
    return cdnUrl;
  } catch (error) {
    console.error(`❌ Failed to upload ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Recursively find all files in a directory
 */
async function getAllFiles(dirPath) {
  const files = [];
  
  async function scanDirectory(currentPath) {
    const items = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      
      if (item.isDirectory()) {
        await scanDirectory(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  await scanDirectory(dirPath);
  return files;
}

/**
 * Main upload function
 */
async function uploadStaticAssets() {
  console.log('🚀 Starting Next.js static assets upload to Bunny.net Storage...\n');
  
  const storageConfig = getStorageConfig();
  
  console.log(`📡 Storage Configuration:`);
  console.log(`   Hostname: ${storageConfig.hostname}`);
  console.log(`   Zone: ${storageConfig.zone}`);
  console.log(`   API Key: ${storageConfig.apiKey ? '✅ Set' : '❌ Missing'}\n`);
  
  const staticDir = path.join(process.cwd(), '.next', 'static');
  
  // Check if .next/static directory exists
  try {
    await fs.access(staticDir);
  } catch (error) {
    console.error(`❌ Static directory not found: ${staticDir}`);
    console.error('Please run "npm run build" first to generate static assets.');
    process.exit(1);
  }
  
  // Get all files in the static directory
  const allFiles = await getAllFiles(staticDir);
  
  console.log(`📁 Found ${allFiles.length} static files to upload\n`);
  
  const results = {
    totalFiles: allFiles.length,
    uploadedFiles: 0,
    failedFiles: 0,
    uploadedUrls: []
  };
  
  // Upload each file
  for (const filePath of allFiles) {
    // Calculate the storage path (relative to static directory)
    const relativePath = path.relative(staticDir, filePath);
    const storagePath = `_next/static/${relativePath}`;
    
    const cdnUrl = await uploadFileToStorage(filePath, storagePath, storageConfig);
    
    if (cdnUrl) {
      results.uploadedFiles++;
      results.uploadedUrls.push({
        localPath: filePath,
        storagePath: storagePath,
        cdnUrl: cdnUrl
      });
    } else {
      results.failedFiles++;
    }
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Files: ${results.totalFiles}`);
  console.log(`Uploaded Files: ${results.uploadedFiles}`);
  console.log(`Failed Files: ${results.failedFiles}`);
  console.log(`Success Rate: ${results.totalFiles > 0 ? Math.round((results.uploadedFiles / results.totalFiles) * 100) : 0}%`);
  
  // Save results to file
  const reportPath = path.join(process.cwd(), 'static-assets-upload-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  if (results.uploadedFiles > 0) {
    console.log('\n✅ Static assets upload complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Re-enable CDN asset prefix in next.config.js:');
    console.log('      assetPrefix: process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_CDN_URL || "" : "",');
    console.log('   2. Deploy to production: vercel --prod');
    console.log('   3. Test that static assets load from CDN');
  } else {
    console.log('\n❌ No files were uploaded successfully');
    process.exit(1);
  }
}

// Run the script
uploadStaticAssets().catch(console.error); 