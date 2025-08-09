#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const { parseString } = require('xml2js');

// Function to make HTTPS requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Function to parse XML
function parseXML(xmlString) {
  return new Promise((resolve, reject) => {
    parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Main function
async function main() {
  try {
    console.log('🎵 Analyzing Lightning Thrashes playlist...');
    
    // Fetch the playlist
    const playlistUrl = 'https://cdn.kolomona.com/podcasts/lightning-thrashes/playlists/001-to-060-lightning-thrashes-playlist.xml';
    const playlistResponse = await makeRequest(playlistUrl);
    const playlistData = await parseXML(playlistResponse);
    
    // Extract remote items
    const channel = playlistData.rss.channel[0];
    const remoteItems = channel['podcast:remoteItem'] || [];
    
    console.log(`📋 Found ${remoteItems.length} episodes in playlist`);
    
    // Analyze feed GUIDs
    const feedGuids = new Set();
    const itemGuids = new Set();
    
    remoteItems.forEach(item => {
      feedGuids.add(item.$.feedGuid);
      itemGuids.add(item.$.itemGuid);
    });
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`Unique Feed GUIDs: ${feedGuids.size}`);
    console.log(`Unique Item GUIDs: ${itemGuids.size}`);
    
    // Show some sample GUIDs
    console.log(`\n🔍 Sample Feed GUIDs:`);
    Array.from(feedGuids).slice(0, 10).forEach((guid, index) => {
      console.log(`${index + 1}. ${guid}`);
    });
    
    console.log(`\n🔍 Sample Item GUIDs:`);
    Array.from(itemGuids).slice(0, 10).forEach((guid, index) => {
      console.log(`${index + 1}. ${guid}`);
    });
    
    // Check if any GUIDs look like URLs
    const urlLikeGuids = Array.from(itemGuids).filter(guid => 
      guid.includes('http') || guid.includes('podcastindex.org')
    );
    
    if (urlLikeGuids.length > 0) {
      console.log(`\n🌐 URL-like GUIDs found:`);
      urlLikeGuids.slice(0, 5).forEach((guid, index) => {
        console.log(`${index + 1}. ${guid}`);
      });
    }
    
    // Save analysis results
    const analysisResults = {
      totalEpisodes: remoteItems.length,
      uniqueFeedGuids: feedGuids.size,
      uniqueItemGuids: itemGuids.size,
      sampleFeedGuids: Array.from(feedGuids).slice(0, 20),
      sampleItemGuids: Array.from(itemGuids).slice(0, 20),
      urlLikeGuids: urlLikeGuids,
      allRemoteItems: remoteItems.map(item => ({
        feedGuid: item.$.feedGuid,
        itemGuid: item.$.itemGuid
      }))
    };
    
    const outputFile = 'lightning-thrashes-analysis.json';
    fs.writeFileSync(outputFile, JSON.stringify(analysisResults, null, 2));
    
    console.log(`\n📊 Analysis saved to ${outputFile}`);
    
    // Try to fetch a sample episode using a URL-like GUID
    if (urlLikeGuids.length > 0) {
      console.log(`\n🔍 Attempting to fetch sample episode...`);
      const sampleGuid = urlLikeGuids[0];
      
      try {
        console.log(`Trying to fetch: ${sampleGuid}`);
        const response = await makeRequest(sampleGuid);
        console.log(`✅ Successfully fetched episode data`);
        console.log(`Response length: ${response.length} characters`);
        console.log(`First 200 characters: ${response.substring(0, 200)}...`);
      } catch (error) {
        console.log(`❌ Failed to fetch episode: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main }; 