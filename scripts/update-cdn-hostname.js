#!/usr/bin/env node

/**
 * Update CDN Hostname in Parsed Data
 * 
 * This script updates the CDN hostname in parsed-feeds.json
 * to use the correct Pull Zone hostname.
 */

import fs from 'fs/promises';
import path from 'path';

// Configuration
const OLD_HOSTNAME = 're-podtards-cdn.b-cdn.net';
const NEW_HOSTNAME = process.argv[2]; // Pass as command line argument

if (!NEW_HOSTNAME) {
  console.log('❌ Please provide the new CDN hostname');
  console.log('📝 Usage: node scripts/update-cdn-hostname.js "re-podtards-12345.b-cdn.net"');
  console.log('');
  console.log('🔍 To find your Pull Zone hostname:');
  console.log('1. Go to Bunny.net Dashboard → CDN → Pull Zones');
  console.log('2. Find your Pull Zone');
  console.log('3. Copy the hostname (e.g., re-podtards-abc123.b-cdn.net)');
  process.exit(1);
}

async function updateCDNHostname() {
  try {
    console.log('🔄 Updating CDN hostname...');
    console.log(`   From: ${OLD_HOSTNAME}`);
    console.log(`   To: ${NEW_HOSTNAME}`);
    
    // Read the parsed data
    const dataPath = path.join(process.cwd(), 'data/parsed-feeds.json');
    const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    
    let updatedCount = 0;
    
    // Update URLs in the data
    data.feeds.forEach(feed => {
      if (feed.parsedData?.album?.coverArt) {
        const oldUrl = feed.parsedData.album.coverArt;
        if (oldUrl.includes(OLD_HOSTNAME)) {
          feed.parsedData.album.coverArt = oldUrl.replace(OLD_HOSTNAME, NEW_HOSTNAME);
          updatedCount++;
        }
      }
      
      if (feed.parsedData?.album?.tracks) {
        feed.parsedData.album.tracks.forEach(track => {
          if (track.image) {
            const oldUrl = track.image;
            if (oldUrl.includes(OLD_HOSTNAME)) {
              track.image = oldUrl.replace(OLD_HOSTNAME, NEW_HOSTNAME);
              updatedCount++;
            }
          }
        });
      }
    });
    
    // Create backup
    const backupPath = path.join(process.cwd(), `data/parsed-feeds-backup-${Date.now()}.json`);
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
    
    // Write updated data
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    
    console.log('\n✅ Successfully updated CDN hostname!');
    console.log(`📊 Updated ${updatedCount} URLs`);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    // Test the new hostname
    console.log('\n🧪 Testing new CDN hostname...');
    const testUrl = `https://${NEW_HOSTNAME}/albums/music-from-the-doerfel-verse-artwork.png`;
    console.log(`   Test URL: ${testUrl}`);
    console.log(`   Run: curl -I "${testUrl}"`);
    
  } catch (error) {
    console.error('❌ Error updating CDN hostname:', error.message);
    process.exit(1);
  }
}

updateCDNHostname(); 