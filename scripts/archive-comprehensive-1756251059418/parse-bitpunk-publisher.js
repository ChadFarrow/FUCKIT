const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseStringPromise } = require('xml2js');

function fetchXML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function parseBitpunkPublisher() {
  try {
    console.log('🔍 Fetching bitpunk.fm publisher feed...');
    
    const xmlText = await fetchXML('https://zine.bitpunk.fm/feeds/publisher.xml');
    console.log('📄 XML length:', xmlText.length);
    console.log('📄 First 500 chars:', xmlText.substring(0, 500));
    
    const result = await parseStringPromise(xmlText);
    
    console.log('🔍 Raw parsed result keys:', Object.keys(result));
    console.log('🔍 RSS channel keys:', result.rss?.channel ? Object.keys(result.rss.channel[0]) : 'No channel found');
    
    const channel = result.rss?.channel?.[0];
    if (!channel) {
      throw new Error('No channel found in RSS feed');
    }
    
    // Extract remote items (feeds in the publisher)
    const remoteItems = channel['podcast:remoteItem'] || [];
    console.log(`🔗 Found ${remoteItems.length} remote items`);
    
    // Extract publisher information
    const publisherInfo = {
      title: channel.title?.[0] || 'bitpunk.fm',
      artist: channel['itunes:author']?.[0] || channel.title?.[0] || 'bitpunk.fm',
      description: channel.description?.[0] || channel['itunes:summary']?.[0] || 'Independent publisher and content creator',
      coverArt: channel['itunes:image']?.[0]?.$.href || channel.image?.[0]?.url?.[0] || 'https://files.bitpunk.fm/cover_feed.png',
      link: channel.link?.[0] || 'https://zine.bitpunk.fm',
      feedUrl: 'https://zine.bitpunk.fm/feeds/publisher.xml',
      feedGuid: '5883e6be-4e0c-11f0-9524-00155dc57d8e',
      explicit: channel['itunes:explicit']?.[0] === 'true' || false,
      language: channel.language?.[0] || 'en',
      remoteItems: remoteItems.map((item, index) => ({
        feedUrl: item.$.feedUrl,
        feedGuid: item.$.feedGuid,
        medium: item.$.medium,
        order: index // Order in the feed (last item is most recent)
      }))
    };
    
    console.log('🏢 Extracted publisher info:', publisherInfo);
    
    // Load existing parsed feeds
    const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    let parsedFeeds;
    
    try {
      const parsedFeedsRaw = fs.readFileSync(parsedFeedsPath, 'utf8');
      parsedFeeds = JSON.parse(parsedFeedsRaw);
    } catch (error) {
      console.log('⚠️ Could not load existing parsed feeds, creating new structure');
      parsedFeeds = { feeds: [] };
    }
    
    // Find or create the bitpunk publisher feed entry
    let publisherFeedIndex = parsedFeeds.feeds.findIndex(feed => feed.id === 'bitpunk-fm-publisher');
    
    const publisherFeedData = {
      id: 'bitpunk-fm-publisher',
      originalUrl: 'https://zine.bitpunk.fm/feeds/publisher.xml',
      type: 'publisher',
      title: 'bitpunk.fm',
      priority: 'extended',
      status: 'active',
      addedAt: '2025-07-29T22:05:00.000Z',
      lastUpdated: '2025-07-29T22:05:00.000Z',
      parseStatus: 'success',
      lastParsed: new Date().toISOString(),
      parsedData: {
        publisherInfo: publisherInfo
      }
    };
    
    if (publisherFeedIndex >= 0) {
      console.log('✏️ Updating existing bitpunk publisher feed');
      parsedFeeds.feeds[publisherFeedIndex] = publisherFeedData;
    } else {
      console.log('➕ Adding new bitpunk publisher feed');
      parsedFeeds.feeds.push(publisherFeedData);
    }
    
    // Write back to file
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeeds, null, 2));
    console.log('💾 Updated parsed-feeds.json');
    
    console.log('✅ Successfully parsed bitpunk.fm publisher feed');
    console.log('🖼️ Cover art URL:', publisherInfo.coverArt);
    
  } catch (error) {
    console.error('❌ Error parsing bitpunk publisher feed:', error);
    process.exit(1);
  }
}

parseBitpunkPublisher();