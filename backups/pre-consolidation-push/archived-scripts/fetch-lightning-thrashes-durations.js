#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const { parseString } = require('xml2js');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Podcast Index API credentials not found in .env.local');
  process.exit(1);
}

// Function to generate Podcast Index API authentication
function generateAuthHeaders(url) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp);
  const authHeader = hash.digest('hex');
  
  return {
    'User-Agent': 'FUCKIT/1.0',
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': authHeader
  };
}

// Function to make HTTPS requests with authentication
function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.end();
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

// Function to extract duration from episode
function extractDuration(episode) {
  // Try different duration tags
  const duration = 
    episode['itunes:duration']?.[0] ||
    episode.duration?.[0] ||
    episode.length?.[0] ||
    episode['podcast:duration']?.[0];
  
  return duration || null;
}

// Function to fetch episode details directly by GUID
async function fetchEpisodeByGuid(itemGuid) {
  try {
    // Use Podcast Index API to get episode by GUID
    const podcastIndexUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}`;
    
    console.log(`🔍 Looking up episode ${itemGuid}...`);
    const authHeaders = generateAuthHeaders(podcastIndexUrl);
    const episodeResponse = await makeRequest(podcastIndexUrl, authHeaders);
    const episodeData = JSON.parse(episodeResponse);
    
    if (!episodeData.episodes || episodeData.episodes.length === 0) {
      console.log(`❌ Episode not found: ${itemGuid}`);
      return null;
    }
    
    const episode = episodeData.episodes[0];
    console.log(`✅ Found episode: ${episode.title}`);
    
    return {
      feedGuid: episode.feedId,
      itemGuid: itemGuid,
      title: episode.title || 'Unknown Title',
      duration: episode.duration || null,
      pubDate: episode.datePublished || 'Unknown Date',
      feedUrl: episode.feedUrl || null
    };
    
  } catch (error) {
    console.error(`❌ Error fetching episode ${itemGuid}:`, error.message);
    return null;
  }
}

// Main function
async function main() {
  try {
    console.log('🎵 Fetching Lightning Thrashes playlist...');
    
    // Fetch the playlist
    const playlistUrl = 'https://cdn.kolomona.com/podcasts/lightning-thrashes/playlists/001-to-060-lightning-thrashes-playlist.xml';
    const playlistResponse = await makeRequest(playlistUrl);
    const playlistData = await parseXML(playlistResponse);
    
    // Extract remote items
    const channel = playlistData.rss.channel[0];
    const remoteItems = channel['podcast:remoteItem'] || [];
    
    console.log(`📋 Found ${remoteItems.length} episodes in playlist`);
    
    // Process episodes (limit to first 10 for testing)
    const episodesToProcess = remoteItems.slice(0, 10);
    const results = [];
    
    for (let i = 0; i < episodesToProcess.length; i++) {
      const item = episodesToProcess[i];
      const feedGuid = item.$.feedGuid;
      const itemGuid = item.$.itemGuid;
      
      console.log(`\n🎧 Processing episode ${i + 1}/${episodesToProcess.length}...`);
      
      const episodeData = await fetchEpisodeByGuid(itemGuid);
      if (episodeData) {
        results.push(episodeData);
        console.log(`✅ ${episodeData.title} - Duration: ${episodeData.duration || 'Unknown'}`);
      }
      
      // Add delay to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save results
    const outputFile = 'lightning-thrashes-episodes.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📊 Results saved to ${outputFile}`);
    console.log(`📈 Successfully processed ${results.length} episodes`);
    
    // Show summary
    const episodesWithDuration = results.filter(r => r.duration);
    console.log(`⏱️  Episodes with duration: ${episodesWithDuration.length}/${results.length}`);
    
    if (episodesWithDuration.length > 0) {
      console.log('\n📋 Sample episodes with durations:');
      episodesWithDuration.slice(0, 5).forEach((episode, index) => {
        console.log(`${index + 1}. ${episode.title} - ${episode.duration}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fetchEpisodeByGuid, extractDuration }; 