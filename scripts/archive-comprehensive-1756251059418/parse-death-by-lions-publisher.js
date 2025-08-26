#!/usr/bin/env node

/**
 * Parse Death by Lions Publisher Script
 * 
 * This script parses the Death by Lions publisher feed
 */

const fs = require('fs');
const path = require('path');

async function parseDeathByLionsPublisher() {
  console.log('🔄 Parsing Death by Lions publisher feed...\n');
  
  try {
    // Load the feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find the Death by Lions publisher feed
    const publisherFeed = feedsData.feeds.find(feed => 
      feed.id === "death-by-lions-publisher"
    );
    
    if (!publisherFeed) {
      console.log('❌ Death by Lions publisher feed not found in feeds.json');
      return;
    }
    
    console.log(`🔍 Parsing: ${publisherFeed.title} (${publisherFeed.id})`);
    console.log(`   URL: ${publisherFeed.originalUrl}`);
    
    try {
      // Fetch the feed
      const response = await fetch(publisherFeed.originalUrl);
      
      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        return;
      }
      
      const text = await response.text();
      console.log(`   ✅ Response received (${text.length} characters)`);
      
      // Parse the feed content
      const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
      const descriptionMatch = text.match(/<description[^>]*>(.*?)<\/description>/i);
      const imageMatch = text.match(/<itunes:image[^>]*href=["']([^"']+)["'][^>]*>/i);
      const linkMatch = text.match(/<link[^>]*>(.*?)<\/link>/i);
      const lastBuildDateMatch = text.match(/<lastBuildDate[^>]*>(.*?)<\/lastBuildDate>/i);
      
      const title = titleMatch ? titleMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : publisherFeed.title;
      const description = descriptionMatch ? descriptionMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : 'Post hardcore band from Grand Rapids Michigan';
      const coverArt = imageMatch ? imageMatch[1] : null;
      const link = linkMatch ? linkMatch[1].trim() : publisherFeed.originalUrl;
      const lastUpdated = lastBuildDateMatch ? lastBuildDateMatch[1].trim() : new Date().toISOString();
      
      // Create parsed data
      const parsedData = {
        publisherInfo: {
          title: title,
          artist: title,
          description: description,
          coverArt: coverArt,
          link: link,
          lastUpdated: lastUpdated
        },
        publisherItems: []
      };
      
      // Update the feed in parsed-feeds.json
      const existingFeedIndex = parsedFeedsData.feeds.findIndex(f => f.id === publisherFeed.id);
      
      if (existingFeedIndex >= 0) {
        parsedFeedsData.feeds[existingFeedIndex] = {
          ...publisherFeed,
          parseStatus: "success",
          lastParsed: new Date().toISOString(),
          parsedData: parsedData
        };
      } else {
        parsedFeedsData.feeds.push({
          ...publisherFeed,
          parseStatus: "success",
          lastParsed: new Date().toISOString(),
          parsedData: parsedData
        });
      }
      
      // Save the updated parsed-feeds.json
      fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
      
      console.log(`   ✅ Parsed: ${title}`);
      if (coverArt) {
        console.log(`   🖼️  Cover Art: ${coverArt}`);
      }
      
      console.log(`\n✅ Successfully parsed Death by Lions publisher feed`);
      console.log('\n📝 Next step: Update publisher feed with albums');
      
    } catch (error) {
      console.log(`   ❌ Error parsing: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error parsing feed:', error.message);
  }
}

// Run the script
parseDeathByLionsPublisher(); 