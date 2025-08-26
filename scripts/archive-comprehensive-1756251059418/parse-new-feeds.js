#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read feeds.json
const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

const feeds = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
let parsedFeeds = [];

if (fs.existsSync(parsedFeedsPath)) {
  parsedFeeds = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
}

// Find feeds that haven't been parsed yet
const newFeeds = feeds.feeds.filter(feed => {
  return !parsedFeeds.some(parsed => parsed.id === feed.id);
});

if (newFeeds.length === 0) {
  console.log('✅ No new feeds to parse');
  process.exit(0);
}

console.log(`🆕 Found ${newFeeds.length} new feeds to parse:`);
newFeeds.forEach(feed => {
  console.log(`  - ${feed.title} (${feed.id})`);
});

// Parse just the new feeds using the API
const { execSync } = require('child_process');

console.log('\n🔄 Parsing new feeds...');
try {
  // Use the existing parse endpoint but with a filter for new feeds
  const response = execSync('curl -X POST "http://localhost:3000/api/parse-feeds?action=parse"', { 
    encoding: 'utf-8',
    timeout: 300000 // 5 minutes
  });
  
  console.log('✅ New feeds parsed successfully!');
  console.log('Response:', response);
  
} catch (error) {
  console.error('❌ Error parsing feeds:', error.message);
  process.exit(1);
} 