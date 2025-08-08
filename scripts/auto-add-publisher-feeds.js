#!/usr/bin/env node

/**
 * Auto-add Publisher Feeds Script
 * 
 * This script automatically detects publisher feeds from parsed data
 * and adds them to the feeds configuration if they're missing.
 * Also automatically adds album feeds from publisher feeds to prevent
 * missing albums like the Ollie situation.
 * 
 * Usage: node scripts/auto-add-publisher-feeds.js
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { XMLParser } = require('fast-xml-parser');

async function autoAddPublisherFeeds() {
  console.log('🔍 Scanning for publisher feeds in parsed data...\n');
  
  try {
    // Read parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const feedsConfigPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('❌ Parsed feeds file not found');
      return 0;
    }
    
    if (!fs.existsSync(feedsConfigPath)) {
      console.error('❌ Feeds configuration file not found');
      return 0;
    }
    
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
    const feedsConfig = JSON.parse(fs.readFileSync(feedsConfigPath, 'utf-8'));
    
    // Extract all publisher feed URLs from parsed data
    const publisherFeeds = new Set();
    const feedTitles = new Map();
    const feedArtists = new Map();
    
    // Scan through all parsed feeds for publisher references
    parsedFeedsData.feeds.forEach(feed => {
      if (feed.parsedData && feed.parsedData.album && feed.parsedData.album.publisher) {
        const publisher = feed.parsedData.album.publisher;
        if (publisher.feedUrl && publisher.medium === 'publisher') {
          publisherFeeds.add(publisher.feedUrl);
          
          // Try to get a meaningful title and artist
          const artist = feed.parsedData.album.artist || 'Unknown Artist';
          const title = feed.parsedData.album.title || feed.title || artist;
          
          feedTitles.set(publisher.feedUrl, title);
          feedArtists.set(publisher.feedUrl, artist);
        }
      }
    });
    
    console.log(`📊 Found ${publisherFeeds.size} publisher feeds in parsed data`);
    
    // Check which publisher feeds are already in configuration
    const existingPublisherUrls = new Set();
    feedsConfig.feeds.forEach(feed => {
      if (feed.type === 'publisher') {
        existingPublisherUrls.add(feed.originalUrl);
      }
    });
    
    console.log(`📋 ${existingPublisherUrls.size} publisher feeds already configured`);
    
    // Find missing publisher feeds
    const missingPublisherFeeds = Array.from(publisherFeeds).filter(url => 
      !existingPublisherUrls.has(url)
    );
    
    if (missingPublisherFeeds.length === 0) {
      console.log('✅ All publisher feeds are already configured!');
    } else {
      console.log(`\n🆕 Found ${missingPublisherFeeds.length} new publisher feeds to add:`);
      
      // Add missing publisher feeds
      const newFeeds = [];
      missingPublisherFeeds.forEach((url, index) => {
        const artist = feedArtists.get(url) || `Publisher ${index + 1}`;
        const title = feedTitles.get(url) || artist;
        const feedId = generateFeedId(artist);
        
        const newFeed = {
          id: feedId,
          originalUrl: url,
          type: "publisher",
          title: artist,
          priority: "extended",
          status: "active",
          addedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        newFeeds.push(newFeed);
        console.log(`  📝 ${artist} (${url})`);
      });
      
      // Add new feeds to configuration
      feedsConfig.feeds.push(...newFeeds);
      feedsConfig.lastUpdated = new Date().toISOString();
      
      // Write updated configuration
      fs.writeFileSync(feedsConfigPath, JSON.stringify(feedsConfig, null, 2));
      
      console.log(`\n✅ Successfully added ${newFeeds.length} publisher feeds to configuration`);
      console.log('📁 Updated: data/feeds.json');
    }

    // --- ENHANCED LOGIC: Add album feeds from publisher feeds ---
    console.log('\n🎵 Step 2: Scanning for missing album feeds from publishers...');
    
    const allPublisherFeeds = feedsConfig.feeds.filter(f => f.type === 'publisher');
    let newAlbumFeeds = [];
    let totalRemoteItems = 0;
    
    for (const pubFeed of allPublisherFeeds) {
      console.log(`\n🔍 Scanning publisher: ${pubFeed.title} (${pubFeed.originalUrl})`);
      
      try {
        const remoteItems = await fetchRemoteItemsFromPublisherFeed(pubFeed.originalUrl);
        totalRemoteItems += remoteItems.length;
        
        console.log(`  📋 Found ${remoteItems.length} remote items in publisher feed`);
        
        for (const albumUrl of remoteItems) {
          // Check if already present
          const existingFeed = feedsConfig.feeds.find(f => f.originalUrl === albumUrl);
          
          if (!existingFeed) {
            // Try to get album info from the URL
            const albumInfo = await getAlbumInfoFromUrl(albumUrl, pubFeed.title);
            
            const albumId = generateAlbumFeedId(albumUrl, albumInfo.title);
            const newAlbumFeed = {
              id: albumId,
              originalUrl: albumUrl,
              type: 'album',
              title: albumInfo.title,
              priority: 'extended',
              status: 'active',
              addedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };
            
            feedsConfig.feeds.push(newAlbumFeed);
            newAlbumFeeds.push({
              url: albumUrl,
              title: albumInfo.title,
              artist: albumInfo.artist
            });
            
            console.log(`  🎶 Added: ${albumInfo.title} by ${albumInfo.artist}`);
          } else {
            console.log(`  ✅ Already exists: ${existingFeed.title || existingFeed.id}`);
          }
        }
      } catch (error) {
        console.warn(`  ⚠️  Error processing publisher ${pubFeed.title}: ${error.message}`);
      }
    }
    
    if (newAlbumFeeds.length > 0) {
      feedsConfig.lastUpdated = new Date().toISOString();
      fs.writeFileSync(feedsConfigPath, JSON.stringify(feedsConfig, null, 2));
      console.log(`\n✅ Successfully added ${newAlbumFeeds.length} new album feeds from publisher feeds`);
      console.log('📁 Updated: data/feeds.json');
      
      console.log('\n📋 New albums added:');
      newAlbumFeeds.forEach(album => {
        console.log(`  🎵 ${album.title} by ${album.artist}`);
      });
    } else {
      console.log('\n✅ No new album feeds found in publisher feeds');
    }
    
    // Summary
    console.log('\n📈 Final Summary:');
    console.log(`   Total publisher feeds found: ${publisherFeeds.size}`);
    console.log(`   Already configured: ${existingPublisherUrls.size}`);
    console.log(`   Newly added: ${missingPublisherFeeds.length}`);
    console.log(`   Total remote items scanned: ${totalRemoteItems}`);
    console.log(`   New album feeds added: ${newAlbumFeeds.length}`);
    
    return missingPublisherFeeds.length + newAlbumFeeds.length;
    
  } catch (error) {
    console.error('❌ Error processing publisher feeds:', error);
    return 0;
  }
}

async function getAlbumInfoFromUrl(albumUrl, defaultArtist) {
  try {
    const res = await fetch(albumUrl);
    if (!res.ok) {
      return {
        title: generateTitleFromUrl(albumUrl),
        artist: defaultArtist
      };
    }
    
    const xml = await res.text();
    const parser = new XMLParser({ 
      ignoreAttributes: false,
      textNodeName: '_text',
      attributeNamePrefix: '@_'
    });
    const data = parser.parse(xml);
    
    const channel = data.rss && data.rss.channel ? data.rss.channel : null;
    if (!channel) {
      return {
        title: generateTitleFromUrl(albumUrl),
        artist: defaultArtist
      };
    }
    
    // Extract title and artist
    const title = channel.title?._text || 
                  channel['itunes:title']?._text || 
                  generateTitleFromUrl(albumUrl);
    
    const artist = channel.author?._text || 
                   channel['itunes:author']?._text || 
                   defaultArtist;
    
    return { title, artist };
    
  } catch (error) {
    console.warn(`  ⚠️  Could not fetch album info from ${albumUrl}: ${error.message}`);
    return {
      title: generateTitleFromUrl(albumUrl),
      artist: defaultArtist
    };
  }
}

function generateTitleFromUrl(url) {
  // Extract meaningful title from URL
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  
  if (lastPart && lastPart !== '') {
    // Remove file extension and decode
    const cleanTitle = decodeURIComponent(lastPart)
      .replace(/\.(xml|rss)$/i, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    return cleanTitle || 'Unknown Album';
  }
  
  return 'Unknown Album';
}

function generateAlbumFeedId(url, title) {
  // Generate a unique ID for the album feed
  const urlId = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  
  const titleId = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
  
  return `${titleId}-${urlId}`;
}

async function main() {
  const added = await autoAddPublisherFeeds();
  if (added === 0) {
    console.log('\n🎉 No new feeds to add - everything is up to date!');
    process.exit(0);
  } else {
    console.log(`\n🎉 Successfully added ${added} new feeds!`);
    console.log('\n💡 Next steps:');
    console.log('   1. Run the feed parsing to populate the new feeds');
    console.log('   2. Check that all albums are now visible on publisher pages');
    process.exit(0);
  }
}

function generateFeedId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-') + '-publisher';
}

async function fetchRemoteItemsFromPublisherFeed(publisherUrl) {
  try {
    const res = await fetch(publisherUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)'
      },
      timeout: 10000
    });
    
    if (!res.ok) {
      console.warn(`  ⚠️  Failed to fetch publisher feed: ${publisherUrl} (${res.status})`);
      return [];
    }
    
    const xml = await res.text();
    const parser = new XMLParser({ 
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const data = parser.parse(xml);
    
    // Find <podcast:remoteItem> entries
    const channel = data.rss && data.rss.channel ? data.rss.channel : null;
    if (!channel) return [];
    
    let remoteItems = [];
    if (Array.isArray(channel['podcast:remoteItem'])) {
      remoteItems = channel['podcast:remoteItem'];
    } else if (channel['podcast:remoteItem']) {
      remoteItems = [channel['podcast:remoteItem']];
    }
    
    // Extract feedUrl from each remoteItem
    return remoteItems
      .map(item => item['@_feedUrl'] || item['@_feedurl'] || item['@_url'])
      .filter(Boolean);
      
  } catch (error) {
    console.warn(`  ⚠️  Error parsing publisher feed: ${publisherUrl} - ${error.message}`);
    return [];
  }
}

// Export the function for use in other scripts
module.exports = { autoAddPublisherFeeds };

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
} 