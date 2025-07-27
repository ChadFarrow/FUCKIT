#!/usr/bin/env node

/**
 * Fix CDN URLs back to FUCKIT.b-cdn.net
 * 
 * The actual CDN configured is FUCKIT.b-cdn.net, not re-podtards-cdn
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixCDNUrlsBack() {
  console.log('🔧 Fixing CDN URLs back to FUCKIT.b-cdn.net...\n');
  
  try {
    // Read parsed feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    let feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    // Count occurrences
    const wrongUrlCount = (feedsContent.match(/re-podtards-cdn\.b-cdn\.net/g) || []).length;
    console.log(`📊 Found ${wrongUrlCount} instances of re-podtards-cdn.b-cdn.net`);
    
    // Replace all instances back to FUCKIT
    feedsContent = feedsContent.replace(/re-podtards-cdn\.b-cdn\.net/g, 'FUCKIT.b-cdn.net');
    
    // Save updated file
    await fs.writeFile(feedsPath, feedsContent);
    
    // Verify
    const updatedContent = await fs.readFile(feedsPath, 'utf8');
    const remainingWrong = (updatedContent.match(/re-podtards-cdn\.b-cdn\.net/g) || []).length;
    const correctUrls = (updatedContent.match(/FUCKIT\.b-cdn\.net/g) || []).length;
    
    console.log(`\n✅ Success!`);
    console.log(`📊 Replaced ${wrongUrlCount} URLs`);
    console.log(`📊 Now using correct CDN: FUCKIT.b-cdn.net (${correctUrls} URLs)`);
    console.log(`📊 Remaining wrong URLs: ${remainingWrong}`);
    
  } catch (error) {
    console.error('❌ Error fixing CDN URLs:', error.message);
  }
}

fixCDNUrlsBack();