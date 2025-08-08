#!/usr/bin/env node

/**
 * Extract RSS feeds from PodcastIndex search results
 * Usage: node extract-podcastindex-feeds.js [search_url]
 */

const https = require('https');
const http = require('http');

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractRSSFeeds(html) {
  const feeds = [];
  
  // Look for RSS feed URLs in various patterns
  const patterns = [
    // Direct RSS/XML links
    /href=["']([^"']*\.(?:rss|xml)(?:\?[^"']*)?)/gi,
    // Feed URLs in data attributes
    /data-feed=["']([^"']*)/gi,
    // JSON data containing feed URLs
    /"feedUrl":\s*"([^"]+)"/gi,
    /"feed":\s*"([^"]+\.(?:rss|xml)(?:\?[^"]*)?)"/gi,
    // Common feed patterns
    /href=["']([^"']*feed[^"']*)/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      if (url && (url.includes('.xml') || url.includes('.rss') || url.includes('feed'))) {
        feeds.push(url);
      }
    }
  });
  
  // Also look for podcast titles and metadata
  const podcastData = [];
  const titlePattern = /<h[1-6][^>]*>([^<]*(?:breakheart|podcast|music)[^<]*)<\/h[1-6]>/gi;
  let titleMatch;
  while ((titleMatch = titlePattern.exec(html)) !== null) {
    podcastData.push({
      title: titleMatch[1].trim(),
      type: 'title'
    });
  }
  
  return {
    feeds: [...new Set(feeds)], // Remove duplicates
    metadata: podcastData
  };
}

async function main() {
  const url = process.argv[2] || 'https://podcastindex.org/search?q=breakheart&type=music';
  
  try {
    console.log(`Fetching: ${url}`);
    const html = await fetchPage(url);
    
    const results = extractRSSFeeds(html);
    
    console.log('\n=== RSS Feeds Found ===');
    if (results.feeds.length === 0) {
      console.log('No RSS feeds found in the page');
    } else {
      results.feeds.forEach((feed, i) => {
        console.log(`${i + 1}. ${feed}`);
      });
    }
    
    console.log('\n=== Metadata Found ===');
    if (results.metadata.length === 0) {
      console.log('No podcast metadata found');
    } else {
      results.metadata.forEach((item, i) => {
        console.log(`${i + 1}. ${item.title}`);
      });
    }
    
    // Output as JSON for programmatic use
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractRSSFeeds, fetchPage };