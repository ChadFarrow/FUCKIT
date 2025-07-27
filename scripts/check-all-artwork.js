#!/usr/bin/env node

/**
 * Check All Artwork Files Needed vs What Exists
 * 
 * Comprehensive check of what's needed and what's missing
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

async function checkAllArtwork() {
  console.log('🔍 Checking all artwork files...\n');
  
  try {
    const env = await loadEnv();
    
    const BUNNY_STORAGE_ZONE = env.BUNNY_STORAGE_ZONE || 're-podtards-cache';
    const BUNNY_STORAGE_REGION = env.BUNNY_STORAGE_REGION || 'NY';
    const BUNNY_STORAGE_API_KEY = env.BUNNY_STORAGE_API_KEY;
    
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not found in environment');
      return;
    }

    // Get all artwork URLs from parsed feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    const urlMatches = feedsContent.match(/https:\/\/FUCKIT\.b-cdn\.net\/cache\/artwork\/[^"]+/g) || [];
    const uniqueUrls = [...new Set(urlMatches)];
    
    console.log(`📊 Found ${uniqueUrls.length} unique artwork URLs in parsed-feeds.json\n`);
    
    // Extract just the filenames
    const neededFiles = uniqueUrls.map(url => url.split('/').pop()).filter(Boolean);
    
    // Get list of files in Bunny storage
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
    const existingFiles = files.filter(f => !f.IsDirectory).map(f => f.ObjectName);
    
    console.log(`📦 Found ${existingFiles.length} files in Bunny storage\n`);
    
    // Check what's missing
    const missingFiles = neededFiles.filter(file => !existingFiles.includes(file));
    const extraFiles = existingFiles.filter(file => !neededFiles.includes(file));
    
    console.log(`❌ Missing files: ${missingFiles.length}`);
    console.log(`✅ Existing files: ${neededFiles.length - missingFiles.length}`);
    console.log(`➕ Extra files in storage: ${extraFiles.length}\n`);
    
    if (missingFiles.length > 0) {
      console.log('📋 Missing files (first 10):');
      missingFiles.slice(0, 10).forEach(file => {
        console.log(`   - ${file}`);
      });
      if (missingFiles.length > 10) {
        console.log(`   ... and ${missingFiles.length - 10} more`);
      }
    }
    
    // Check CDN URL mismatch
    console.log('\n⚠️  IMPORTANT: CDN URL Mismatch!');
    console.log('   parsed-feeds.json uses: https://FUCKIT.b-cdn.net');
    console.log('   .env.local uses: https://re-podtards-cdn.b-cdn.net');
    console.log('   This mismatch will cause all images to fail!\n');
    
    // Write missing files list
    const reportPath = path.join(__dirname, '..', 'missing-artwork-report.json');
    await fs.writeFile(reportPath, JSON.stringify({
      totalNeeded: neededFiles.length,
      totalExisting: existingFiles.length,
      missingCount: missingFiles.length,
      missingFiles: missingFiles,
      cdnMismatch: true,
      correctCDN: 'https://re-podtards-cdn.b-cdn.net',
      wrongCDN: 'https://FUCKIT.b-cdn.net'
    }, null, 2));
    
    console.log(`📄 Full report saved to: missing-artwork-report.json`);
    
  } catch (error) {
    console.error('❌ Error checking artwork:', error.message);
  }
}

checkAllArtwork();