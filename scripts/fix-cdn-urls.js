#!/usr/bin/env node

/**
 * Fix CDN URLs in parsed feeds data
 * 
 * This script updates all CDN URLs from re-podtards-cdn.b-cdn.net to FUCKIT.b-cdn.net
 * to match the actual CDN configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixCdnUrls() {
  console.log('🔧 Fixing CDN URLs in parsed feeds data...\n');
  
  try {
    // Read the parsed feeds data
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    const feedsData = JSON.parse(feedsContent);
    
    console.log(`📊 Found ${feedsData.feeds.length} feeds to process\n`);
    
    let totalUrlsFixed = 0;
    
    // Process each feed
    feedsData.feeds.forEach(feed => {
      if (feed.parsedData?.album?.coverArt) {
        const oldUrl = feed.parsedData.album.coverArt;
        if (oldUrl.includes('re-podtards-cdn.b-cdn.net')) {
          const newUrl = oldUrl.replace('re-podtards-cdn.b-cdn.net', 'FUCKIT.b-cdn.net');
          feed.parsedData.album.coverArt = newUrl;
          totalUrlsFixed++;
          console.log(`✅ Fixed album cover: ${path.basename(oldUrl)}`);
        }
      }
      
      // Process tracks
      if (feed.parsedData?.album?.tracks) {
        feed.parsedData.album.tracks.forEach(track => {
          if (track.image && track.image.includes('re-podtards-cdn.b-cdn.net')) {
            const oldUrl = track.image;
            const newUrl = oldUrl.replace('re-podtards-cdn.b-cdn.net', 'FUCKIT.b-cdn.net');
            track.image = newUrl;
            totalUrlsFixed++;
            console.log(`✅ Fixed track image: ${path.basename(oldUrl)}`);
          }
        });
      }
    });
    
    // Save the updated data
    await fs.writeFile(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total URLs fixed: ${totalUrlsFixed}`);
    console.log(`   Updated file: ${feedsPath}`);
    console.log('\n✅ CDN URLs fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing CDN URLs:', error.message);
    process.exit(1);
  }
}

// Run the script
fixCdnUrls().catch(console.error); 