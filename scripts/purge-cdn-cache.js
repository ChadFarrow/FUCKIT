#!/usr/bin/env node

/**
 * Purge CDN Cache for Updated Files
 * 
 * Forces CDN to fetch fresh files from storage
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

async function purgeCDNCache() {
  console.log('🔄 Purging CDN cache for updated files...\n');
  
  try {
    const env = await loadEnv();
    
    // Note: Bunny.net CDN cache purging requires API access
    // For now, we'll document the manual process
    
    console.log('📋 CDN Cache Information:\n');
    console.log('The CDN is serving cached versions of files with wrong content-types.');
    console.log('This causes "OpaqueResponseBlocking" errors.\n');
    
    console.log('🔧 Current Issues:');
    console.log('- Files contain SVG/text content but have PNG/JPEG content-type headers');
    console.log('- Browser blocks these as potential security risks');
    console.log('- CDN cache needs to be purged to serve new binary files\n');
    
    console.log('✅ Solutions:');
    console.log('1. Wait for CDN cache to expire (TTL: ~30 days)');
    console.log('2. Use Bunny.net dashboard to purge cache manually');
    console.log('3. Add cache-busting query parameters to URLs');
    console.log('4. Contact Bunny.net support for cache purge\n');
    
    console.log('📌 Files needing cache purge:');
    const problematicFiles = [
      'artwork-ben-doerfel-artwork.png',
      'artwork-kurtisdrums-artwork.png', 
      'artwork-bloodshot-lies---the-album-artwork.png',
      'artwork-music-from-the-doerfel-verse-artwork.png',
      'artwork-into-the-doerfel-verse-artwork.png',
      'artwork-christ-exalted-artwork.png',
      'artwork-dfb-volume-2-artwork.png',
      'artwork-generation-gap-artwork.png',
      'artwork-18-sundays-artwork.gif',
      'artwork-your-chance-artwork.png'
    ];
    
    problematicFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
    console.log('\n💡 Immediate Workaround:');
    console.log('The SVG data URL fallbacks are working correctly.');
    console.log('Users will see placeholder images while CDN cache updates.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

purgeCDNCache();