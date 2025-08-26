#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get feed ID from command line argument
const feedId = process.argv[2];

if (!feedId) {
  console.log('❌ Please provide a feed ID as an argument');
  console.log('Usage: node scripts/parse-single-feed.js <feed-id>');
  process.exit(1);
}

// Read feeds.json to get the feed URL
const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
const feeds = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));

const feed = feeds.feeds.find(f => f.id === feedId);

if (!feed) {
  console.log(`❌ Feed with ID "${feedId}" not found in feeds.json`);
  process.exit(1);
}

console.log(`🔄 Parsing single feed: ${feed.title} (${feedId})`);
console.log(`📡 URL: ${feed.originalUrl}`);

// Use curl to call the API with just this feed
const command = `curl -X POST "http://localhost:3000/api/parse-feeds?action=parse-single&feedId=${feedId}"`;

console.log(`\n🚀 Running: ${command}\n`);

const { exec } = require('child_process');
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`⚠️  Stderr: ${stderr}`);
  }
  console.log(`✅ Output: ${stdout}`);
}); 