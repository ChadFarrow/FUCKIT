const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// CDN Configuration
const CDN_HOSTNAME = 're-podtards-cdn.b-cdn.net';
const CDN_ZONE = 're-podtards-cdn';
const CDN_API_KEY = process.env.BUNNY_CDN_API_KEY;

// RSS Feed URLs
const feedUrls = [
  // Doerfelverse feeds
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
  
  // External feeds
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
  'https://www.thisisjdog.com/media/ring-that-bell.xml',
  
  // Wavlake feeds
  'https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1',
  'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
  'https://wavlake.com/feed/music/e678589b-5a9f-4918-9622-34119d2eed2c',
  'https://wavlake.com/feed/music/3a152941-c914-43da-aeca-5d7c58892a7f',
  'https://wavlake.com/feed/music/a97e0586-ecda-4b79-9c38-be9a9effe05a',
  'https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3',
  'https://wavlake.com/feed/music/ce8c4910-51bf-4d5e-a0b3-338e58e5ee79',
  'https://wavlake.com/feed/music/acb43f23-cfec-4cc1-a418-4087a5378129',
  'https://wavlake.com/feed/music/d1a871a7-7e4c-4a91-b799-87dcbb6bc41d',
  'https://wavlake.com/feed/music/3294d8b5-f9f6-4241-a298-f04df818390c',
  'https://wavlake.com/feed/music/d3145292-bf71-415f-a841-7f5c9a9466e1',
  'https://wavlake.com/feed/music/91367816-33e6-4b6e-8eb7-44b2832708fd',
  'https://wavlake.com/feed/music/8c8f8133-7ef1-4b72-a641-4e1a6a44d626',
  'https://wavlake.com/feed/music/9720d58b-22a5-4047-81de-f1940fec41c7',
  'https://wavlake.com/feed/music/21536269-5192-49e7-a819-fab00f4a159e',
  'https://wavlake.com/feed/music/624b19ac-5d8b-4fd6-8589-0eef7bcb9c9e',
  'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
  'https://wavlake.com/feed/music/1c7917cc-357c-4eaf-ab54-1a7cda504976',
  'https://wavlake.com/feed/music/e1f9dfcb-ee9b-4a6d-aee7-189043917fb5',
  'https://wavlake.com/feed/music/d4f791c3-4d0c-4fbd-a543-c136ee78a9de',
  'https://wavlake.com/feed/music/51606506-66f8-4394-b6c6-cc0c1b554375',
  'https://wavlake.com/feed/music/6b7793b8-fd9d-432b-af1a-184cd41aaf9d',
  'https://wavlake.com/feed/music/0bb8c9c7-1c55-4412-a517-572a98318921',
  'https://wavlake.com/feed/music/16e46ed0-b392-4419-a937-a7815f6ca43b',
  'https://wavlake.com/feed/music/2cd1b9ea-9ef3-4a54-aa25-55295689f442',
  'https://wavlake.com/feed/music/33eeda7e-8591-4ff5-83f8-f36a879b0a09',
  'https://wavlake.com/feed/music/32a79df8-ec3e-4a14-bfcb-7a074e1974b9',
  'https://wavlake.com/feed/music/06376ab5-efca-459c-9801-49ceba5fdab1',
  
  // IROH feed
  'https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a'
];

async function downloadFeed(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`❌ Failed to download ${url}:`, error.message);
    return null;
  }
}

async function uploadToCDN(fileName, content) {
  try {
    const response = await fetch(`https://${CDN_HOSTNAME}/${fileName}`, {
      method: 'PUT',
      headers: {
        'AccessKey': CDN_API_KEY,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      },
      body: content
    });

    if (response.ok) {
      return `https://${CDN_HOSTNAME}/${fileName}`;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`❌ Failed to upload ${fileName}:`, error.message);
    return null;
  }
}

function getFileName(url) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  let fileName = pathParts[pathParts.length - 1];
  
  // Handle Wavlake feeds
  if (url.includes('wavlake.com')) {
    const feedId = url.split('/').pop();
    fileName = `wavlake-${feedId}.xml`;
  }
  
  // Ensure .xml extension
  if (!fileName.endsWith('.xml')) {
    fileName += '.xml';
  }
  
  return `feeds/${fileName}`;
}

async function main() {
  console.log('🚀 Starting RSS feed upload to CDN...\n');
  console.log(`📡 CDN Configuration:`);
  console.log(`   Hostname: ${CDN_HOSTNAME}`);
  console.log(`   Zone: ${CDN_ZONE}`);
  console.log(`   API Key: ${CDN_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  if (!CDN_API_KEY) {
    console.error('❌ CDN API key not found in .env.local');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < feedUrls.length; i++) {
    const url = feedUrls[i];
    const fileName = getFileName(url);
    
    console.log(`📄 Processing [${i + 1}/${feedUrls.length}]: ${fileName}`);
    
    // Download feed
    console.log(`📥 Downloading: ${url}`);
    const content = await downloadFeed(url);
    
    if (!content) {
      console.log(`❌ Skipping ${fileName} due to download failure\n`);
      failCount++;
      continue;
    }
    
    console.log(`✅ Downloaded ${content.length} bytes`);
    
    // Upload to CDN
    console.log(`📤 Uploading to CDN: ${fileName}`);
    const cdnUrl = await uploadToCDN(fileName, content);
    
    if (cdnUrl) {
      console.log(`✅ Uploaded successfully: ${cdnUrl}`);
      successCount++;
    } else {
      console.log(`❌ Upload failed for ${fileName}`);
      failCount++;
    }
    
    console.log(`📊 Progress: ${i + 1}/${feedUrls.length} complete\n`);
  }

  console.log('============================================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('============================================================');
  console.log(`✅ Successful uploads: ${successCount}`);
  console.log(`❌ Failed uploads: ${failCount}`);
  console.log(`📄 Total feeds: ${feedUrls.length}`);
  console.log(`📊 Success rate: ${((successCount / feedUrls.length) * 100).toFixed(1)}%`);
  
  if (successCount > 0) {
    console.log('\n🎉 RSS feeds uploaded to CDN successfully!');
    console.log('💡 You can now enable CDN in your app for faster RSS loading.');
  }
}

main().catch(console.error); 