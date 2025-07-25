#!/usr/bin/env node

/**
 * Upload RSS Feed Images to Bunny.net CDN
 * 
 * This script:
 * 1. Fetches all RSS feeds
 * 2. Extracts album artwork URLs
 * 3. Downloads and uploads images to Bunny.net CDN
 * 4. Updates the RSS data with CDN URLs
 */

import { RSSParser } from '../lib/rss-parser.ts';
import { getCDNConfig, purgeCDNCache } from '../lib/cdn-utils.ts';
import fs from 'fs/promises';
import path from 'path';

// RSS feed URLs to process
const RSS_FEEDS = [
  // Main Doerfels feeds
  'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
  'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
  
  // Additional Doerfels albums
  'https://www.doerfelverse.com/feeds/18sundays.xml',
  'https://www.doerfelverse.com/feeds/alandace.xml',
  'https://www.doerfelverse.com/feeds/autumn.xml',
  'https://www.doerfelverse.com/feeds/christ-exalted.xml',
  'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
  'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
  'https://www.doerfelverse.com/feeds/dfbv1.xml',
  'https://www.doerfelverse.com/feeds/dfbv2.xml',
  'https://www.doerfelverse.com/feeds/disco-swag.xml',
  'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
  'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
  'https://www.doerfelverse.com/feeds/generation-gap.xml',
  'https://www.doerfelverse.com/feeds/heartbreak.xml',
  'https://www.doerfelverse.com/feeds/merry-christmix.xml',
  'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
  'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
  'https://www.doerfelverse.com/feeds/possible.xml',
  'https://www.doerfelverse.com/feeds/pour-over.xml',
  'https://www.doerfelverse.com/feeds/psalm-54.xml',
  'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
  'https://www.doerfelverse.com/feeds/they-dont-know.xml',
  'https://www.doerfelverse.com/feeds/think-ep.xml',
  'https://www.doerfelverse.com/feeds/underwater-single.xml',
  'https://www.doerfelverse.com/feeds/unsound-existence.xml',
  'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
  'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
  'https://www.doerfelverse.com/feeds/your-chance.xml',
  
  // Ed Doerfel projects
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
  
  // TJ Doerfel projects
  'https://www.thisisjdog.com/media/ring-that-bell.xml',
];

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    console.log(`📥 Downloading: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`❌ Failed to download ${url}:`, error.message);
    return null;
  }
}

/**
 * Upload image to Bunny.net CDN
 */
async function uploadToBunny(imageBuffer, filename, cdnConfig) {
  try {
    const storageUrl = `https://storage.bunnycdn.com/${cdnConfig.zone}/albums/${filename}`;
    
    console.log(`📤 Uploading to Bunny.net: ${filename}`);
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': cdnConfig.apiKey,
        'Content-Type': 'image/jpeg',
      },
      body: imageBuffer
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const cdnUrl = `https://${cdnConfig.hostname}/albums/${filename}`;
    console.log(`✅ Uploaded: ${cdnUrl}`);
    return cdnUrl;
  } catch (error) {
    console.error(`❌ Failed to upload ${filename}:`, error.message);
    return null;
  }
}

/**
 * Generate filename from URL
 */
function generateFilename(url, albumTitle, trackTitle = null) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = path.extname(pathname) || '.jpg';
    
    // Clean album/track titles for filename
    const cleanAlbumTitle = albumTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const cleanTrackTitle = trackTitle ? trackTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : '';
    
    if (trackTitle) {
      return `${cleanAlbumTitle}-${cleanTrackTitle}${extension}`;
    } else {
      return `${cleanAlbumTitle}-artwork${extension}`;
    }
  } catch (error) {
    // Fallback to URL hash
    const urlHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    return `album-${urlHash}.jpg`;
  }
}

/**
 * Process all RSS feeds and upload images
 */
async function processRSSFeeds() {
  console.log('🚀 Starting RSS feed image upload to Bunny.net CDN...\n');
  
  const cdnConfig = getCDNConfig();
  
  if (!cdnConfig.apiKey || !cdnConfig.zone || cdnConfig.hostname === 'your-zone.b-cdn.net') {
    console.error('❌ Bunny.net CDN not configured. Please set up environment variables:');
    console.error('   BUNNY_CDN_HOSTNAME, BUNNY_CDN_ZONE, BUNNY_CDN_API_KEY');
    process.exit(1);
  }
  
  console.log(`📡 CDN Configuration:`);
  console.log(`   Hostname: ${cdnConfig.hostname}`);
  console.log(`   Zone: ${cdnConfig.zone}`);
  console.log(`   API Key: ${cdnConfig.apiKey ? '✅ Set' : '❌ Missing'}\n`);
  
  const results = {
    totalFeeds: RSS_FEEDS.length,
    processedFeeds: 0,
    totalImages: 0,
    uploadedImages: 0,
    failedImages: 0,
    albums: []
  };
  
  // Process each RSS feed
  for (const feedUrl of RSS_FEEDS) {
    try {
      console.log(`\n🔄 Processing feed: ${feedUrl}`);
      
      // Parse RSS feed
      const album = await RSSParser.parseAlbumFeed(feedUrl);
      
      if (!album) {
        console.log(`⚠️  No album data found for: ${feedUrl}`);
        continue;
      }
      
      results.processedFeeds++;
      console.log(`📦 Album: "${album.title}" by ${album.artist} (${album.tracks.length} tracks)`);
      
      const albumData = {
        title: album.title,
        artist: album.artist,
        originalArtwork: album.coverArt,
        cdnArtwork: null,
        tracks: []
      };
      
      // Upload album artwork
      if (album.coverArt) {
        results.totalImages++;
        const imageBuffer = await downloadImage(album.coverArt);
        
        if (imageBuffer) {
          const filename = generateFilename(album.coverArt, album.title);
          const cdnUrl = await uploadToBunny(imageBuffer, filename, cdnConfig);
          
          if (cdnUrl) {
            albumData.cdnArtwork = cdnUrl;
            results.uploadedImages++;
            console.log(`✅ Album artwork uploaded: ${cdnUrl}`);
          } else {
            results.failedImages++;
            console.log(`❌ Failed to upload album artwork`);
          }
        } else {
          results.failedImages++;
        }
      }
      
      // Upload track artwork
      for (const track of album.tracks) {
        if (track.image) {
          results.totalImages++;
          const imageBuffer = await downloadImage(track.image);
          
          if (imageBuffer) {
            const filename = generateFilename(track.image, album.title, track.title);
            const cdnUrl = await uploadToBunny(imageBuffer, filename, cdnConfig);
            
            if (cdnUrl) {
              albumData.tracks.push({
                title: track.title,
                originalImage: track.image,
                cdnImage: cdnUrl
              });
              results.uploadedImages++;
              console.log(`✅ Track artwork uploaded: ${track.title} -> ${cdnUrl}`);
            } else {
              results.failedImages++;
              console.log(`❌ Failed to upload track artwork: ${track.title}`);
            }
          } else {
            results.failedImages++;
          }
        }
      }
      
      results.albums.push(albumData);
      
    } catch (error) {
      console.error(`❌ Error processing feed ${feedUrl}:`, error.message);
    }
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total RSS Feeds: ${results.totalFeeds}`);
  console.log(`Processed Feeds: ${results.processedFeeds}`);
  console.log(`Total Images: ${results.totalImages}`);
  console.log(`Uploaded Images: ${results.uploadedImages}`);
  console.log(`Failed Images: ${results.failedImages}`);
  console.log(`Success Rate: ${results.totalImages > 0 ? Math.round((results.uploadedImages / results.totalImages) * 100) : 0}%`);
  
  // Save results to file
  const reportPath = path.join(process.cwd(), 'bunny-upload-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  // Purge CDN cache to ensure fresh content
  console.log('\n🧹 Purging CDN cache...');
  await purgeCDNCache();
  
  console.log('\n✅ Bunny.net CDN upload complete!');
}

// Run the script
processRSSFeeds().catch(console.error); 