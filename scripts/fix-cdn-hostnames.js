#!/usr/bin/env node

/**
 * Fix CDN Hostnames in Parsed Feeds
 * 
 * Updates all re-podtards-cdn.b-cdn.net URLs to use fuckit.b-cdn.net
 * and fixes the path structure to match the pull zone configuration
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixCDNHostnames() {
  console.log('🔧 Fixing CDN hostnames in parsed feeds...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    
    // Read the current data
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    console.log('📂 Loaded parsed-feeds.json');
    
    // Count current URLs
    const currentCDNMatches = feedsData.match(/re-podtards-cdn\.b-cdn\.net/g);
    const currentCacheMatches = feedsData.match(/\/cache\/artwork\//g);
    
    console.log(`📊 Found ${currentCDNMatches?.length || 0} re-podtards-cdn URLs`);
    console.log(`📊 Found ${currentCacheMatches?.length || 0} /cache/artwork/ paths`);
    
    // Fix the hostnames and paths
    let updatedData = feedsData
      // Change hostname from re-podtards-cdn to fuckit
      .replace(/re-podtards-cdn\.b-cdn\.net/g, 'fuckit.b-cdn.net')
      // Remove /cache/ prefix since pull zone serves storage root
      .replace(/\/cache\/artwork\//g, '/artwork/');
    
    // Count after changes
    const newCDNMatches = updatedData.match(/fuckit\.b-cdn\.net/g);
    const newArtworkMatches = updatedData.match(/\/artwork\//g);
    
    console.log(`✅ Updated to ${newCDNMatches?.length || 0} fuckit.b-cdn.net URLs`);
    console.log(`✅ Updated to ${newArtworkMatches?.length || 0} /artwork/ paths`);
    
    // Create backup
    const backupPath = `${feedsPath}.backup-${Date.now()}`;
    await fs.copyFile(feedsPath, backupPath);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
    
    // Write updated data
    await fs.writeFile(feedsPath, updatedData, 'utf8');
    console.log('✅ Updated parsed-feeds.json');
    
    // Test a sample URL
    console.log('\n🧪 Sample URLs after update:');
    const sampleMatch = updatedData.match(/https:\/\/fuckit\.b-cdn\.net\/artwork\/[^"]+/);
    if (sampleMatch) {
      console.log(`📎 ${sampleMatch[0]}`);
    }
    
    console.log('\n🎉 CDN hostname fix complete!');
    console.log('🔄 Restart the dev server to see changes');
    
  } catch (error) {
    console.error('❌ Error fixing CDN hostnames:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixCDNHostnames();