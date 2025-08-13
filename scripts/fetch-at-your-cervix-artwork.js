#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing PodcastIndex API credentials in .env.local');
  process.exit(1);
}

console.log('🎨 Fetching real artwork for At Your Cervix album...');

// The feed GUID for At Your Cervix
const FEED_GUID = '0d6c245c-4b25-571c-8c7d-6a7e0d219427';

function getAuthHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000).toString();
  const hash = crypto
    .createHash('sha1')
    .update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime)
    .digest('hex');

  return {
    'X-Auth-Date': apiHeaderTime,
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'Authorization': hash,
    'User-Agent': 'FUCKIT-Artwork-Fetch/1.0'
  };
}

async function fetchAtYourCervixArtwork() {
  try {
    console.log('📡 Fetching feed information from PodcastIndex API...');
    
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(FEED_GUID)}`;
    
    console.log('📡 Request URL:', url);
    
    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    console.log('📡 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return null;
    }

    const data = await response.json();
    
    if (data.status === 'true' && data.feed) {
      const feed = data.feed;
      console.log('✅ Found feed:', feed.title);
      console.log('📡 Feed URL:', feed.url);
      console.log('🎨 Feed artwork:', feed.artwork || feed.image || 'No artwork found');
      
      // Return the artwork URL if found
      return feed.artwork || feed.image || null;
    } else {
      console.log('❌ No feed found for GUID:', FEED_GUID);
      return null;
    }

  } catch (error) {
    console.error('❌ API request failed:', error);
    return null;
  }
}

async function updateParsedFeedsWithRealArtwork(artworkUrl) {
  if (!artworkUrl) {
    console.log('❌ No artwork URL to update with');
    return;
  }

  try {
    console.log('📝 Updating parsed-feeds.json with real artwork...');
    
    const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const backupPath = path.join(__dirname, '..', 'data', 'parsed-feeds-backup-before-real-artwork.json');
    
    // Create backup
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(parsedFeedsPath, backupPath);
      console.log('📋 Created backup:', backupPath);
    }
    
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    const feeds = parsedFeedsData.feeds;
    
    let found = false;
    
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      
      if (feed.parseStatus === 'success' && 
          feed.parsedData?.album?.title === 'At Your Cervix') {
        
        console.log(`✅ Found "At Your Cervix" album at index ${i}`);
        
        const album = feed.parsedData.album;
        const oldCoverArt = album.coverArt;
        
        // Update the album coverArt with real artwork
        feeds[i].parsedData.album.coverArt = artworkUrl;
        
        // Update all track images to use the real artwork
        if (album.tracks && Array.isArray(album.tracks)) {
          for (let j = 0; j < album.tracks.length; j++) {
            feeds[i].parsedData.album.tracks[j].image = artworkUrl;
          }
          console.log(`📝 Updated ${album.tracks.length} track images with real artwork`);
        }
        
        console.log(`🔄 Replaced placeholder artwork with real artwork: ${artworkUrl}`);
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('❌ Could not find "At Your Cervix" album in parsed feeds');
      return;
    }
    
    // Save updated feeds
    parsedFeedsData.feeds = feeds;
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    
    console.log('\n✅ Successfully updated "At Your Cervix" album with real artwork!');
    console.log(`📁 Database updated: ${parsedFeedsPath}`);
    console.log(`🎨 Real artwork URL: ${artworkUrl}`);
    
  } catch (error) {
    console.error('❌ Error updating parsed feeds:', error);
  }
}

async function main() {
  console.log('🚀 Starting artwork fetch process...\n');
  
  // Fetch the real artwork from PodcastIndex
  const artworkUrl = await fetchAtYourCervixArtwork();
  
  if (artworkUrl) {
    // Update the parsed feeds with the real artwork
    await updateParsedFeedsWithRealArtwork(artworkUrl);
  } else {
    console.log('❌ Failed to fetch artwork from PodcastIndex API');
  }
}

main().catch(console.error);
