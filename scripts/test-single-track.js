#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function testSingleHGHTrack() {
  console.log('🔍 Testing single HGH track with extra long delay...');
  
  // Wait 2 minutes first
  console.log('⏳ Waiting 2 minutes for rate limits to cool down...');
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  const feedGuid = '86f9ba78-7c4a-5bd2-a382-c6a88e9a96a0'; // First HGH track
  const itemGuid = '1e5cea5b-050c-4ac2-8ce1-6867f10e169c';
  
  try {
    // Step 1: Get feed
    console.log('🔍 Step 1: Looking up feed...');
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    const feedHeaders = generateAuthHeaders();
    
    const feedResponse = await fetch(feedUrl, { headers: feedHeaders });
    console.log(`📊 Feed lookup status: ${feedResponse.status} ${feedResponse.statusText}`);
    
    if (feedResponse.status === 429) {
      console.log('❌ Still rate limited on feed lookup');
      return;
    }
    
    if (!feedResponse.ok) {
      const text = await feedResponse.text();
      console.log('❌ Feed lookup failed:', text.substring(0, 500));
      return;
    }
    
    const feedData = await feedResponse.json();
    
    if (feedData.status !== 'true' || !feedData.feed) {
      console.log('❌ Feed not found:', feedData.description || 'Unknown error');
      return;
    }
    
    console.log(`✅ Feed found: ${feedData.feed.title}`);
    console.log(`🆔 Feed ID: ${feedData.feed.id}`);
    
    // Wait between calls
    console.log('⏳ Waiting 30 seconds between API calls...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Step 2: Get episode
    console.log('🔍 Step 2: Looking up episode...');
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}&feedid=${feedData.feed.id}`;
    const episodeHeaders = generateAuthHeaders();
    
    const episodeResponse = await fetch(episodeUrl, { headers: episodeHeaders });
    console.log(`📊 Episode lookup status: ${episodeResponse.status} ${episodeResponse.statusText}`);
    
    if (episodeResponse.status === 429) {
      console.log('❌ Still rate limited on episode lookup');
      return;
    }
    
    if (!episodeResponse.ok) {
      const text = await episodeResponse.text();
      console.log('❌ Episode lookup failed:', text.substring(0, 500));
      return;
    }
    
    const episodeData = await episodeResponse.json();
    
    if (episodeData.status !== 'true' || !episodeData.episode) {
      console.log('❌ Episode not found:', episodeData.description || 'Unknown error');
      return;
    }
    
    console.log(`✅ Episode found: ${episodeData.episode.title}`);
    console.log(`🎵 Audio URL: ${episodeData.episode.enclosureUrl || 'None'}`);
    console.log(`🖼️ Image: ${episodeData.episode.image || 'None'}`);
    console.log(`⏱️ Duration: ${episodeData.episode.duration || 'Unknown'}`);
    
    console.log('\n🎉 SUCCESS! HGH tracks ARE resolvable via Podcast Index API!');
    console.log('💡 The rate limiting is the only issue blocking resolution.');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testSingleHGHTrack();