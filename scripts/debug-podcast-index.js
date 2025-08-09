#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔧 Debug: API Key present:', !!PODCAST_INDEX_API_KEY);
console.log('🔧 Debug: API Secret present:', !!PODCAST_INDEX_API_SECRET);

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

// Generate auth headers for Podcast Index API
function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  console.log('🔧 Debug: Generated auth hash for timestamp:', unixTime);
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function testFeedLookup(feedGuid) {
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  const headers = generateAuthHeaders();
  
  console.log(`🔍 Testing feed lookup for: ${feedGuid}`);
  console.log(`📡 URL: ${url}`);
  console.log('🔧 Headers:', JSON.stringify(headers, null, 2));
  
  try {
    const response = await fetch(url, { headers });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
    if (data.status === 'true' && data.feed) {
      console.log(`✅ Feed found: ${data.feed.title}`);
      console.log(`🔗 Feed URL: ${data.feed.url}`);
      console.log(`🆔 Feed ID: ${data.feed.id}`);
      return data.feed;
    } else {
      console.log(`❌ Feed not found: ${data.description || data.errorMessage || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`💥 Request failed: ${error.message}`);
    return null;
  }
}

async function testEpisodeLookup(itemGuid, feedId) {
  const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}&feedid=${feedId}`;
  const headers = generateAuthHeaders();
  
  console.log(`🔍 Testing episode lookup for: ${itemGuid} in feed ${feedId}`);
  console.log(`📡 URL: ${url}`);
  
  try {
    const response = await fetch(url, { headers });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
    if (data.status === 'true' && data.episode) {
      console.log(`✅ Episode found: ${data.episode.title}`);
      console.log(`🎵 Audio URL: ${data.episode.enclosureUrl}`);
      console.log(`🖼️ Image: ${data.episode.image}`);
      return data.episode;
    } else {
      console.log(`❌ Episode not found: ${data.description || data.errorMessage || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`💥 Request failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 Debugging Podcast Index API calls...');
  
  // Load a few sample tracks from HGH data
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  
  console.log(`📋 Testing with first 3 tracks from ${resolvedSongs.length} total tracks`);
  
  // Test first 3 tracks
  for (let i = 0; i < Math.min(3, resolvedSongs.length); i++) {
    const track = resolvedSongs[i];
    
    console.log(`\n🎵 === Testing Track ${i + 1} ===`);
    console.log(`Feed GUID: ${track.feedGuid}`);
    console.log(`Item GUID: ${track.itemGuid}`);
    
    // Step 1: Try to resolve the feed
    const feedData = await testFeedLookup(track.feedGuid);
    
    if (feedData) {
      console.log(`\n🎙️ Feed resolved successfully, testing episode...`);
      
      // Step 2: Try to resolve the episode
      await testEpisodeLookup(track.itemGuid, feedData.id);
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch(console.error);