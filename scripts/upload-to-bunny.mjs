#!/usr/bin/env node

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Smart RSS Feed Image Upload to Bunny.net Storage
 * 
 * This script:
 * 1. Fetches all RSS feeds
 * 2. Extracts album artwork URLs
 * 3. Only uploads images that would benefit from CDN optimization
 * 4. Updates the RSS data with CDN URLs when beneficial
 */

import fs from 'fs/promises';
import path from 'path';

// Performance thresholds for CDN usage
const CDN_THRESHOLDS = {
  // Only upload images from slow domains
  SLOW_DOMAINS: [
    'doerfelverse.com',
    'sirtjthewrathful.com', 
    'thisisjdog.com',
    'wavlake.com',
  ],
  // Skip domains that are already fast
  FAST_DOMAINS: [
    're-podtards.b-cdn.net', // Already on our CDN
    'localhost',
    '127.0.0.1',
    'vercel.app',
    'vercel.com',
  ]
};

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
 * Get Storage configuration from environment
 */
function getStorageConfig() {
  const config = {
    hostname: process.env.BUNNY_STORAGE_HOSTNAME || 'ny.storage.bunnycdn.com',
    zone: process.env.BUNNY_STORAGE_ZONE || 're-podtards-storage',
    apiKey: process.env.BUNNY_STORAGE_API_KEY,
  };
  
  return config;
}

/**
 * Simple RSS parser for image extraction
 */
async function parseRSSFeed(feedUrl) {
  try {
    console.log(`📡 Fetching: ${feedUrl}`);
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    
    // Simple XML parsing using regex
    let title = 'Unknown Album';
    let artist = 'Unknown Artist';
    let coverArt = null;
    const trackImages = [];
    
    // Extract title
    const titleMatch = xmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
    
    // Extract artist
    const authorMatch = xmlText.match(/<itunes:author[^>]*>([^<]+)<\/itunes:author>/i) ||
                       xmlText.match(/<author[^>]*>([^<]+)<\/author>/i);
    if (authorMatch) {
      artist = authorMatch[1].trim();
    }
    
    // Extract album artwork
    const artworkMatch = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i) ||
                        xmlText.match(/<image[^>]*>.*?<url[^>]*>([^<]+)<\/url>/is);
    if (artworkMatch) {
      coverArt = artworkMatch[1].trim();
    }
    
    // Extract track images
    const trackImageMatches = xmlText.matchAll(/<itunes:image[^>]*href="([^"]+)"/gi);
    for (const match of trackImageMatches) {
      if (match[1] && match[1] !== coverArt) {
        trackImages.push(match[1].trim());
      }
    }
    
    return {
      title,
      artist,
      coverArt,
      trackImages: [...new Set(trackImages)] // Remove duplicates
    };
    
  } catch (error) {
    console.error(`❌ Error parsing ${feedUrl}:`, error.message);
    return null;
  }
}

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
 * Upload image to Bunny.net Storage
 */
async function uploadToBunny(imageBuffer, filename, storageConfig) {
  try {
    const storageUrl = `https://${storageConfig.hostname}/${storageConfig.zone}/albums/${filename}`;
    
    console.log(`📤 Uploading to Bunny.net Storage: ${filename}`);
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storageConfig.apiKey,
        'Content-Type': 'image/jpeg',
      },
      body: imageBuffer
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Return the storage URL that can be accessed via CDN
    const cdnUrl = `https://re-podtards.b-cdn.net/albums/${filename}`;
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
 * Check if an image URL would benefit from CDN optimization
 * @param url - The image URL to check
 * @returns Whether CDN would improve performance
 */
function shouldUploadToCDN(url) {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    // Don't upload if already on fast domains
    if (CDN_THRESHOLDS.FAST_DOMAINS.some(fast => domain.includes(fast))) {
      return false;
    }

    // Upload if from known slow domains
    if (CDN_THRESHOLDS.SLOW_DOMAINS.some(slow => domain.includes(slow))) {
      return true;
    }

    // For other domains, be conservative - don't upload
    return false;

  } catch (error) {
    return false;
  }
}

/**
 * Process all RSS feeds and upload images
 */
async function processRSSFeeds() {
  console.log('🚀 Starting RSS feed image upload to Bunny.net Storage...\n');
  
  const storageConfig = getStorageConfig();
  
  if (!storageConfig.apiKey || !storageConfig.zone) {
    console.error('❌ Bunny.net Storage not configured. Please set up environment variables:');
    console.error('   BUNNY_STORAGE_HOSTNAME, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY');
    console.error('\n💡 You can set these in your .env.local file or run:');
    console.error('   export BUNNY_STORAGE_HOSTNAME=ny.storage.bunnycdn.com');
    console.error('   export BUNNY_STORAGE_ZONE=re-podtards-storage');
    console.error('   export BUNNY_STORAGE_API_KEY=your-api-key');
    process.exit(1);
  }
  
  console.log(`📡 Storage Configuration:`);
  console.log(`   Hostname: ${storageConfig.hostname}`);
  console.log(`   Zone: ${storageConfig.zone}`);
  console.log(`   API Key: ${storageConfig.apiKey ? '✅ Set' : '❌ Missing'}\n`);
  
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
      const album = await parseRSSFeed(feedUrl);
      
      if (!album) {
        console.log(`⚠️  No album data found for: ${feedUrl}`);
        continue;
      }
      
      results.processedFeeds++;
      console.log(`📦 Album: "${album.title}" by ${album.artist}`);
      
      const albumData = {
        title: album.title,
        artist: album.artist,
        originalArtwork: album.coverArt,
        cdnArtwork: null,
        tracks: []
      };
      
      // Smart upload: Only upload album artwork if it would benefit from CDN
      if (album.coverArt) {
        results.totalImages++;
        
        if (shouldUploadToCDN(album.coverArt)) {
          console.log(`📤 Uploading album artwork (benefits from CDN): ${album.coverArt}`);
          const imageBuffer = await downloadImage(album.coverArt);
          
          if (imageBuffer) {
            const filename = generateFilename(album.coverArt, album.title);
            const cdnUrl = await uploadToBunny(imageBuffer, filename, storageConfig);
            
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
        } else {
          console.log(`⏭️  Skipping album artwork (already fast): ${album.coverArt}`);
          albumData.cdnArtwork = album.coverArt; // Keep original URL
        }
      }
      
      // Smart upload: Only upload track images if they would benefit from CDN
      for (const trackImage of album.trackImages) {
        results.totalImages++;
        
        if (shouldUploadToCDN(trackImage)) {
          console.log(`📤 Uploading track image (benefits from CDN): ${trackImage}`);
          const imageBuffer = await downloadImage(trackImage);
          
          if (imageBuffer) {
            const filename = generateFilename(trackImage, album.title, 'track');
            const cdnUrl = await uploadToBunny(imageBuffer, filename, storageConfig);
            
            if (cdnUrl) {
              albumData.tracks.push({
                originalImage: trackImage,
                cdnImage: cdnUrl
              });
              results.uploadedImages++;
              console.log(`✅ Track image uploaded: ${cdnUrl}`);
            } else {
              results.failedImages++;
              console.log(`❌ Failed to upload track image`);
            }
          } else {
            results.failedImages++;
          }
        } else {
          console.log(`⏭️  Skipping track image (already fast): ${trackImage}`);
          albumData.tracks.push({
            originalImage: trackImage,
            cdnImage: trackImage // Keep original URL
          });
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
  
  console.log('\n✅ Bunny.net Storage upload complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Update your RSS feeds to use Storage URLs');
  console.log('   2. Configure your app to use Storage image optimization');
  console.log('   3. Test the improved image loading performance');
}

// Run the script
processRSSFeeds().catch(console.error); 