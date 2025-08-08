#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { XMLParser } = require('fast-xml-parser');

async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function parseBitpunkFeed() {
  console.log('🔄 Fetching bitpunk.fm feed...');
  
  try {
    // Fetch the feed
    const feedContent = await fetchFeed('https://zine.bitpunk.fm/feeds/bitpunk-fm.xml');
    
    // Parse the XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: true,
      parseTagValue: true,
      ignoreNameSpace: true
    });
    
    const parsedData = parser.parse(feedContent);
    const channel = parsedData.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    
    console.log(`📻 Found ${items.length} episodes in bitpunk.fm feed`);
    console.log(`🎵 Latest episode: "${items[0].title}" - ${items[0].pubDate}`);
    
    // Read current parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const currentData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
    
    // Find and update bitpunk-fm feed
    const feedIndex = currentData.feeds.findIndex(f => f.id === 'bitpunk-fm');
    
    if (feedIndex !== -1) {
      // Update the tracks
      const tracks = items.map((item, index) => ({
        title: item.title,
        url: item.enclosure?.['@_url'] || item.enclosure?.url || '',
        duration: item['itunes:duration'] || item.duration || 0,
        trackNumber: index + 1,
        pubDate: item.pubDate,
        guid: item.guid,
        description: item.description || '',
        image: item['itunes:image']?.['@_href'] || null,
        link: item.link || ''
      }));
      
      currentData.feeds[feedIndex].parsedData.album.tracks = tracks;
      currentData.feeds[feedIndex].lastParsed = new Date().toISOString();
      currentData.feeds[feedIndex].parseStatus = 'success';
      
      // Save updated data
      fs.writeFileSync(parsedFeedsPath, JSON.stringify(currentData, null, 2));
      
      console.log('✅ Successfully updated bitpunk.fm feed!');
      console.log(`📊 Total episodes: ${tracks.length}`);
      console.log(`🆕 Latest: ${tracks[0].title}`);
    } else {
      console.error('❌ bitpunk-fm feed not found in parsed-feeds.json');
    }
    
  } catch (error) {
    console.error('❌ Error updating feed:', error.message);
  }
}

// Run the update
parseBitpunkFeed();