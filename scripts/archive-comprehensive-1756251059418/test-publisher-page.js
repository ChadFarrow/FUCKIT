#!/usr/bin/env node

/**
 * Test Publisher Page Data Loading
 * 
 * This script tests if the publisher page data is loading correctly
 * and shows what artwork is available.
 */

const fs = require('fs');
const path = require('path');

async function testPublisherData() {
  console.log('🔍 Testing Publisher Data Loading...\n');
  
  try {
    // Load the parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find all publisher feeds
    const publisherFeeds = parsedFeedsData.feeds.filter(feed => feed.type === 'publisher');
    
    console.log(`📋 Found ${publisherFeeds.length} publisher feeds in parsed data:\n`);
    
    publisherFeeds.forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.title} (${feed.id})`);
      console.log(`   URL: ${feed.originalUrl}`);
      console.log(`   Parse Status: ${feed.parseStatus}`);
      console.log(`   Last Parsed: ${feed.lastParsed}`);
      
      if (feed.parsedData?.publisherInfo) {
        const info = feed.parsedData.publisherInfo;
        console.log(`   ✅ Publisher Info:`);
        console.log(`      Title: ${info.title}`);
        console.log(`      Artist: ${info.artist}`);
        console.log(`      Description: ${info.description?.substring(0, 100)}...`);
        console.log(`      Cover Art: ${info.coverArt || '❌ None'}`);
      } else {
        console.log(`   ❌ No publisher info found`);
      }
      
      if (feed.parsedData?.publisherItems) {
        console.log(`   📦 Publisher Items: ${feed.parsedData.publisherItems.length}`);
      }
      
      console.log('');
    });
    
    // Test specific publisher (Doerfels)
    console.log('🎯 Testing Doerfels Publisher specifically...\n');
    
    const doerfelsFeed = publisherFeeds.find(feed => feed.id === 'doerfels-publisher');
    
    if (doerfelsFeed) {
      console.log('✅ Doerfels publisher feed found in parsed data');
      console.log(`   Title: ${doerfelsFeed.title}`);
      console.log(`   URL: ${doerfelsFeed.originalUrl}`);
      
      if (doerfelsFeed.parsedData?.publisherInfo) {
        const info = doerfelsFeed.parsedData.publisherInfo;
        console.log(`   ✅ Publisher Info:`);
        console.log(`      Title: ${info.title}`);
        console.log(`      Artist: ${info.artist}`);
        console.log(`      Cover Art: ${info.coverArt || '❌ None'}`);
        
        if (info.coverArt) {
          console.log(`   🖼️  Cover Art URL: ${info.coverArt}`);
          
          // Test if the image URL is accessible
          console.log(`   🔍 Testing image accessibility...`);
          fetch(info.coverArt)
            .then(response => {
              if (response.ok) {
                console.log(`   ✅ Image is accessible (${response.status})`);
              } else {
                console.log(`   ❌ Image not accessible (${response.status})`);
              }
            })
            .catch(error => {
              console.log(`   ❌ Error accessing image: ${error.message}`);
            });
        }
      } else {
        console.log(`   ❌ No publisher info found for Doerfels`);
      }
    } else {
      console.log('❌ Doerfels publisher feed not found in parsed data');
    }
    
  } catch (error) {
    console.error('❌ Error testing publisher data:', error.message);
  }
}

// Run the test
testPublisherData(); 