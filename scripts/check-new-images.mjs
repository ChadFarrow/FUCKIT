#!/usr/bin/env node

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Check for New Images in RSS Feeds
 * Only uploads images that would benefit from CDN optimization
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
    're-podtards-cdn.b-cdn.net', // Already on our CDN
    'localhost',
    '127.0.0.1',
    'vercel.app',
    'vercel.com',
  ]
};

// RSS feed URLs to check
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
 * Simple RSS parser for image extraction
 */
async function parseRSSFeed(feedUrl) {
  try {
    console.log(`📡 Checking: ${feedUrl}`);
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
 * Check for new images that need CDN optimization
 */
async function checkForNewImages() {
  console.log('🔍 Checking RSS feeds for new images that need CDN optimization...\n');
  
  const results = {
    totalFeeds: RSS_FEEDS.length,
    processedFeeds: 0,
    totalImages: 0,
    needsCDN: 0,
    alreadyFast: 0,
    newImages: []
  };
  
  // Process each RSS feed
  for (const feedUrl of RSS_FEEDS) {
    try {
      // Parse RSS feed
      const album = await parseRSSFeed(feedUrl);
      
      if (!album) {
        continue;
      }
      
      results.processedFeeds++;
      console.log(`📦 Album: "${album.title}" by ${album.artist}`);
      
      // Check album artwork
      if (album.coverArt) {
        results.totalImages++;
        if (shouldUploadToCDN(album.coverArt)) {
          results.needsCDN++;
          results.newImages.push({
            type: 'album',
            title: album.title,
            url: album.coverArt,
            reason: 'Slow domain - would benefit from CDN'
          });
          console.log(`  📤 Album artwork needs CDN: ${album.coverArt}`);
        } else {
          results.alreadyFast++;
          console.log(`  ⏭️  Album artwork already fast: ${album.coverArt}`);
        }
      }
      
      // Check track images
      for (const trackImage of album.trackImages) {
        results.totalImages++;
        if (shouldUploadToCDN(trackImage)) {
          results.needsCDN++;
          results.newImages.push({
            type: 'track',
            title: album.title,
            url: trackImage,
            reason: 'Slow domain - would benefit from CDN'
          });
          console.log(`  📤 Track image needs CDN: ${trackImage}`);
        } else {
          results.alreadyFast++;
          console.log(`  ⏭️  Track image already fast: ${trackImage}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing feed ${feedUrl}:`, error.message);
    }
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 NEW IMAGES ANALYSIS');
  console.log('='.repeat(60));
  console.log(`Total RSS Feeds: ${results.totalFeeds}`);
  console.log(`Processed Feeds: ${results.processedFeeds}`);
  console.log(`Total Images: ${results.totalImages}`);
  console.log(`Need CDN: ${results.needsCDN}`);
  console.log(`Already Fast: ${results.alreadyFast}`);
  console.log(`CDN Benefit: ${results.totalImages > 0 ? Math.round((results.needsCDN / results.totalImages) * 100) : 0}%`);
  
  if (results.newImages.length > 0) {
    console.log('\n📤 Images that would benefit from CDN:');
    results.newImages.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.type.toUpperCase()}: ${img.title}`);
      console.log(`     URL: ${img.url}`);
      console.log(`     Reason: ${img.reason}`);
    });
    
    console.log('\n💡 To upload these images, run:');
    console.log('   node scripts/upload-to-bunny.mjs');
  } else {
    console.log('\n✅ All images are already optimized! No new uploads needed.');
  }
  
  // Save results to file
  const reportPath = path.join(process.cwd(), 'new-images-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Run the script
checkForNewImages().catch(console.error); 