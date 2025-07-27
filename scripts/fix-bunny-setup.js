#!/usr/bin/env node

/**
 * Fix Bunny Setup to Match Actual Configuration
 * 
 * Correct setup:
 * - Pull Zone: FUCKIT
 * - Hostname: FUCKIT.b-cdn.net
 * - Origin: re-podtards-cache storage
 * - Folders: /artwork/ and /audio/
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixBunnySetup() {
  console.log('🔧 Fixing Bunny setup to match actual configuration...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    
    // Read the current data
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    console.log('📂 Loaded parsed-feeds.json');
    
    // Count current URLs
    const oldURLs = feedsData.match(/re-podtards-cdn\.b-cdn\.net/g);
    console.log(`📊 Found ${oldURLs?.length || 0} re-podtards-cdn.b-cdn.net URLs`);
    
    // Fix the hostnames - change re-podtards-cdn to FUCKIT and fix paths
    let updatedData = feedsData
      .replace(/re-podtards-cdn\.b-cdn\.net/g, 'FUCKIT.b-cdn.net')
      // Fix path: change /artwork/ back to /cache/artwork/ since that's where files actually are
      .replace(/FUCKIT\.b-cdn\.net\/artwork\//g, 'FUCKIT.b-cdn.net/cache/artwork/');
    
    // Count after changes
    const newURLs = updatedData.match(/FUCKIT\.b-cdn\.net/g);
    console.log(`✅ Updated to ${newURLs?.length || 0} FUCKIT.b-cdn.net URLs (correct case)`);
    
    // Create backup
    const backupPath = `${feedsPath}.backup-${Date.now()}`;
    await fs.copyFile(feedsPath, backupPath);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
    
    // Write updated data
    await fs.writeFile(feedsPath, updatedData, 'utf8');
    console.log('✅ Updated parsed-feeds.json');
    
    // Test a sample URL
    console.log('\n🧪 Sample URLs after update:');
    const sampleMatch = updatedData.match(/https:\/\/FUCKIT\.b-cdn\.net\/artwork\/[^"]+/);
    if (sampleMatch) {
      console.log(`📎 ${sampleMatch[0]}`);
    }
    
    console.log('\n🎉 Bunny setup fix complete!');
    console.log('URLs now use: FUCKIT.b-cdn.net/artwork/ and FUCKIT.b-cdn.net/audio/');
    
  } catch (error) {
    console.error('❌ Error fixing Bunny setup:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixBunnySetup();