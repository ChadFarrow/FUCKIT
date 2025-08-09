#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const { parseString } = require('xml2js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Podcast Index API credentials not found in .env.local');
  process.exit(1);
}

const crypto = require('crypto');

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

// Function to make simple HTTPS requests (for RSS feeds)
function makeSimpleRequest(url) {
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

// Function to convert duration to seconds
function durationToSeconds(duration) {
  if (!duration) return null;
  
  // Handle formats like "1:23:45" or "23:45" or "45"
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  }
  
  return null;
}

// Function to format seconds to HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Function to fetch episodes from Podcast Index API
async function fetchEpisodesFromAPI(podcastId) {
  try {
    const podcastIndexUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcastId}&max=100`;
    
    console.log(`🔍 Fetching episodes from Podcast Index API for podcast ${podcastId}...`);
    const authHeaders = generateAuthHeaders(podcastIndexUrl);
    const response = await makeRequest(podcastIndexUrl, authHeaders);
    const data = JSON.parse(response);
    
    if (!data.episodes || data.episodes.length === 0) {
      console.log(`❌ No episodes found for podcast ${podcastId}`);
      return [];
    }
    
    console.log(`✅ Found ${data.episodes.length} episodes via API`);
    return data.episodes;
    
  } catch (error) {
    console.error(`❌ Error fetching episodes from API:`, error.message);
    return [];
  }
}

// Function to fetch episodes from RSS feed
async function fetchEpisodesFromRSS(feedUrl) {
  try {
    console.log(`🔍 Fetching episodes from RSS feed: ${feedUrl}`);
    const response = await makeSimpleRequest(feedUrl);
    const data = await parseXML(response);
    
    const items = data.rss.channel[0].item || [];
    console.log(`✅ Found ${items.length} episodes via RSS`);
    return items;
    
  } catch (error) {
    console.error(`❌ Error fetching episodes from RSS:`, error.message);
    return [];
  }
}

// Main function
async function main() {
  try {
    console.log('🎵 Fetching Lightning Thrashes episodes...');
    
    const LIGHTNING_THRASHES_PODCAST_ID = 6602332;
    const LIGHTNING_THRASHES_RSS_URL = 'https://sirlibre.com/lightning-thrashes-rss.xml';
    
    let episodes = [];
    
    // Try API first
    console.log('\n📡 Method 1: Podcast Index API');
    const apiEpisodes = await fetchEpisodesFromAPI(LIGHTNING_THRASHES_PODCAST_ID);
    
    if (apiEpisodes.length > 0) {
      episodes = apiEpisodes.map(episode => ({
        title: episode.title || 'Unknown Title',
        guid: episode.guid || 'Unknown GUID',
        duration: episode.duration || null,
        pubDate: episode.datePublished || 'Unknown Date',
        audioUrl: episode.enclosureUrl || null,
        source: 'API'
      }));
    } else {
      // Try RSS feed as fallback
      console.log('\n📡 Method 2: RSS Feed');
      const rssEpisodes = await fetchEpisodesFromRSS(LIGHTNING_THRASHES_RSS_URL);
      
      if (rssEpisodes.length > 0) {
        episodes = rssEpisodes.map(episode => {
          const duration = extractDuration(episode);
          return {
            title: episode.title?.[0] || 'Unknown Title',
            guid: episode.guid?.[0]?._ || episode.guid?.[0] || 'Unknown GUID',
            duration: duration,
            pubDate: episode.pubDate?.[0] || 'Unknown Date',
            audioUrl: episode.enclosure?.[0]?.$.url || null,
            source: 'RSS'
          };
        });
      }
    }
    
    if (episodes.length === 0) {
      console.log('❌ No episodes found from either source');
      return;
    }
    
    // Process episodes
    console.log(`\n📋 Processing ${episodes.length} episodes...`);
    const results = [];
    
    // Process first 20 episodes
    const episodesToProcess = episodes.slice(0, 20);
    
    for (let i = 0; i < episodesToProcess.length; i++) {
      const episode = episodesToProcess[i];
      const durationSeconds = durationToSeconds(episode.duration);
      const formattedDuration = formatDuration(durationSeconds);
      
      const processedEpisode = {
        ...episode,
        durationSeconds,
        formattedDuration
      };
      
      results.push(processedEpisode);
      console.log(`✅ ${episode.title} - Duration: ${formattedDuration}`);
    }
    
    // Save results
    const outputFile = 'lightning-thrashes-actual-episodes.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📊 Results saved to ${outputFile}`);
    console.log(`📈 Successfully processed ${results.length} episodes`);
    
    // Show summary
    const episodesWithDuration = results.filter(r => r.duration);
    console.log(`⏱️  Episodes with duration: ${episodesWithDuration.length}/${results.length}`);
    
    if (episodesWithDuration.length > 0) {
      console.log('\n📋 Episodes with durations:');
      episodesWithDuration.forEach((episode, index) => {
        console.log(`${index + 1}. ${episode.title} - ${episode.formattedDuration}`);
      });
      
      // Show duration statistics
      const durations = episodesWithDuration.map(r => r.durationSeconds).filter(d => d !== null);
      if (durations.length > 0) {
        const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        
        console.log(`\n📊 Duration Statistics:`);
        console.log(`Average: ${formatDuration(avgDuration)}`);
        console.log(`Shortest: ${formatDuration(minDuration)}`);
        console.log(`Longest: ${formatDuration(maxDuration)}`);
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

module.exports = { fetchEpisodesFromAPI, fetchEpisodesFromRSS, formatDuration }; 