#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Problematic domains that return HTML/JSON instead of images
const BROKEN_DOMAINS = [
  'thebearsnare.com',
  'ichef.bbci.co.uk' // BBC images often have access restrictions
];

// Alternative artwork sources for specific artists/tracks
const ARTWORK_REPLACEMENTS = {
  'thebearsnare.com': {
    'Rain': 'https://via.placeholder.com/300x300/1e40af/ffffff?text=Rain',
    'In the Bedroom': 'https://via.placeholder.com/300x300/1e40af/ffffff?text=In+the+Bedroom'
  }
};

function generateSignature(apiSecret, timestamp) {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(apiSecret + timestamp).digest('hex');
}

async function searchPodcastIndex(track) {
  if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
    console.log('⚠️  PodcastIndex API credentials not found in .env.local');
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(PODCAST_INDEX_API_SECRET, timestamp);

  const searchQueries = [
    track.title,
    track.artist ? `${track.title} ${track.artist}` : track.title,
    track.artist ? `${track.artist} ${track.title}` : track.artist
  ].filter(Boolean);

  for (const query of searchQueries) {
    try {
      const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'FUCKIT-Artwork-Fix/1.0',
          'X-Auth-Key': PODCAST_INDEX_API_KEY,
          'X-Auth-Date': timestamp.toString(),
          'Authorization': signature
        }
      });

      if (!response.ok) {
        console.log(`⚠️  API error for "${query}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.feeds && data.feeds.length > 0) {
        const feed = data.feeds[0];
        if (feed.artwork || feed.image) {
          const artworkUrl = feed.artwork || feed.image;
          console.log(`✅ Found artwork for "${query}": ${artworkUrl}`);
          return artworkUrl;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    } catch (error) {
      console.log(`⚠️  Error searching for "${query}": ${error.message}`);
    }
  }
  return null;
}

async function fixArtworkUrls() {
  console.log('🔧 Starting artwork URL fixes...');
  
  const tracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
  const backupPath = path.join(__dirname, '..', 'data', 'music-tracks-backup-before-fix.json');
  
  // Create backup
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tracksPath, backupPath);
    console.log('📋 Created backup:', backupPath);
  }
  
  const tracksData = JSON.parse(fs.readFileSync(tracksPath, 'utf8'));
  const tracks = tracksData.musicTracks;
  
  let fixedCount = 0;
  let replacedCount = 0;
  let apiFoundCount = 0;
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    
    if (!track.artworkUrl || track.artworkUrl === 'null' || track.artworkUrl === 'undefined') {
      continue;
    }
    
    let needsFix = false;
    let newArtworkUrl = track.artworkUrl;
    
    // Check for HTTP URLs
    if (track.artworkUrl.startsWith('http://')) {
      newArtworkUrl = track.artworkUrl.replace('http://', 'https://');
      needsFix = true;
      console.log(`🔒 Converting HTTP to HTTPS: ${track.title}`);
    }
    
    // Check for broken domains
    for (const brokenDomain of BROKEN_DOMAINS) {
      if (track.artworkUrl.includes(brokenDomain)) {
        console.log(`🚫 Found broken domain ${brokenDomain} for: ${track.title}`);
        
        // Try to find replacement in our mapping
        if (ARTWORK_REPLACEMENTS[brokenDomain] && ARTWORK_REPLACEMENTS[brokenDomain][track.title]) {
          newArtworkUrl = ARTWORK_REPLACEMENTS[brokenDomain][track.title];
          console.log(`🔄 Using replacement artwork for: ${track.title}`);
        } else {
          // Try PodcastIndex API
          console.log(`🔍 Searching PodcastIndex API for: ${track.title}`);
          const apiArtwork = await searchPodcastIndex(track);
          if (apiArtwork) {
            newArtworkUrl = apiArtwork;
            apiFoundCount++;
            console.log(`✅ API found artwork for: ${track.title}`);
          } else {
            // Use placeholder as last resort
            newArtworkUrl = `https://via.placeholder.com/300x300/1e40af/ffffff?text=${encodeURIComponent(track.title)}`;
            console.log(`⚠️  Using placeholder for: ${track.title}`);
          }
        }
        needsFix = true;
        break;
      }
    }
    
    if (needsFix) {
      tracks[i].artworkUrl = newArtworkUrl;
      fixedCount++;
      
      if (newArtworkUrl !== track.artworkUrl) {
        replacedCount++;
      }
    }
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`📊 Processed ${i + 1}/${tracks.length} tracks...`);
    }
  }
  
  // Save updated tracks
  tracksData.musicTracks = tracks;
  fs.writeFileSync(tracksPath, JSON.stringify(tracksData, null, 2));
  
  console.log('\n🎯 Artwork URL Fix Summary:');
  console.log(`- Total tracks processed: ${tracks.length}`);
  console.log(`- URLs fixed: ${fixedCount}`);
  console.log(`- URLs replaced: ${replacedCount}`);
  console.log(`- API-found artwork: ${apiFoundCount}`);
  console.log(`- Database updated: ${tracksPath}`);
}

// Run the fix
fixArtworkUrls().catch(console.error);
