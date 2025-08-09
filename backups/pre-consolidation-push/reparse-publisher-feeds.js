#!/usr/bin/env node

/**
 * Reparse Publisher Feeds Script
 * 
 * This script reparses only the publisher feeds to get the correct artwork
 * for publisher pages.
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Starting publisher feed reparse...');

// Read the feeds.json file
const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));

// Filter only publisher feeds
const publisherFeeds = feedsData.feeds.filter(feed => feed.type === 'publisher');

console.log(`📋 Found ${publisherFeeds.length} publisher feeds to reparse:`);
publisherFeeds.forEach(feed => {
  console.log(`  - ${feed.title} (${feed.id})`);
});

// Create a temporary feeds file with only publisher feeds
const tempFeedsPath = path.join(process.cwd(), 'data', 'temp-publisher-feeds.json');
const tempFeedsData = {
  feeds: publisherFeeds
};

fs.writeFileSync(tempFeedsPath, JSON.stringify(tempFeedsData, null, 2));
console.log(`📝 Created temporary feeds file: ${tempFeedsPath}`);

// Run the parse-feeds script with the temporary file
const { execSync } = require('child_process');

try {
  console.log('🔄 Running parse-feeds script...');
  
  // Use the parse-feeds API endpoint to reparse
  const parseCommand = `curl -X POST http://localhost:3000/api/parse-feeds -H "Content-Type: application/json" -d '{"feedsFile": "data/temp-publisher-feeds.json", "outputFile": "data/parsed-publisher-feeds.json"}'`;
  
  console.log('Executing:', parseCommand);
  const result = execSync(parseCommand, { encoding: 'utf8' });
  console.log('✅ Parse result:', result);
  
} catch (error) {
  console.error('❌ Error running parse-feeds:', error.message);
  
  // Fallback: try using the existing parse script
  try {
    console.log('🔄 Trying fallback parse method...');
    const fallbackCommand = 'node scripts/parse-all-feeds.js --feeds-file=data/temp-publisher-feeds.json --output-file=data/parsed-publisher-feeds.json';
    execSync(fallbackCommand, { encoding: 'utf8' });
    console.log('✅ Fallback parse completed');
  } catch (fallbackError) {
    console.error('❌ Fallback parse also failed:', fallbackError.message);
    
    // Manual fallback: create a simple script to test the feeds
    console.log('🔄 Creating manual test script...');
    const testScript = `
const fs = require('fs');
const path = require('path');

// Test each publisher feed individually
const publisherFeeds = ${JSON.stringify(publisherFeeds)};

async function testPublisherFeed(feed) {
  console.log(\`Testing \${feed.title}...\`);
  
  try {
    const response = await fetch(feed.originalUrl);
    const text = await response.text();
    
    // Look for image/artwork tags
    const imageMatches = text.match(/<image[^>]*>.*?<url[^>]*>(.*?)<\\/url>/gs);
    const artworkMatches = text.match(/<artwork[^>]*>(.*?)<\\/artwork>/gs);
    const imgMatches = text.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/g);
    
    console.log(\`  - Image tags: \${imageMatches ? imageMatches.length : 0}\`);
    console.log(\`  - Artwork tags: \${artworkMatches ? artworkMatches.length : 0}\`);
    console.log(\`  - Img tags: \${imgMatches ? imgMatches.length : 0}\`);
    
    if (imageMatches || artworkMatches || imgMatches) {
      console.log(\`  ✅ Found artwork for \${feed.title}\`);
    } else {
      console.log(\`  ⚠️  No artwork found for \${feed.title}\`);
    }
    
  } catch (error) {
    console.log(\`  ❌ Error testing \${feed.title}: \${error.message}\`);
  }
}

// Test all publisher feeds
publisherFeeds.forEach(testPublisherFeed);
    `;
    
    const testScriptPath = path.join(process.cwd(), 'scripts', 'test-publisher-feeds.js');
    fs.writeFileSync(testScriptPath, testScript);
    console.log(`📝 Created test script: ${testScriptPath}`);
    console.log('Run: node scripts/test-publisher-feeds.js to test the feeds');
  }
}

// Clean up temporary file
if (fs.existsSync(tempFeedsPath)) {
  fs.unlinkSync(tempFeedsPath);
  console.log('🗑️  Cleaned up temporary feeds file');
}

console.log('✅ Publisher feed reparse script completed!');
console.log('');
console.log('Next steps:');
console.log('1. Check the parsed-publisher-feeds.json file for results');
console.log('2. If needed, run: node scripts/test-publisher-feeds.js');
console.log('3. Update the main parsed-feeds.json with publisher artwork'); 