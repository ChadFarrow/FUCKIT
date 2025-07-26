#!/usr/bin/env node

/**
 * Script to download ALL RSS feeds and upload them to Bunny.net storage
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Bunny.net storage configuration from .env.local
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_HOSTNAME = 'ny.storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = 're-podtards-storage';
const BUNNY_CDN_URL = 'https://re-podtards-cdn.b-cdn.net';

// ALL RSS feeds from the feedUrls array (excluding already uploaded CDN URLs)
const rssFeeds = [
  // Main Doerfels feeds
  {
    url: 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
    filename: 'music-from-the-doerfelverse.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
    filename: 'bloodshot-lies-album.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    filename: 'intothedoerfelverse.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
    filename: 'wrath-of-banjo.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
    filename: 'ben-doerfel.xml'
  },
  
  // Additional Doerfels albums and projects
  {
    url: 'https://www.doerfelverse.com/feeds/18sundays.xml',
    filename: '18sundays.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/alandace.xml',
    filename: 'alandace.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/autumn.xml',
    filename: 'autumn.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/christ-exalted.xml',
    filename: 'christ-exalted.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
    filename: 'come-back-to-me.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
    filename: 'dead-time-live-2016.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/dfbv1.xml',
    filename: 'dfbv1.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/dfbv2.xml',
    filename: 'dfbv2.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/disco-swag.xml',
    filename: 'disco-swag.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
    filename: 'doerfels-pubfeed.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
    filename: 'first-married-christmas.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/generation-gap.xml',
    filename: 'generation-gap.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/heartbreak.xml',
    filename: 'heartbreak.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/merry-christmix.xml',
    filename: 'merry-christmix.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
    filename: 'middle-season-let-go.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
    filename: 'phatty-the-grasshopper.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/possible.xml',
    filename: 'possible.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/pour-over.xml',
    filename: 'pour-over.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/psalm-54.xml',
    filename: 'psalm-54.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
    filename: 'sensitive-guy.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/they-dont-know.xml',
    filename: 'they-dont-know.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/think-ep.xml',
    filename: 'think-ep.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/underwater-single.xml',
    filename: 'underwater-single.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/unsound-existence.xml',
    filename: 'unsound-existence.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
    filename: 'you-are-my-world.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
    filename: 'you-feel-like-home.xml'
  },
  {
    url: 'https://www.doerfelverse.com/feeds/your-chance.xml',
    filename: 'your-chance.xml'
  },

  // Ed Doerfel (Shredward) projects
  {
    url: 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
    filename: 'nostalgic.xml'
  },
  {
    url: 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
    filename: 'citybeach.xml'
  },
  {
    url: 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
    filename: 'kurtisdrums-v1.xml'
  },

  // TJ Doerfel projects
  {
    url: 'https://www.thisisjdog.com/media/ring-that-bell.xml',
    filename: 'ring-that-bell.xml'
  },

  // Wavlake feeds - Nate Johnivan collection
  {
    url: 'https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1',
    filename: 'wavlake-d677db67-0310-4813-970e-e65927c689f1.xml'
  },
  {
    url: 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
    filename: 'wavlake-artist-aa909244-7555-4b52-ad88-7233860c6fb4.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/e678589b-5a9f-4918-9622-34119d2eed2c',
    filename: 'wavlake-e678589b-5a9f-4918-9622-34119d2eed2c.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/3a152941-c914-43da-aeca-5d7c58892a7f',
    filename: 'wavlake-3a152941-c914-43da-aeca-5d7c58892a7f.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/a97e0586-ecda-4b79-9c38-be9a9effe05a',
    filename: 'wavlake-a97e0586-ecda-4b79-9c38-be9a9effe05a.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3',
    filename: 'wavlake-0ed13237-aca9-446f-9a03-de1a2d9331a3.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/ce8c4910-51bf-4d5e-a0b3-338e58e5ee79',
    filename: 'wavlake-ce8c4910-51bf-4d5e-a0b3-338e58e5ee79.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/acb43f23-cfec-4cc1-a418-4087a5378129',
    filename: 'wavlake-acb43f23-cfec-4cc1-a418-4087a5378129.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/d1a871a7-7e4c-4a91-b799-87dcbb6bc41d',
    filename: 'wavlake-d1a871a7-7e4c-4a91-b799-87dcbb6bc41d.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/3294d8b5-f9f6-4241-a298-f04df818390c',
    filename: 'wavlake-3294d8b5-f9f6-4241-a298-f04df818390c.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/d3145292-bf71-415f-a841-7f5c9a9466e1',
    filename: 'wavlake-d3145292-bf71-415f-a841-7f5c9a9466e1.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/91367816-33e6-4b6e-8eb7-44b2832708fd',
    filename: 'wavlake-91367816-33e6-4b6e-8eb7-44b2832708fd.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/8c8f8133-7ef1-4b72-a641-4e1a6a44d626',
    filename: 'wavlake-8c8f8133-7ef1-4b72-a641-4e1a6a44d626.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/9720d58b-22a5-4047-81de-f1940fec41c7',
    filename: 'wavlake-9720d58b-22a5-4047-81de-f1940fec41c7.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/21536269-5192-49e7-a819-fab00f4a159e',
    filename: 'wavlake-21536269-5192-49e7-a819-fab00f4a159e.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e',
    filename: 'wavlake-624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e.xml'
  },

  // Joe Martin (Wavlake) - Complete collection
  {
    url: 'https://www.wavlake.com/feed/95ea253a-4058-402c-8503-204f6d3f1494',
    filename: 'wavlake-95ea253a-4058-402c-8503-204f6d3f1494.xml'
  },
  {
    url: 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
    filename: 'wavlake-artist-18bcbf10-6701-4ffb-b255-bc057390d738.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/1c7917cc-357c-4eaf-ab54-1a7cda504976',
    filename: 'wavlake-1c7917cc-357c-4eaf-ab54-1a7cda504976.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/e1f9dfcb-ee9b-4a6d-aee7-189043917fb5',
    filename: 'wavlake-e1f9dfcb-ee9b-4a6d-aee7-189043917fb5.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/d4f791c3-4d0c-4fbd-a543-c136ee78a9de',
    filename: 'wavlake-d4f791c3-4d0c-4fbd-a543-c136ee78a9de.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/51606506-66f8-4394-b6c6-cc0c1b554375',
    filename: 'wavlake-51606506-66f8-4394-b6c6-cc0c1b554375.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/6b7793b8-fd9d-432b-af1a-184cd41aaf9d',
    filename: 'wavlake-6b7793b8-fd9d-432b-af1a-184cd41aaf9d.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/0bb8c9c7-1c55-4412-a517-572a98318921',
    filename: 'wavlake-0bb8c9c7-1c55-4412-a517-572a98318921.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/16e46ed0-b392-4419-a937-a7815f6ca43b',
    filename: 'wavlake-16e46ed0-b392-4419-a937-a7815f6ca43b.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/2cd1b9ea-9ef3-4a54-aa25-55295689f442',
    filename: 'wavlake-2cd1b9ea-9ef3-4a54-aa25-55295689f442.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/33eeda7e-8591-4ff5-83f8-f36a879b0a09',
    filename: 'wavlake-33eeda7e-8591-4ff5-83f8-f36a879b0a09.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/32a79df8-ec3e-4a14-bfcb-7a074e1974b9',
    filename: 'wavlake-32a79df8-ec3e-4a14-bfcb-7a074e1974b9.xml'
  },
  {
    url: 'https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1',
    filename: 'wavlake-06376ab5-efca-459c-9801-49ceba5fdab1.xml'
  }
];

/**
 * Download a file from a URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);
    
    const protocol = url.startsWith('https:') ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        const redirectUrl = response.headers.location;
        console.log(`🔄 Redirected to: ${redirectUrl}`);
        downloadFile(redirectUrl).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`✅ Downloaded ${data.length} bytes from ${url}`);
        resolve(data);
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Failed to download ${url}: ${error.message}`));
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

/**
 * Upload a file to Bunny.net storage
 */
function uploadToBunny(filename, content) {
  return new Promise((resolve, reject) => {
    console.log(`📤 Uploading to Bunny.net: feeds/${filename}`);
    
    const postData = Buffer.from(content, 'utf8');
    
    const options = {
      hostname: BUNNY_STORAGE_HOSTNAME,
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE}/feeds/${filename}`,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/xml',
        'Content-Length': postData.length
      }
    };
    
    const request = https.request(options, (response) => {
      let responseData = '';
      
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode === 201) {
          const cdnUrl = `${BUNNY_CDN_URL}/feeds/${filename}`;
          console.log(`✅ Uploaded successfully: ${cdnUrl}`);
          resolve(cdnUrl);
        } else {
          console.error(`❌ Upload failed: ${response.statusCode} ${response.statusMessage}`);
          console.error('Response:', responseData);
          reject(new Error(`Upload failed: ${response.statusCode} ${response.statusMessage}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Upload failed: ${error.message}`));
    });
    
    request.write(postData);
    request.end();
  });
}

/**
 * Process all RSS feeds
 */
async function processFeeds() {
  console.log(`🚀 Starting upload process for ${rssFeeds.length} RSS feeds...\n`);
  
  const results = [];
  let completed = 0;
  
  for (const feed of rssFeeds) {
    try {
      console.log(`\n📄 Processing [${completed + 1}/${rssFeeds.length}]: ${feed.filename}`);
      
      // Download the RSS feed
      const content = await downloadFile(feed.url);
      
      // Upload to Bunny.net
      const cdnUrl = await uploadToBunny(feed.filename, content);
      
      results.push({
        originalUrl: feed.url,
        cdnUrl: cdnUrl,
        filename: feed.filename,
        success: true
      });
      
      completed++;
      console.log(`📊 Progress: ${completed}/${rssFeeds.length} complete`);
      
      // Add a delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Failed to process ${feed.filename}: ${error.message}`);
      results.push({
        originalUrl: feed.url,
        cdnUrl: null,
        filename: feed.filename,
        success: false,
        error: error.message
      });
      completed++;
      
      // Continue with next feed after error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 Upload Summary:');
  console.log('==================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful uploads: ${successful.length}`);
  console.log(`❌ Failed uploads: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n🔄 URL Mappings for code update:');
    console.log('=====================================');
    successful.forEach(result => {
      console.log(`'${result.originalUrl}' → '${result.cdnUrl}'`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    console.log('==================');
    failed.forEach(result => {
      console.log(`${result.filename}: ${result.error}`);
    });
  }
  
  return results;
}

// Run the script
if (require.main === module) {
  processFeeds()
    .then((results) => {
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      console.log(`\n🎉 Process completed: ${successful}/${total} feeds uploaded successfully`);
      process.exit(successful === total ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}