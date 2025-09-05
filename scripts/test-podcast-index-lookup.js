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
    'User-Agent': 'FUCKIT/1.0'
  };
}

async function lookupTrack(feedGuid, itemGuid) {
  const headers = generateAuthHeaders();
  
  console.log(`🔍 Looking up track with feedGuid: ${feedGuid}`);
  console.log(`🔍 Looking up track with itemGuid: ${itemGuid}`);
  
  // Try to find the episode by itemGuid first
  const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}`;
  
  try {
    console.log(`\n📡 Trying episodes/byguid endpoint...`);
    const response = await fetch(episodeUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Found episode by itemGuid!');
      console.log('📋 Episode data:', JSON.stringify(data, null, 2));
      return data;
    } else {
      const text = await response.text();
      console.log(`❌ Episode lookup failed: ${response.status} ${response.statusText}`);
      console.log('📋 Error details:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('💥 Episode lookup request failed:', error.message);
  }
  
  // Try to find the podcast by feedGuid
  const podcastUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  
  try {
    console.log(`\n📡 Trying podcasts/byguid endpoint...`);
    const response = await fetch(podcastUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Found podcast by feedGuid!');
      console.log('📋 Podcast data:', JSON.stringify(data, null, 2));
      
      // If we found the podcast, try to get episodes from it
      if (data.feed && data.feed.id) {
        console.log(`\n📡 Trying to get episodes from feed ID: ${data.feed.id}`);
        const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${data.feed.id}&max=100`;
        
        try {
          const episodesResponse = await fetch(episodesUrl, { headers });
          if (episodesResponse.ok) {
            const episodesData = await episodesResponse.json();
            console.log('✅ Found episodes from feed!');
            console.log(`📋 Found ${episodesData.items?.length || 0} episodes`);
            
            // Look for our specific itemGuid
            const targetEpisode = episodesData.items?.find(ep => ep.guid === itemGuid);
            if (targetEpisode) {
              console.log('🎯 Found our target episode!');
              console.log('📋 Target episode:', JSON.stringify(targetEpisode, null, 2));
              return targetEpisode;
            } else {
              console.log('❌ Target episode not found in feed episodes');
            }
          }
        } catch (episodeError) {
          console.error('💥 Episode feed lookup failed:', episodeError.message);
        }
      }
      
      return data;
    } else {
      const text = await response.text();
      console.log(`❌ Podcast lookup failed: ${response.status} ${response.statusText}`);
      console.log('📋 Error details:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('💥 Podcast lookup request failed:', error.message);
  }
  
  // Try searching by term as a last resort
  console.log(`\n📡 Trying search/byterm as last resort...`);
  const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(itemGuid)}&type=music`;
  
  try {
    const response = await fetch(searchUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search completed!');
      console.log(`📋 Found ${data.feeds?.length || 0} feeds and ${data.items?.length || 0} items`);
      
      if (data.items && data.items.length > 0) {
        console.log('📋 Search results:', JSON.stringify(data, null, 2));
      }
      
      return data;
    } else {
      const text = await response.text();
      console.log(`❌ Search failed: ${response.status} ${response.statusText}`);
      console.log('📋 Error details:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('💥 Search request failed:', error.message);
  }
  
  return null;
}

async function main() {
  // Test with the specific track you provided
  const feedGuid = "a1077af6-602b-5daf-957b-68a65a03cad1";
  const itemGuid = "8ec41aed-2072-4562-ad11-2ffa9169d3ab";
  
  console.log('🔧 Testing Podcast Index API lookup...\n');
  console.log('📋 API Key:', PODCAST_INDEX_API_KEY);
  console.log('📋 API Secret length:', PODCAST_INDEX_API_SECRET?.length || 'undefined');
  
  const result = await lookupTrack(feedGuid, itemGuid);
  
  if (result) {
    console.log('\n✅ Lookup completed successfully!');
  } else {
    console.log('\n❌ Lookup failed - track not found');
  }
}

main().catch(console.error);
