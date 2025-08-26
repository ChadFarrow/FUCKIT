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

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

async function checkFeedExists(feedGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  const headers = await generateAuthHeaders(apiKey, apiSecret);
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
  
  console.log(`🔍 Checking feed: ${feedGuid}`);
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (response.ok && data.status === true && data.feed) {
      console.log(`✅ Feed found: "${data.feed.title}" by ${data.feed.author}`);
      console.log(`   📊 Episodes: ${data.feed.episodeCount}, Latest: ${data.feed.newestItemPubdate}`);
      return data.feed;
    } else {
      console.log(`❌ Feed not found: ${data.description || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error checking feed: ${error.message}`);
    return null;
  }
}

async function checkEpisodeExists(feedGuid, itemGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  const headers = await generateAuthHeaders(apiKey, apiSecret);
  const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&feedguid=${encodeURIComponent(feedGuid)}`;
  
  console.log(`🔍 Checking episode: ${itemGuid} in feed ${feedGuid}`);
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (response.ok && data.status === true && data.episode) {
      console.log(`✅ Episode found: "${data.episode.title}"`);
      console.log(`   🎵 Duration: ${data.episode.duration}s, Published: ${data.episode.datePublished}`);
      return data.episode;
    } else {
      console.log(`❌ Episode not found: ${data.description || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error checking episode: ${error.message}`);
    return null;
  }
}

async function main() {
  // Test the first few GUIDs from the failed batch
  const testItems = [
    { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "e046f9dd-aca3-4c7a-b396-2148a90ac0f2" },
    { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
    { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" }
  ];
  
  console.log('🚀 Manually checking if GUIDs exist in Podcast Index...\n');
  
  for (const item of testItems) {
    console.log(`\n--- Checking ${item.feedGuid.slice(0, 8)}... ---`);
    
    // First check if the feed exists
    const feed = await checkFeedExists(item.feedGuid);
    
    if (feed) {
      // If feed exists, check if the specific episode exists
      await checkEpisodeExists(item.feedGuid, item.itemGuid);
    }
    
    console.log(''); // Add spacing
  }
}

if (require.main === module) {
  main().catch(console.error);
}