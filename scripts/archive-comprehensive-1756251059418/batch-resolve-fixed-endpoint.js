#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Read remote items from file
function parseRemoteItemsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const remoteItems = [];
  
  for (const line of lines) {
    const feedGuidMatch = line.match(/feedGuid="([^"]+)"/);
    const itemGuidMatch = line.match(/itemGuid="([^"]+)"/);
    
    if (feedGuidMatch && itemGuidMatch) {
      remoteItems.push({
        feedGuid: feedGuidMatch[1],
        itemGuid: itemGuidMatch[1]
      });
    }
  }
  
  return remoteItems;
}

// Podcast Index API authentication
function createAuthHeaders() {
  const unixTime = Math.floor(Date.now() / 1000);
  const data4Hash = API_KEY + API_SECRET + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': API_KEY,
    'Authorization': hash,
    'User-Agent': 'FUCKIT-Music-App/1.0'
  };
}

// Get feed ID from GUID
async function getFeedId(feedGuid) {
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.feed && data.feed.id) {
      return { feedId: data.feed.id, feedTitle: data.feed.title };
    }
    
    return { error: 'Feed not found' };
  } catch (error) {
    return { error: error.message };
  }
}

// Get episode from feed using feedId and episode GUID
async function getEpisodeFromFeed(feedId, itemGuid) {
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=100`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.items) {
      // Find the episode with matching GUID
      const episode = data.items.find(ep => ep.guid === itemGuid);
      if (episode) {
        return { episode };
      }
    }
    
    return { error: 'Episode not found in feed' };
  } catch (error) {
    return { error: error.message };
  }
}

// Main resolution function
async function resolveRemoteItemFixed(feedGuid, itemGuid) {
  try {
    // Step 1: Get feed ID
    const feedResult = await getFeedId(feedGuid);
    if (feedResult.error) {
      return { error: `Feed lookup failed: ${feedResult.error}` };
    }
    
    // Step 2: Get episode from feed
    const episodeResult = await getEpisodeFromFeed(feedResult.feedId, itemGuid);
    if (episodeResult.error) {
      return { error: `Episode lookup failed: ${episodeResult.error}` };
    }
    
    return { 
      episode: episodeResult.episode,
      feedInfo: { 
        id: feedResult.feedId, 
        title: feedResult.feedTitle 
      }
    };
    
  } catch (error) {
    return { error: error.message };
  }
}

// Test with first 5 items from the failed batch
async function testFixedApproach() {
  const inputFile = process.argv[2] || '../batch-items-308.txt';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const remoteItems = parseRemoteItemsFromFile(inputFile);
  console.log(`🔧 Testing FIXED approach with first 5 items from ${remoteItems.length} total...\n`);
  
  const testItems = remoteItems.slice(0, 5);
  
  for (let i = 0; i < testItems.length; i++) {
    const { feedGuid, itemGuid } = testItems[i];
    console.log(`📡 [${i+1}/5] Testing: ${feedGuid.substring(0, 8)}...`);
    
    const result = await resolveRemoteItemFixed(feedGuid, itemGuid);
    
    if (result.error) {
      console.log(`   ❌ Failed: ${result.error}`);
    } else {
      console.log(`   ✅ SUCCESS!`);
      console.log(`   📚 Feed: "${result.feedInfo.title}" (ID: ${result.feedInfo.id})`);
      console.log(`   🎵 Episode: "${result.episode.title}"`);
      console.log(`   🎨 Artwork: ${result.episode.image ? 'Yes' : 'No'}`);
      console.log(`   🔗 Audio: ${result.episode.enclosureUrl ? 'Yes' : 'No'}`);
    }
    
    console.log('');
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('🎯 Fixed approach test complete!');
}

testFixedApproach().catch(console.error);