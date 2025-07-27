#!/usr/bin/env node

/**
 * Fix CDN URLs in parsed-feeds.json
 * 
 * Replace FUCKIT.b-cdn.net with re-podtards-cdn.b-cdn.net
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixCDNUrls() {
  console.log('🔧 Fixing CDN URLs in parsed-feeds.json...\n');
  
  try {
    // Read parsed feeds
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    let feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    // Count occurrences
    const wrongUrlCount = (feedsContent.match(/FUCKIT\.b-cdn\.net/g) || []).length;
    console.log(`=� Found ${wrongUrlCount} instances of FUCKIT.b-cdn.net`);
    
    // Replace all instances
    feedsContent = feedsContent.replace(/FUCKIT\.b-cdn\.net/g, 're-podtards-cdn.b-cdn.net');
    
    // Save updated file
    await fs.writeFile(feedsPath, feedsContent);
    
    // Verify
    const updatedContent = await fs.readFile(feedsPath, 'utf8');
    const remainingWrong = (updatedContent.match(/FUCKIT\.b-cdn\.net/g) || []).length;
    const correctUrls = (updatedContent.match(/re-podtards-cdn\.b-cdn\.net/g) || []).length;
    
    console.log(`\n Success!`);
    console.log(`=� Replaced ${wrongUrlCount} URLs`);
    console.log(`=� Now using correct CDN: re-podtards-cdn.b-cdn.net (${correctUrls} URLs)`);
    console.log(`=� Remaining wrong URLs: ${remainingWrong}`);
    
  } catch (error) {
    console.error('L Error fixing CDN URLs:', error.message);
  }
}

fixCDNUrls();