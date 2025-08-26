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

// Function to extract podcast ID and episode number from URL
function extractPodcastInfo(url) {
  const match = url.match(/podcast\/(\d+)#(\d+)/);
  if (match) {
    return {
      podcastId: match[1],
      episodeNumber: match[2]
    };
  }
  return null;
}

// Function to fetch episode by podcast ID and episode number
async function fetchEpisodeByPodcastId(podcastId, episodeNumber) {
  try {
    // Use Podcast Index API to get episodes by podcast ID
    const podcastIndexUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcastId}&max=100`;
    
    console.log(`🔍 Looking up podcast ${podcastId}, episode ${episodeNumber}...`);
    const authHeaders = generateAuthHeaders(podcastIndexUrl);
    const response = await makeRequest(podcastIndexUrl, authHeaders);
    const data = JSON.parse(response);
    
    if (!data.episodes || data.episodes.length === 0) {
      console.log(`❌ No episodes found for podcast ${podcastId}`);
      return null;
    }
    
    // Find the specific episode by number
    const episode = data.episodes.find(ep => 
      ep.episode === episodeNumber || 
      ep.title?.includes(`Episode ${episodeNumber}`) ||
      ep.title?.includes(`#${episodeNumber}`)
    );
    
    if (!episode) {
      console.log(`❌ Episode ${episodeNumber} not found in podcast ${podcastId}`);
      return null;
    }
    
    console.log(`✅ Found episode: ${episode.title}`);
    
    return {
      podcastId,
      episodeNumber,
      title: episode.title || 'Unknown Title',
      duration: episode.duration || null,
      pubDate: episode.datePublished || 'Unknown Date',
      feedUrl: episode.feedUrl || null,
      audioUrl: episode.enclosureUrl || null
    };
    
  } catch (error) {
    console.error(`❌ Error fetching episode ${episodeNumber} from podcast ${podcastId}:`, error.message);
    return null;
  }
}

// Function to convert duration to formatted string
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

// Main function
async function main() {
  try {
    console.log('🎵 Fetching episodes from Podcast Index URLs...');
    
    // Load the analysis results
    const analysisFile = 'lightning-thrashes-analysis.json';
    if (!fs.existsSync(analysisFile)) {
      console.error(`❌ Analysis file not found: ${analysisFile}`);
      console.log('Please run analyze-lightning-thrashes-playlist.js first');
      return;
    }
    
    const analysisData = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    const urlLikeGuids = analysisData.urlLikeGuids || [];
    
    console.log(`📋 Found ${urlLikeGuids.length} URL-like GUIDs`);
    
    if (urlLikeGuids.length === 0) {
      console.log('❌ No URL-like GUIDs found');
      return;
    }
    
    const results = [];
    
    // Process URL-like GUIDs
    for (let i = 0; i < urlLikeGuids.length; i++) {
      const url = urlLikeGuids[i];
      const podcastInfo = extractPodcastInfo(url);
      
      if (!podcastInfo) {
        console.log(`❌ Could not parse URL: ${url}`);
        continue;
      }
      
      console.log(`\n🎧 Processing episode ${i + 1}/${urlLikeGuids.length}...`);
      
      const episodeData = await fetchEpisodeByPodcastId(podcastInfo.podcastId, podcastInfo.episodeNumber);
      if (episodeData) {
        const formattedDuration = formatDuration(episodeData.duration);
        episodeData.formattedDuration = formattedDuration;
        results.push(episodeData);
        console.log(`✅ ${episodeData.title} - Duration: ${formattedDuration}`);
      }
      
      // Add delay to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save results
    const outputFile = 'lightning-thrashes-podcastindex-episodes.json';
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
      const durations = episodesWithDuration.map(r => r.duration);
      const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      console.log(`\n📊 Duration Statistics:`);
      console.log(`Average: ${formatDuration(avgDuration)}`);
      console.log(`Shortest: ${formatDuration(minDuration)}`);
      console.log(`Longest: ${formatDuration(maxDuration)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fetchEpisodeByPodcastId, formatDuration }; 