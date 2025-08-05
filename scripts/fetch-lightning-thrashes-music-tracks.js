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

// Function to extract duration from track
function extractDuration(track) {
  // Try different duration tags
  const duration = 
    track['itunes:duration']?.[0] ||
    track.duration?.[0] ||
    track.length?.[0] ||
    track['podcast:duration']?.[0];
  
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

// Function to format seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Function to fetch track by GUID
async function fetchTrackByGuid(guid) {
  try {
    // Use Podcast Index API to get track by GUID
    const podcastIndexUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${guid}`;
    
    console.log(`🔍 Looking up track ${guid}...`);
    const authHeaders = generateAuthHeaders(podcastIndexUrl);
    const response = await makeRequest(podcastIndexUrl, authHeaders);
    const data = JSON.parse(response);
    
    if (!data.episodes || data.episodes.length === 0) {
      console.log(`❌ Track not found: ${guid}`);
      return null;
    }
    
    const track = data.episodes[0];
    console.log(`✅ Found track: ${track.title}`);
    
    return {
      guid: guid,
      title: track.title || 'Unknown Title',
      artist: track.author || 'Unknown Artist',
      duration: track.duration || null,
      pubDate: track.datePublished || 'Unknown Date',
      audioUrl: track.enclosureUrl || null,
      feedTitle: track.feedTitle || 'Unknown Feed'
    };
    
  } catch (error) {
    console.error(`❌ Error fetching track ${guid}:`, error.message);
    return null;
  }
}

// Function to fetch feed and find specific track
async function fetchFeedAndFindTrack(feedGuid, itemGuid) {
  try {
    // First try to get feed info from Podcast Index
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${feedGuid}`;
    
    console.log(`🔍 Looking up feed ${feedGuid}...`);
    const authHeaders = generateAuthHeaders(feedUrl);
    const feedResponse = await makeRequest(feedUrl, authHeaders);
    const feedData = JSON.parse(feedResponse);
    
    if (!feedData.feeds || feedData.feeds.length === 0) {
      console.log(`❌ Feed not found: ${feedGuid}`);
      return null;
    }
    
    const feed = feedData.feeds[0];
    console.log(`📡 Found feed: ${feed.title}`);
    
    // Try to fetch the feed's RSS
    if (feed.url) {
      try {
        console.log(`📡 Fetching RSS: ${feed.url}`);
        const rssResponse = await makeSimpleRequest(feed.url);
        const rssData = await parseXML(rssResponse);
        
        // Find the specific track
        const items = rssData.rss.channel[0].item || [];
        const track = items.find(item => {
          const guid = item.guid?.[0]?._ || item.guid?.[0];
          return guid === itemGuid;
        });
        
        if (track) {
          const duration = extractDuration(track);
          const durationSeconds = durationToSeconds(duration);
          
          return {
            feedGuid,
            itemGuid,
            title: track.title?.[0] || 'Unknown Title',
            artist: track['itunes:author']?.[0] || track.author?.[0] || 'Unknown Artist',
            duration: duration,
            durationSeconds: durationSeconds,
            formattedDuration: formatDuration(durationSeconds),
            pubDate: track.pubDate?.[0] || 'Unknown Date',
            audioUrl: track.enclosure?.[0]?.$.url || null,
            feedTitle: feed.title || 'Unknown Feed'
          };
        }
      } catch (error) {
        console.log(`❌ Error fetching RSS: ${error.message}`);
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching feed ${feedGuid}:`, error.message);
    return null;
  }
}

// Main function
async function main() {
  try {
    console.log('🎵 Fetching Lightning Thrashes music tracks...');
    
    // Load the playlist analysis
    const analysisFile = 'lightning-thrashes-analysis.json';
    if (!fs.existsSync(analysisFile)) {
      console.error(`❌ Analysis file not found: ${analysisFile}`);
      console.log('Please run analyze-lightning-thrashes-playlist.js first');
      return;
    }
    
    const analysisData = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    const remoteItems = analysisData.allRemoteItems || [];
    
    console.log(`📋 Found ${remoteItems.length} tracks in playlist`);
    
    if (remoteItems.length === 0) {
      console.log('❌ No tracks found');
      return;
    }
    
    const results = [];
    
    // Process first 10 tracks for testing
    const tracksToProcess = remoteItems.slice(0, 10);
    
    for (let i = 0; i < tracksToProcess.length; i++) {
      const item = tracksToProcess[i];
      const feedGuid = item.feedGuid;
      const itemGuid = item.itemGuid;
      
      console.log(`\n🎧 Processing track ${i + 1}/${tracksToProcess.length}...`);
      
      // Try to fetch track from feed first
      let trackData = await fetchFeedAndFindTrack(feedGuid, itemGuid);
      
      // If that fails, try direct GUID lookup
      if (!trackData) {
        trackData = await fetchTrackByGuid(itemGuid);
      }
      
      if (trackData) {
        results.push(trackData);
        console.log(`✅ ${trackData.title} - ${trackData.artist} - Duration: ${trackData.formattedDuration || 'Unknown'}`);
      }
      
      // Add delay to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save results
    const outputFile = 'lightning-thrashes-music-tracks.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📊 Results saved to ${outputFile}`);
    console.log(`📈 Successfully processed ${results.length} tracks`);
    
    // Show summary
    const tracksWithDuration = results.filter(r => r.duration);
    console.log(`⏱️  Tracks with duration: ${tracksWithDuration.length}/${results.length}`);
    
    if (tracksWithDuration.length > 0) {
      console.log('\n📋 Tracks with durations:');
      tracksWithDuration.forEach((track, index) => {
        console.log(`${index + 1}. ${track.title} - ${track.artist} - ${track.formattedDuration}`);
      });
      
      // Show duration statistics
      const durations = tracksWithDuration.map(r => r.durationSeconds).filter(d => d !== null);
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

module.exports = { fetchTrackByGuid, fetchFeedAndFindTrack, formatDuration }; 