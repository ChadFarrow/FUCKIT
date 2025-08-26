#!/usr/bin/env node

/**
 * Search for "breakheart" content using PodcastIndex API
 */

const https = require('https');

async function searchPodcastIndex() {
  // Try different search terms and endpoints
  const searches = [
    'breakheart',
    'break heart',
    'breakhearts',
    'music breakheart'
  ];
  
  console.log('🔍 Searching PodcastIndex for breakheart content...\n');
  
  for (const term of searches) {
    console.log(`Searching for: "${term}"`);
    
    // Since we don't have direct API access, let's provide manual instructions
    const encodedTerm = encodeURIComponent(term);
    const searchUrl = `https://podcastindex.org/search?q=${encodedTerm}&type=music`;
    
    console.log(`🔗 Manual search URL: ${searchUrl}`);
    console.log(`📡 API equivalent: https://api.podcastindex.org/api/1.0/search/byterm?q=${encodedTerm}&type=music`);
    console.log('');
  }
  
  console.log('📋 To get RSS feeds:');
  console.log('1. Visit the search URLs above');
  console.log('2. Look for podcast entries with "breakheart" in the title');
  console.log('3. Click on each result to get the RSS feed URL');
  console.log('4. Use the feed URLs with your app');
  console.log('');
  
  // Some common music RSS feed patterns for "breakheart" content
  const possibleFeeds = [
    'https://feeds.wavlake.com/artist/[artist-id]',
    'https://feeds.rss.com/breakheart',
    'https://anchor.fm/s/[show-id]/podcast/rss',
    'https://feeds.buzzsprout.com/[show-id].rss'
  ];
  
  console.log('🎵 Common music RSS feed patterns to check:');
  possibleFeeds.forEach((feed, i) => {
    console.log(`${i + 1}. ${feed}`);
  });
}

searchPodcastIndex();