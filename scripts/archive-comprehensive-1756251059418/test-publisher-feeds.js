#!/usr/bin/env node

/**
 * Test Publisher Feeds Script
 * 
 * This script tests publisher feeds to extract artwork and metadata
 * for publisher pages.
 */

const fs = require('fs');
const path = require('path');

// Publisher feeds from feeds.json
const publisherFeeds = [
  {
    "id": "joe-martin-publisher",
    "originalUrl": "https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738",
    "type": "publisher",
    "title": "Joe Martin (Wavlake)"
  },
  {
    "id": "iroh-publisher",
    "originalUrl": "https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a",
    "type": "publisher",
    "title": "IROH (Wavlake)"
  },
  {
    "id": "wavlake-publisher-aa909244",
    "originalUrl": "https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4",
    "type": "publisher",
    "title": "Wavlake Publisher"
  },
  {
    "id": "doerfels-publisher",
    "originalUrl": "https://re.podtards.com/api/feeds/doerfels-pubfeed",
    "type": "publisher",
    "title": "Doerfels Publisher Feed"
  },
  {
    "id": "my-friend-jimi-publisher",
    "originalUrl": "https://wavlake.com/feed/artist/0ea699be-e985-4aa1-8c00-43542e4b9e0d",
    "type": "publisher",
    "title": "My Friend Jimi"
  },
  {
    "id": "ollie-publisher",
    "originalUrl": "https://wavlake.com/feed/artist/d2f43e9f-adfc-4811-b9c1-58d5ea383275",
    "type": "publisher",
    "title": "Ollie"
  }
];

async function testPublisherFeed(feed) {
  console.log(`\n🔍 Testing ${feed.title} (${feed.id})...`);
  console.log(`   URL: ${feed.originalUrl}`);
  
  try {
    const response = await fetch(feed.originalUrl);
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const text = await response.text();
    console.log(`   ✅ Response received (${text.length} characters)`);
    
    // Look for various image/artwork patterns
    const results = {
      feed: feed,
      imageUrl: null,
      imageTag: null,
      artworkTag: null,
      imgTag: null,
      itunesImage: null,
      description: null,
      title: null
    };
    
    // Extract title
    const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      results.title = titleMatch[1].trim();
      console.log(`   📝 Title: ${results.title}`);
    }
    
    // Extract description
    const descMatch = text.match(/<description[^>]*>(.*?)<\/description>/i);
    if (descMatch) {
      results.description = descMatch[1].trim();
      console.log(`   📄 Description: ${results.description.substring(0, 100)}...`);
    }
    
    // Look for image tags
    const imageMatch = text.match(/<image[^>]*>.*?<url[^>]*>(.*?)<\/url>/gs);
    if (imageMatch) {
      const urlMatch = imageMatch[0].match(/<url[^>]*>(.*?)<\/url>/);
      if (urlMatch) {
        results.imageUrl = urlMatch[1].trim();
        results.imageTag = imageMatch[0];
        console.log(`   🖼️  Image URL: ${results.imageUrl}`);
      }
    }
    
    // Look for artwork tags
    const artworkMatch = text.match(/<artwork[^>]*>(.*?)<\/artwork>/gs);
    if (artworkMatch) {
      results.artworkTag = artworkMatch[0];
      console.log(`   🎨 Artwork tag found: ${artworkMatch.length} instances`);
    }
    
    // Look for img tags
    const imgMatch = text.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/g);
    if (imgMatch) {
      results.imgTag = imgMatch[0];
      console.log(`   🖼️  Img tag found: ${imgMatch.length} instances`);
    }
    
    // Look for iTunes image
    const itunesMatch = text.match(/<itunes:image[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (itunesMatch) {
      results.itunesImage = itunesMatch[1];
      console.log(`   🎵 iTunes Image: ${results.itunesImage}`);
    }
    
    // Determine the best image URL
    if (results.imageUrl) {
      console.log(`   ✅ Best image: ${results.imageUrl}`);
    } else if (results.itunesImage) {
      console.log(`   ✅ Best image: ${results.itunesImage}`);
    } else if (results.imgTag) {
      const imgUrlMatch = results.imgTag.match(/src=["']([^"']+)["']/);
      if (imgUrlMatch) {
        results.imageUrl = imgUrlMatch[1];
        console.log(`   ✅ Best image: ${results.imageUrl}`);
      }
    } else {
      console.log(`   ⚠️  No image found`);
    }
    
    return results;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔄 Testing Publisher Feeds for Artwork...\n');
  
  const results = [];
  
  for (const feed of publisherFeeds) {
    const result = await testPublisherFeed(feed);
    if (result) {
      results.push(result);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results
  const resultsPath = path.join(process.cwd(), 'data', 'publisher-feed-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log('\n📊 Summary:');
  console.log(`✅ Successfully tested: ${results.length}/${publisherFeeds.length} feeds`);
  console.log(`📁 Results saved to: ${resultsPath}`);
  
  // Show which feeds have artwork
  const feedsWithArtwork = results.filter(r => r.imageUrl || r.itunesImage);
  console.log(`🖼️  Feeds with artwork: ${feedsWithArtwork.length}`);
  
  feedsWithArtwork.forEach(result => {
    console.log(`   - ${result.feed.title}: ${result.imageUrl || result.itunesImage}`);
  });
  
  console.log('\n🎯 Next steps:');
  console.log('1. Check the publisher-feed-results.json file for detailed results');
  console.log('2. Update publisher pages with the extracted artwork URLs');
  console.log('3. Consider caching the artwork images locally');
}

// Run the script
main().catch(console.error); 