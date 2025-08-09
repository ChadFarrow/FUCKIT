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
    
    // Try to fetch the actual Lightning Thrashes feed
    const lightningThrashesFeeds = [
      'https://feeds.buzzsprout.com/lightningthrashes.rss',
      'https://lightninthrashes.com/feed.xml',
      'https://lightninthrashes.com/feed/',
      'https://cdn.kolomona.com/podcasts/lightning-thrashes/feed.xml'
    ];
    
    let lightningThrashesFeed = null;
    let lightningThrashesData = null;
    
    for (const feedUrl of lightningThrashesFeeds) {
      try {
        console.log(`🔍 Trying feed: ${feedUrl}`);
        const response = await makeRequest(feedUrl);
        lightningThrashesData = await parseXML(response);
        lightningThrashesFeed = feedUrl;
        console.log(`✅ Successfully fetched: ${feedUrl}`);
        break;
      } catch (error) {
        console.log(`❌ Failed to fetch: ${feedUrl}`);
      }
    }
    
    if (!lightningThrashesData) {
      console.log('❌ Could not fetch Lightning Thrashes feed');
      return;
    }
    
    // Extract episodes from Lightning Thrashes feed
    const items = lightningThrashesData.rss.channel[0].item || [];
    console.log(`📻 Found ${items.length} episodes in Lightning Thrashes feed`);
    
    // Process first 10 episodes to get duration information
    const episodesToProcess = items.slice(0, 10);
    const results = [];
    
    for (let i = 0; i < episodesToProcess.length; i++) {
      const episode = episodesToProcess[i];
      const title = episode.title?.[0] || 'Unknown Title';
      const guid = episode.guid?.[0]?._ || episode.guid?.[0] || 'Unknown GUID';
      const duration = extractDuration(episode);
      const pubDate = episode.pubDate?.[0] || 'Unknown Date';
      
      const durationSeconds = durationToSeconds(duration);
      const formattedDuration = formatDuration(durationSeconds);
      
      results.push({
        title,
        guid,
        duration,
        durationSeconds,
        formattedDuration,
        pubDate
      });
      
      console.log(`✅ ${title} - Duration: ${formattedDuration}`);
    }
    
    // Save results
    const outputFile = 'lightning-thrashes-episodes-simple.json';
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
    }
    
    // Show duration statistics
    const durations = results.filter(r => r.durationSeconds).map(r => r.durationSeconds);
    if (durations.length > 0) {
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

module.exports = { extractDuration, durationToSeconds, formatDuration }; 