#!/usr/bin/env node

/**
 * Use Storage Zone's Built-in CDN
 * 
 * Bunny storage zones have their own CDN URLs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function useStorageCDN() {
  console.log('🔧 Updating to use storage zone CDN URL...\n');
  
  try {
    // The storage zone CDN URL format is: {storagezone}.b-cdn.net
    const storageZoneName = 're-podtards-cache';
    const storageCDNUrl = `${storageZoneName}.b-cdn.net`;
    
    console.log(`📋 Storage Zone: ${storageZoneName}`);
    console.log(`📋 Storage CDN URL: https://${storageCDNUrl}\n`);
    
    // Read parsed feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    let feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    // Count occurrences
    const oldUrlCount = (feedsContent.match(/FUCKIT\.b-cdn\.net/g) || []).length;
    console.log(`📊 Found ${oldUrlCount} instances of FUCKIT.b-cdn.net`);
    
    // Replace all instances with storage CDN
    feedsContent = feedsContent.replace(/FUCKIT\.b-cdn\.net/g, storageCDNUrl);
    
    // Save updated file
    await fs.writeFile(feedsPath, feedsContent);
    
    // Verify
    const updatedContent = await fs.readFile(feedsPath, 'utf8');
    const remainingOld = (updatedContent.match(/FUCKIT\.b-cdn\.net/g) || []).length;
    const newUrls = (updatedContent.match(new RegExp(storageCDNUrl.replace(/\./g, '\\.'), 'g')) || []).length;
    
    console.log(`\n✅ Success!`);
    console.log(`📊 Replaced ${oldUrlCount} URLs`);
    console.log(`📊 Now using storage CDN: https://${storageCDNUrl} (${newUrls} URLs)`);
    console.log(`📊 Remaining FUCKIT URLs: ${remainingOld}`);
    console.log(`\n💡 This uses the storage zone's built-in CDN which serves the actual files we uploaded!`);
    
  } catch (error) {
    console.error('❌ Error updating CDN URLs:', error.message);
  }
}

useStorageCDN();