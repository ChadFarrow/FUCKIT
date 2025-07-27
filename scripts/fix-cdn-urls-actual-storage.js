#!/usr/bin/env node

/**
 * Fix CDN URLs in parsed-feeds.json to use actual storage paths
 * The images are stored in /cache/artwork/ with encoded filenames
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PARSED_FEEDS_FILE = 'data/parsed-feeds.json';
const CDN_HOSTNAME = 'FUCKIT.b-cdn.net';
const CDN_BASE_PATH = '/cache/artwork/';

// Create backup
function createBackup() {
  const timestamp = Date.now();
  const backupPath = `data/parsed-feeds-backup-${timestamp}.json`;
  
  try {
    fs.copyFileSync(PARSED_FEEDS_FILE, backupPath);
    console.log(`💾 Backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    process.exit(1);
  }
}

// Extract filename from original URL
function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname);
    return filename;
  } catch (error) {
    console.warn(`⚠️  Could not parse URL: ${url}`);
    return null;
  }
}

// Create the actual CDN URL based on storage structure
function createActualCdnUrl(originalUrl, albumTitle) {
  if (!originalUrl || !albumTitle) return null;
  
  const filename = extractFilenameFromUrl(originalUrl);
  if (!filename) return null;
  
  // Create the encoded filename pattern used in storage
  // Format: artwork-{albumTitle}-{base64EncodedOriginalUrl}.{extension}
  const encodedUrl = Buffer.from(originalUrl).toString('base64');
  const extension = path.extname(filename);
  
  // Clean album title for filename
  const cleanAlbumTitle = albumTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const actualFilename = `artwork-${cleanAlbumTitle}-${encodedUrl}${extension}`;
  
  return `https://${CDN_HOSTNAME}${CDN_BASE_PATH}${actualFilename}`;
}

// Update URLs in parsed feeds
function updateCdnUrls() {
  console.log('🔄 Updating CDN URLs to match actual storage structure...\n');
  
  try {
    // Read parsed feeds
    const data = JSON.parse(fs.readFileSync(PARSED_FEEDS_FILE, 'utf8'));
    let updatedCount = 0;
    
    data.feeds.forEach((feed, feedIndex) => {
      if (feed.parsedData && feed.parsedData.album) {
        const album = feed.parsedData.album;
        
        // Update album cover art
        if (album.coverArt) {
          const originalUrl = album.coverArt;
          const actualCdnUrl = createActualCdnUrl(originalUrl, album.title);
          
          if (actualCdnUrl) {
            console.log(`📀 Album: ${album.title}`);
            console.log(`   From: ${album.coverArt}`);
            console.log(`   To:   ${actualCdnUrl}`);
            console.log('');
            
            album.coverArt = actualCdnUrl;
            updatedCount++;
          }
        }
        
        // Update track images
        if (album.tracks) {
          album.tracks.forEach((track, trackIndex) => {
            if (track.image) {
              const originalUrl = track.image;
              const actualCdnUrl = createActualCdnUrl(originalUrl, album.title);
              
              if (actualCdnUrl) {
                console.log(`🎵 Track: ${track.title}`);
                console.log(`   From: ${track.image}`);
                console.log(`   To:   ${actualCdnUrl}`);
                console.log('');
                
                track.image = actualCdnUrl;
                updatedCount++;
              }
            }
          });
        }
      }
    });
    
    // Write updated data
    fs.writeFileSync(PARSED_FEEDS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Successfully updated ${updatedCount} URLs!`);
    return updatedCount;
    
  } catch (error) {
    console.error('❌ Error updating CDN URLs:', error.message);
    return 0;
  }
}

// Test a few URLs
function testCdnUrls() {
  console.log('\n🧪 Testing CDN URLs...\n');
  
  const testUrls = [
    'https://FUCKIT.b-cdn.net/cache/artwork/artwork-18sundays-aHR0cHM6Ly93d3cuZG9lcmZlbHZlcnNlLmNvbS9hcnQvMThzdW5kYXlzLmdpZg.jpg',
    'https://FUCKIT.b-cdn.net/cache/artwork/artwork-able-and-the-wolf-aHR0cHM6Ly9hYmxlYW5kdGhld29sZi5jb20vc3RhdGljL21lZGlhLzA0X1N0YXlBd2hpbGUuZGZiZmQ0YTM0OTQ3MWE4MTdlM2EuanBn-track4.jpg'
  ];
  
  testUrls.forEach((url, index) => {
    console.log(`Test ${index + 1}: ${url}`);
    console.log(`Run: curl -I "${url}"`);
    console.log('');
  });
}

// Main execution
function main() {
  console.log('🎯 Fixing CDN URLs to match actual storage structure\n');
  
  // Create backup
  createBackup();
  
  // Update URLs
  const updatedCount = updateCdnUrls();
  
  if (updatedCount > 0) {
    console.log(`\n📊 Summary: Updated ${updatedCount} URLs`);
    testCdnUrls();
  } else {
    console.log('\n❌ No URLs were updated');
  }
}

main(); 