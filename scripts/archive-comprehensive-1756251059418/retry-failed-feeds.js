#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

console.log('🔄 Retrying failed feeds with rate limiting...\n');

// Load feeds.json
const feedsPath = path.join(__dirname, '..', 'data', 'feeds.json');
const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));

// Load parsed feeds to find failed ones
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Find feeds that failed or are missing
const failedFeeds = [];
feedsData.feeds.forEach(feed => {
  const parsedFeed = parsedFeedsData.feeds.find(f => f.id === feed.id);
  if (!parsedFeed || parsedFeed.parseStatus === 'failed' || !parsedFeed.parsedData?.album?.tracks?.length) {
    failedFeeds.push(feed);
  }
});

console.log(`📊 Found ${failedFeeds.length} feeds to retry\n`);

// Group by domain for rate limiting
const feedsByDomain = {};
failedFeeds.forEach(feed => {
  try {
    const url = new URL(feed.originalUrl);
    const domain = url.hostname;
    if (!feedsByDomain[domain]) {
      feedsByDomain[domain] = [];
    }
    feedsByDomain[domain].push(feed);
  } catch (e) {
    // Invalid URL
  }
});

console.log('📊 Feeds by domain:');
Object.entries(feedsByDomain).forEach(([domain, feeds]) => {
  console.log(`   • ${domain}: ${feeds.length} feeds`);
});
console.log('');

// XML parser
const parser = new xml2js.Parser({
  explicitArray: false,
  ignoreAttrs: true
});

// Helper functions
function safeGet(obj, path, defaultValue = '') {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || defaultValue;
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Parse a single feed with retries
async function parseFeedWithRetry(feed, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 Parsing: ${feed.title} (attempt ${attempt}/${retries})`);
      
      const response = await fetch(feed.originalUrl, {
        headers: {
          'User-Agent': 'FUCKIT Music App Feed Parser/1.0'
        }
      });
      
      if (response.status === 429) {
        console.log(`   ⏱️  Rate limited, waiting ${attempt * 5} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 5000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const xmlText = await response.text();
      const result = await parser.parseStringPromise(xmlText);
      
      const rss = result.rss;
      if (!rss || !rss.channel) {
        throw new Error('Invalid RSS format');
      }
      
      const channel = rss.channel;
      
      const albumData = {
        title: safeGet(channel, 'title', feed.title),
        artist: safeGet(channel, 'itunes:author') || safeGet(channel, 'author') || feed.title,
        description: safeGet(channel, 'description', ''),
        summary: safeGet(channel, 'itunes:summary', ''),
        subtitle: safeGet(channel, 'itunes:subtitle', ''),
        coverArt: safeGet(channel, 'image.url') || safeGet(channel, 'itunes:image.href') || '',
        explicit: safeGet(channel, 'itunes:explicit') === 'true',
        feedGuid: safeGet(channel, 'podcast:guid', ''),
        feedTitle: safeGet(channel, 'title', feed.title),
        releaseDate: new Date().toISOString()
      };
      
      const items = ensureArray(channel.item);
      albumData.tracks = items.map((item, index) => {
        const enclosure = item.enclosure || {};
        const duration = safeGet(item, 'itunes:duration', '0:00');
        
        return {
          title: safeGet(item, 'title', `Track ${index + 1}`),
          artist: safeGet(item, 'itunes:author') || albumData.artist,
          duration: duration,
          url: enclosure.url || '',
          trackNumber: index + 1,
          subtitle: safeGet(item, 'itunes:subtitle', ''),
          summary: safeGet(item, 'itunes:summary', ''),
          image: safeGet(item, 'itunes:image.href') || albumData.coverArt,
          explicit: safeGet(item, 'itunes:explicit') === 'true',
          keywords: ensureArray(safeGet(item, 'itunes:keywords')),
          itemGuid: safeGet(item, 'guid', '')
        };
      });
      
      albumData.publisher = {
        name: safeGet(channel, 'itunes:owner.itunes:name') || feed.title,
        url: safeGet(channel, 'link', ''),
        feedUrl: feed.originalUrl
      };
      
      console.log(`   ✅ Success: ${albumData.tracks.length} tracks found`);
      return albumData;
      
    } catch (error) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        return null;
      }
    }
  }
  return null;
}

// Main function
async function retryFailedFeeds() {
  let successCount = 0;
  let failCount = 0;
  
  // Process by domain with delays
  for (const [domain, feeds] of Object.entries(feedsByDomain)) {
    console.log(`\n🌐 Processing ${domain} (${feeds.length} feeds)...`);
    
    // Longer delay for Wavlake
    const delayMs = domain.includes('wavlake') ? 3000 : 500;
    
    for (const feed of feeds) {
      const albumData = await parseFeedWithRetry(feed);
      
      if (albumData) {
        // Update parsed feeds
        let existingFeedIndex = parsedFeedsData.feeds.findIndex(f => f.id === feed.id);
        
        const parsedFeed = {
          id: feed.id,
          originalUrl: feed.originalUrl,
          lastParsed: new Date().toISOString(),
          parseStatus: 'success',
          parsedData: {
            album: albumData
          }
        };
        
        if (existingFeedIndex >= 0) {
          parsedFeedsData.feeds[existingFeedIndex] = parsedFeed;
        } else {
          parsedFeedsData.feeds.push(parsedFeed);
        }
        
        successCount++;
      } else {
        failCount++;
      }
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Save updated data
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  
  console.log('\n✅ Retry complete!');
  console.log(`   • Successful: ${successCount}/${failedFeeds.length}`);
  console.log(`   • Still failed: ${failCount}`);
  console.log(`   • Total feeds: ${parsedFeedsData.feeds.length}`);
  console.log('\n💾 Updated parsed-feeds.json');
}

// Run
retryFailedFeeds().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});