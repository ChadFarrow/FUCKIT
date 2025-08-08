#!/usr/bin/env node

// Script to resolve audio URLs for specific Top 100 tracks by fetching RSS feeds

const fs = require('fs');

// Load environment variables from .env.local
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Target tracks that need audio URLs
const targetTracks = [
  { title: "Grey's Birthday", artist: "Big Awesome", feedId: 7086035 },
  { title: "Wild and Free", artist: "Anni Powell", feedId: 6773238 },
  { title: "Yellowhammer", artist: "The Trusted", feedId: 7439697 },
  { title: "Just to be a Dick", artist: "Ledbetter", feedId: 6806246 },
];

async function generateAuthHeaders() {
  const crypto = require('crypto');
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  const data4Hash = apiKey + apiSecret + apiHeaderTime;
  hash.update(data4Hash);
  const hashString = hash.digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Auth-Date': apiHeaderTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hashString,
    'User-Agent': 'FUCKIT-Audio-Resolver/1.0'
  };
}

async function getFeedInfo(feedId) {
  try {
    const headers = await generateAuthHeaders();
    const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${feedId}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch feed ${feedId}: ${response.status}`);
    }
    
    const data = await response.json();
    return data.feed;
  } catch (error) {
    console.error(`❌ Error fetching feed ${feedId}:`, error.message);
    return null;
  }
}

async function parseRSSFeed(rssUrl, targetTitle) {
  try {
    console.log(`🔍 Parsing RSS feed: ${rssUrl}`);
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status}`);
    }
    
    const rssText = await response.text();
    
    // Simple regex-based XML parsing to find the target track
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(rssText)) !== null) {
      const itemContent = match[1];
      
      // Extract title
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : '';
      
      // Check if this is our target track
      if (title.toLowerCase().includes(targetTitle.toLowerCase()) || 
          targetTitle.toLowerCase().includes(title.toLowerCase())) {
        
        // Extract audio URL
        const enclosureMatch = itemContent.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="audio\//i);
        if (enclosureMatch) {
          return {
            title: title,
            audioUrl: enclosureMatch[1]
          };
        }
      }
    }
    
    console.log(`⚠️  Track "${targetTitle}" not found in RSS feed`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error parsing RSS feed:`, error.message);
    return null;
  }
}

async function resolveAudioUrls() {
  console.log('🎵 Resolving audio URLs for missing Top 100 tracks...\n');
  
  if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
    console.error('❌ Missing Podcast Index API credentials in .env.local');
    return;
  }
  
  const foundUrls = {};
  
  for (const track of targetTracks) {
    console.log(`\n🔍 Processing: "${track.title}" by ${track.artist} (Feed ${track.feedId})`);
    
    // Get feed information
    const feedInfo = await getFeedInfo(track.feedId);
    if (!feedInfo) {
      console.log(`❌ Could not fetch feed info for ${track.feedId}`);
      continue;
    }
    
    console.log(`📡 Found feed: ${feedInfo.title}`);
    console.log(`🔗 RSS URL: ${feedInfo.url}`);
    
    // Parse RSS to find audio URL
    const audioInfo = await parseRSSFeed(feedInfo.url, track.title);
    if (audioInfo) {
      console.log(`✅ Found audio URL for "${audioInfo.title}"`);
      console.log(`🎵 Audio: ${audioInfo.audioUrl}`);
      foundUrls[track.title] = audioInfo.audioUrl;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary of found audio URLs:');
  for (const [title, url] of Object.entries(foundUrls)) {
    console.log(`"${title}": "${url}",`);
  }
  
  if (Object.keys(foundUrls).length > 0) {
    console.log('\n✅ Copy the above lines and add them to data/top100-audio-urls.ts');
  } else {
    console.log('\n⚠️  No audio URLs were found. Tracks may not be available or titles may not match exactly.');
  }
}

resolveAudioUrls().catch(console.error);