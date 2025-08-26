#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read current data
const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

const feeds = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
let parsedData = { feeds: [] };

if (fs.existsSync(parsedFeedsPath)) {
  parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
}

// Find new feeds
const newFeeds = feeds.feeds.filter(feed => {
  return !parsedData.feeds?.some(parsed => parsed.id === feed.id);
});

if (newFeeds.length === 0) {
  console.log('✅ No new feeds to add');
  process.exit(0);
}

console.log(`🆕 Found ${newFeeds.length} new feeds to add:`);
newFeeds.forEach(feed => {
  console.log(`  - ${feed.title} (${feed.id})`);
});

// Add new feeds to parsed data with placeholder data
newFeeds.forEach(feed => {
  const placeholderFeed = {
    ...feed,
    parseStatus: 'pending',
    lastParsed: new Date().toISOString(),
    parseError: 'Feed added but not yet parsed'
  };
  
  parsedData.feeds.push(placeholderFeed);
});

// Save updated parsed data
fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedData, null, 2));

console.log('\n✅ New feeds added to parsed data!');
console.log('💡 Note: These feeds will be properly parsed on the next full parse');
console.log('   For now, they\'re added as placeholders to prevent re-parsing.');

// Optionally trigger a parse of just these feeds
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\n🤔 Do you want to parse these new feeds now? (y/N): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n🔄 Parsing new feeds individually...');
    const { execSync } = require('child_process');
    
    newFeeds.forEach(feed => {
      console.log(`\n📡 Parsing: ${feed.title} (${feed.id})`);
      try {
        const response = execSync(`curl -X POST "http://localhost:3000/api/parse-feeds?action=parse-single&feedId=${feed.id}"`, { 
          encoding: 'utf-8',
          timeout: 60000 // 1 minute per feed
        });
        console.log(`✅ ${feed.title} parsed successfully!`);
      } catch (error) {
        console.error(`❌ Error parsing ${feed.title}:`, error.message);
      }
    });
  } else {
    console.log('✅ Feeds added as placeholders. They\'ll be parsed later.');
    console.log('💡 To parse individual feeds later, use:');
    newFeeds.forEach(feed => {
      console.log(`   node scripts/parse-single-feed.js ${feed.id}`);
    });
  }
}); 