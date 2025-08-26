#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read current feeds and parsed data
const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

const feeds = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
let parsedFeeds = [];

if (fs.existsSync(parsedFeedsPath)) {
  parsedFeeds = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
}

// Find feeds that haven't been parsed yet
const newFeeds = feeds.feeds.filter(feed => {
  return !parsedFeeds.feeds?.some(parsed => parsed.id === feed.id);
});

if (newFeeds.length === 0) {
  console.log('✅ No new feeds to parse');
  process.exit(0);
}

console.log(`🆕 Found ${newFeeds.length} new feeds to parse:`);
newFeeds.forEach(feed => {
  console.log(`  - ${feed.title} (${feed.id})`);
});

// For now, we'll use the full parse since the system is designed that way
// But we can at least show what's happening
console.log('\n🔄 Parsing all feeds (this includes the new ones)...');
console.log('💡 Note: The current system parses all feeds for data consistency');
console.log('   This ensures cross-references and indexes are properly built.');

const { execSync } = require('child_process');

try {
  const response = execSync('curl -X POST "http://localhost:3000/api/parse-feeds?action=parse"', { 
    encoding: 'utf-8',
    timeout: 300000 // 5 minutes
  });
  
  console.log('✅ Feeds parsed successfully!');
  
  // Parse the response to show results
  try {
    const result = JSON.parse(response);
    if (result.success) {
      console.log(`📊 Parse Results:`);
      console.log(`   - Total feeds: ${result.report.totalFeeds}`);
      console.log(`   - Successful: ${result.report.successfulParses}`);
      console.log(`   - Failed: ${result.report.failedParses}`);
      console.log(`   - Albums found: ${result.report.albumsFound}`);
      console.log(`   - Total tracks: ${result.report.totalTracks}`);
    }
  } catch (e) {
    console.log('Response received (not JSON):', response.substring(0, 200) + '...');
  }
  
} catch (error) {
  console.error('❌ Error parsing feeds:', error.message);
  process.exit(1);
} 