#!/usr/bin/env node

/**
 * Script to parse the HGH (Homegrown Hits) playlist XML
 * and extract all remoteItems with their feedGuid and itemGuid pairs
 */

const fs = require('fs');
const path = require('path');

// HGH playlist URL
const HGH_PLAYLIST_URL = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';

function parseRemoteItems(xmlContent) {
  const remoteItemRegex = /<podcast:remoteItem\s+feedGuid="([^"]+)"\s+itemGuid="([^"]+)"/g;
  const remoteItems = [];
  let match;
  
  while ((match = remoteItemRegex.exec(xmlContent)) !== null) {
    remoteItems.push({
      feedGuid: match[1],
      itemGuid: match[2]
    });
  }
  
  return remoteItems;
}

function analyzeRemoteItems(remoteItems) {
  // Count unique feedGuids
  const uniqueFeeds = new Set(remoteItems.map(item => item.feedGuid));
  
  // Group by feedGuid to see distribution
  const feedDistribution = {};
  remoteItems.forEach(item => {
    if (!feedDistribution[item.feedGuid]) {
      feedDistribution[item.feedGuid] = 0;
    }
    feedDistribution[item.feedGuid]++;
  });
  
  // Sort feeds by track count
  const sortedFeeds = Object.entries(feedDistribution)
    .sort(([,a], [,b]) => b - a)
    .map(([feedGuid, count]) => ({ feedGuid, trackCount: count }));
  
  return {
    totalRemoteItems: remoteItems.length,
    uniqueFeeds: uniqueFeeds.size,
    feedDistribution: sortedFeeds,
    sampleRemoteItems: remoteItems.slice(0, 10) // First 10 for inspection
  };
}

function saveResults(remoteItems, analysis) {
  const outputDir = path.join(__dirname, '..', 'data', 'hgh-analysis');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save all remoteItems
  const remoteItemsPath = path.join(outputDir, 'hgh-remote-items.json');
  fs.writeFileSync(remoteItemsPath, JSON.stringify(remoteItems, null, 2));
  
  // Save analysis
  const analysisPath = path.join(outputDir, 'hgh-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  
  // Save feedGuids for batch processing
  const uniqueFeedGuids = [...new Set(remoteItems.map(item => item.feedGuid))];
  const feedGuidsPath = path.join(outputDir, 'hgh-feed-guids.json');
  fs.writeFileSync(feedGuidsPath, JSON.stringify(uniqueFeedGuids, null, 2));
  
  // Save a sample for inspection
  const samplePath = path.join(outputDir, 'hgh-sample-remote-items.json');
  fs.writeFileSync(samplePath, JSON.stringify(remoteItems.slice(0, 50), null, 2));
  
  return {
    remoteItemsPath,
    analysisPath,
    feedGuidsPath,
    samplePath
  };
}

async function main() {
  try {
    console.log('🎵 Parsing HGH (Homegrown Hits) playlist XML...\n');
    
    // Fetch the HGH playlist XML
    console.log('📡 Fetching playlist from:', HGH_PLAYLIST_URL);
    const response = await fetch(HGH_PLAYLIST_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch HGH playlist: ${response.status} ${response.statusText}`);
    }
    
    const xmlContent = await response.text();
    console.log(`✅ Fetched ${xmlContent.length} characters of XML content\n`);
    
    // Parse remoteItems
    console.log('🔍 Extracting remoteItems...');
    const remoteItems = parseRemoteItems(xmlContent);
    console.log(`✅ Found ${remoteItems.length} remoteItems\n`);
    
    // Analyze the data
    console.log('📊 Analyzing remoteItems...');
    const analysis = analyzeRemoteItems(remoteItems);
    
    // Display analysis
    console.log('📈 Analysis Results:');
    console.log(`   Total remoteItems: ${analysis.totalRemoteItems}`);
    console.log(`   Unique feeds: ${analysis.uniqueFeeds}`);
    console.log('\n🏆 Top 10 feeds by track count:');
    analysis.feedDistribution.slice(0, 10).forEach((feed, index) => {
      console.log(`   ${index + 1}. ${feed.feedGuid.slice(0, 8)}... (${feed.trackCount} tracks)`);
    });
    
    console.log('\n🔍 Sample remoteItems (first 5):');
    analysis.sampleRemoteItems.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. Feed: ${item.feedGuid.slice(0, 8)}... | Item: ${item.itemGuid.slice(0, 8)}...`);
    });
    
    // Save results
    console.log('\n💾 Saving results...');
    const savedPaths = saveResults(remoteItems, analysis);
    
    console.log('\n✅ Results saved to:');
    console.log(`   📁 RemoteItems: ${savedPaths.remoteItemsPath}`);
    console.log(`   📊 Analysis: ${savedPaths.analysisPath}`);
    console.log(`   🆔 Feed GUIDs: ${savedPaths.feedGuidsPath}`);
    console.log(`   🔍 Sample: ${savedPaths.samplePath}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Review the analysis to understand the data structure');
    console.log('   2. Use the feed GUIDs to fetch Wavlake RSS feeds');
    console.log('   3. Resolve each itemGuid within its respective feed');
    console.log('   4. Add resolved tracks to your music database');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseRemoteItems, analyzeRemoteItems, saveResults };
