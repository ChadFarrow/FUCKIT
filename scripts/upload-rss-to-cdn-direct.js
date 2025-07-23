#!/usr/bin/env node

/**
 * Upload RSS Feeds Directly to Bunny.net CDN
 * This script uploads RSS feeds directly to the CDN zone instead of using Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CDN_API_KEY = process.env.BUNNY_CDN_API_KEY;
const CDN_ZONE_ID = process.env.BUNNY_CDN_ZONE_ID || '4228588'; // From the CDN headers
const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 're-podtards-cdn.b-cdn.net';

// RSS feeds to upload
const RSS_FEEDS = [
  'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
  'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
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
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
  'https://www.thisisjdog.com/media/ring-that-bell.xml',
  'https://ableandthewolf.com/static/media/feed.xml',
  'https://static.staticsave.com/mspfiles/deathdreams.xml',
  'https://static.staticsave.com/mspfiles/waytogo.xml',
  'https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now%20i%20feel%20it.xml',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml'
];

// Generate CDN filenames
function generateCdnFilename(originalUrl) {
  const url = new URL(originalUrl);
  const pathname = url.pathname;
  const filename = pathname.split('/').pop();
  
  // Clean up filename for CDN
  let cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '-');
  if (!cleanName.endsWith('.xml')) {
    cleanName += '.xml';
  }
  
  return `feeds/${cleanName}`;
}

// Fetch RSS feed content
async function fetchRssFeed(url) {
  try {
    console.log(`📡 Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`✅ Fetched ${content.length} characters`);
    return content;
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    return null;
  }
}

// Upload to CDN via API
async function uploadToCdn(filename, content) {
  try {
    const uploadUrl = `https://api.bunny.net/storagezone/${CDN_ZONE_ID}/files/${filename}`;
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': CDN_API_KEY,
        'Content-Type': 'application/xml',
        'Content-Length': content.length.toString()
      },
      body: content
    });
    
    if (response.ok) {
      console.log(`✅ Uploaded: ${filename}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Upload failed for ${filename}: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Upload error for ${filename}:`, error.message);
    return false;
  }
}

// Main upload function
async function uploadRssFeeds() {
  console.log('🚀 Starting RSS Feed Upload to CDN...\n');
  
  if (!CDN_API_KEY) {
    console.error('❌ BUNNY_CDN_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  console.log(`📦 CDN Zone ID: ${CDN_ZONE_ID}`);
  console.log(`🌐 CDN Hostname: ${CDN_HOSTNAME}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const feedUrl of RSS_FEEDS) {
    const content = await fetchRssFeed(feedUrl);
    
    if (content) {
      const filename = generateCdnFilename(feedUrl);
      const success = await uploadToCdn(filename, content);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } else {
      failCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Upload Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success Rate: ${((successCount / RSS_FEEDS.length) * 100).toFixed(1)}%`);
  
  if (successCount > 0) {
    console.log('\n🎉 RSS feeds uploaded successfully!');
    console.log(`🌐 Test URL: https://${CDN_HOSTNAME}/feeds/music-from-the-doerfelverse.xml`);
  }
}

// Run the upload
uploadRssFeeds().catch(console.error); 