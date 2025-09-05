#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Configuration
const HGH_PLAYLIST_URL = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';
const OUTPUT_DIR = 'data/hgh-resolved-tracks';

async function fetchHGHPlaylist() {
  console.log('📖 Fetching HGH playlist from GitHub...');
  
  try {
    const response = await fetch(HGH_PLAYLIST_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`✅ Successfully fetched playlist (${content.length} characters)`);
    
    return content;
  } catch (error) {
    console.error('❌ Error fetching HGH playlist:', error.message);
    throw error;
  }
}

function extractFeedURLs(content) {
  console.log('🔍 Extracting feed URLs from playlist content...');
  
  const discoveries = {
    linkElements: [],
    potentialFeedUrls: [],
    allUrls: [],
    feedGuidPatterns: [],
    itemGuidPatterns: []
  };
  
  // Look for <link> elements
  const linkMatches = content.match(/<link[^>]*>([^<]+)<\/link>/g);
  if (linkMatches) {
    discoveries.linkElements = linkMatches.map(match => {
      const url = match.replace(/<link[^>]*>([^<]+)<\/link>/, '$1').trim();
      return url;
    });
  }
  
  // Look for all URLs
  const urlMatches = content.match(/https?:\/\/[^\s"<>]+/g);
  if (urlMatches) {
    discoveries.allUrls = [...new Set(urlMatches)]; // Remove duplicates
    
    // Filter for potential feed URLs
    discoveries.potentialFeedUrls = discoveries.allUrls.filter(url => 
      url.includes('.xml') || 
      url.includes('feed') || 
      url.includes('rss') ||
      url.includes('podcast') ||
      url.includes('music')
    );
  }
  
  // Look for feedGuid patterns
  const feedGuidMatches = content.match(/feedGuid="([^"]+)"/g);
  if (feedGuidMatches) {
    discoveries.feedGuidPatterns = feedGuidMatches.map(match => 
      match.replace(/feedGuid="([^"]+)"/, '$1')
    );
  }
  
  // Look for itemGuid patterns
  const itemGuidMatches = content.match(/itemGuid="([^"]+)"/g);
  if (itemGuidMatches) {
    discoveries.itemGuidPatterns = itemGuidMatches.map(match => 
      match.replace(/itemGuid="([^"]+)"/, '$1')
    );
  }
  
  console.log(`📊 Extracted:`);
  console.log(`   🔗 Link elements: ${discoveries.linkElements.length}`);
  console.log(`   🌐 Potential feed URLs: ${discoveries.potentialFeedUrls.length}`);
  console.log(`   📋 All URLs: ${discoveries.allUrls.length}`);
  console.log(`   🆔 Feed GUIDs: ${discoveries.feedGuidPatterns.length}`);
  console.log(`   🎵 Item GUIDs: ${discoveries.itemGuidPatterns.length}`);
  
  return discoveries;
}

function analyzeFeedURLs(urls) {
  console.log('\n🔍 Analyzing feed URLs for patterns...');
  
  const analysis = {
    byDomain: {},
    byExtension: {},
    byKeyword: {},
    potentialFeeds: []
  };
  
  urls.forEach(url => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // Group by domain
      if (!analysis.byDomain[domain]) {
        analysis.byDomain[domain] = [];
      }
      analysis.byDomain[domain].push(url);
      
      // Group by file extension
      const extension = pathname.split('.').pop()?.toLowerCase();
      if (extension) {
        if (!analysis.byExtension[extension]) {
          analysis.byExtension[extension] = [];
        }
        analysis.byExtension[extension].push(url);
      }
      
      // Group by keywords
      const keywords = ['feed', 'rss', 'podcast', 'music', 'xml'];
      keywords.forEach(keyword => {
        if (url.toLowerCase().includes(keyword)) {
          if (!analysis.byKeyword[keyword]) {
            analysis.byKeyword[keyword] = [];
          }
          analysis.byKeyword[keyword].push(url);
        }
      });
      
      // Identify potential feeds
      if (pathname.includes('.xml') || 
          pathname.includes('feed') || 
          pathname.includes('rss') ||
          url.includes('podcast') ||
          url.includes('music')) {
        analysis.potentialFeeds.push(url);
      }
      
    } catch (error) {
      // Skip invalid URLs
    }
  });
  
  return analysis;
}

function generateMappingStrategy(discoveries, analysis) {
  console.log('\n💡 Generating mapping strategy...');
  
  const strategy = {
    approach: 'feed_url_discovery',
    description: 'Map HGH feedGuid values to actual RSS feed URLs',
    steps: [],
    recommendations: []
  };
  
  if (discoveries.potentialFeedUrls.length > 0) {
    strategy.steps.push({
      step: 1,
      action: 'Test discovered feed URLs',
      urls: discoveries.potentialFeedUrls.slice(0, 10), // Test first 10
      description: 'Verify these URLs are valid RSS feeds and contain the referenced tracks'
    });
    
    strategy.recommendations.push('Start with the discovered feed URLs to see if they contain the HGH tracks');
  }
  
  if (discoveries.feedGuidPatterns.length > 0) {
    strategy.steps.push({
      step: 2,
      action: 'Investigate feedGuid patterns',
      count: discoveries.feedGuidPatterns.length,
      description: 'These custom GUIDs may map to specific feed URLs or be generated from feed URLs'
    });
    
    strategy.recommendations.push('Check if feedGuid values are UUIDs generated from feed URLs');
  }
  
  if (Object.keys(analysis.byDomain).length > 0) {
    strategy.steps.push({
      step: 3,
      action: 'Explore domains',
      domains: Object.keys(analysis.byDomain).slice(0, 5),
      description: 'Investigate the main domains hosting these feeds'
    });
    
    strategy.recommendations.push('Focus on domains that appear multiple times in the playlist');
  }
  
  strategy.steps.push({
    step: 4,
    action: 'Manual feed discovery',
    description: 'For tracks not found in discovered feeds, manually search for artist/album feeds'
  });
  
  strategy.recommendations.push('Consider reaching out to ChadF about the feedGuid mapping system');
  
  return strategy;
}

async function main() {
  console.log('🔍 Discovering Original RSS Feed URLs for HGH Tracks...\n');
  
  // Check if output directory exists, create if not
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
  
  try {
    // Fetch the HGH playlist
    const playlistContent = await fetchHGHPlaylist();
    
    // Extract feed URLs and patterns
    const discoveries = extractFeedURLs(playlistContent);
    
    // Analyze the discovered URLs
    const analysis = analyzeFeedURLs(discoveries.allUrls);
    
    // Generate mapping strategy
    const strategy = generateMappingStrategy(discoveries, analysis);
    
    // Save all discoveries
    const discoveriesFile = path.join(OUTPUT_DIR, 'hgh-feed-discoveries.json');
    await fs.writeFile(discoveriesFile, JSON.stringify({
      discoveries,
      analysis,
      strategy,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    // Save potential feeds separately
    const feedsFile = path.join(OUTPUT_DIR, 'potential-feed-urls.json');
    await fs.writeFile(feedsFile, JSON.stringify({
      potentialFeeds: analysis.potentialFeeds,
      byDomain: analysis.byDomain,
      byExtension: analysis.byExtension,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('\n📊 Discovery Summary:');
    console.log(`🔗 Found ${discoveries.potentialFeedUrls.length} potential feed URLs`);
    console.log(`🌐 Found ${Object.keys(analysis.byDomain).length} unique domains`);
    console.log(`📋 Found ${discoveries.feedGuidPatterns.length} feedGuid patterns`);
    console.log(`🎵 Found ${discoveries.itemGuidPatterns.length} itemGuid patterns`);
    
    console.log('\n📁 Results saved to:');
    console.log(`   ${discoveriesFile}`);
    console.log(`   ${feedsFile}`);
    
    console.log('\n💡 Next Steps:');
    strategy.steps.forEach(step => {
      console.log(`   ${step.step}. ${step.action}: ${step.description}`);
    });
    
    console.log('\n🎯 Recommendations:');
    strategy.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
    
    if (analysis.potentialFeeds.length > 0) {
      console.log('\n🚀 Ready to test feeds!');
      console.log('   Run a script to test these discovered feed URLs and see if they contain the HGH tracks.');
    }
    
  } catch (error) {
    console.error('💥 Discovery failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
