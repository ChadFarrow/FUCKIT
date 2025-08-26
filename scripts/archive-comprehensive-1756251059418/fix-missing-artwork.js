#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const crypto = require('crypto');

// Load API credentials
function loadApiCredentials() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found');
    return null;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const credentials = {};
  
  lines.forEach(line => {
    if (line.includes('=')) {
      const [key, value] = line.split('=');
      credentials[key.trim()] = value.trim();
    }
  });
  
  return credentials;
}

// Generate Podcast Index API headers
function generatePodcastIndexHeaders(apiKey, apiSecret) {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(apiKey + apiSecret + apiHeaderTime);
  const hashedCredentials = hash.digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-music-app',
    'X-Auth-Date': apiHeaderTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hashedCredentials
  };
}

// Parse XML to extract track info
async function parseXMLString(xmlString) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalizeTags: true,
    tagNameProcessors: [xml2js.processors.stripPrefix]
  });
  
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Get artwork from feed
async function getArtworkFromFeed(feedUrl, feedGuid, apiCredentials) {
  try {
    // Try Podcast Index API first
    if (feedGuid && apiCredentials.PODCAST_INDEX_API_KEY) {
      const headers = generatePodcastIndexHeaders(
        apiCredentials.PODCAST_INDEX_API_KEY,
        apiCredentials.PODCAST_INDEX_API_SECRET
      );
      
      const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.feed && data.feed.image) {
          console.log(`✅ Found artwork via API: ${data.feed.image}`);
          return data.feed.image;
        }
      }
    }
    
    // Fallback to direct RSS fetch
    if (feedUrl) {
      const response = await fetch(feedUrl);
      if (response.ok) {
        const xmlText = await response.text();
        const parsed = await parseXMLString(xmlText);
        
        if (parsed?.rss?.channel) {
          const channel = parsed.rss.channel;
          const artwork = channel.image?.url || 
                         channel.itunesImage?.href || 
                         channel.itunesImage ||
                         channel.image ||
                         '';
          
          if (artwork && typeof artwork === 'string' && artwork.startsWith('http')) {
            console.log(`✅ Found artwork via RSS: ${artwork}`);
            return artwork;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log(`⚠️  Error getting artwork: ${error.message}`);
    return null;
  }
}

// Fix missing artwork for albums
async function fixMissingArtwork(maxAlbums = 30) {
  console.log('🎨 Fixing missing artwork for albums...\n');
  
  const apiCredentials = loadApiCredentials();
  if (!apiCredentials || !apiCredentials.PODCAST_INDEX_API_KEY) {
    console.error('❌ Podcast Index API credentials not found');
    return;
  }
  
  // Load albums missing artwork
  const artworkPath = path.join(__dirname, '../data/albums-missing-artwork.json');
  if (!fs.existsSync(artworkPath)) {
    console.error('❌ albums-missing-artwork.json not found.');
    return;
  }
  
  const albumsMissingArtwork = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));
  console.log(`📊 Found ${albumsMissingArtwork.length} albums missing artwork`);
  
  // Load music tracks data
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  const musicData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  // Backup
  const backupPath = dbPath + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(dbPath));
  console.log(`💾 Backed up to: ${backupPath}\n`);
  
  let updated = 0;
  const albumsToProcess = albumsMissingArtwork.slice(0, maxAlbums);
  
  for (let i = 0; i < albumsToProcess.length; i++) {
    const album = albumsToProcess[i];
    console.log(`[${i + 1}/${albumsToProcess.length}] Processing: ${album.feedTitle}`);
    
    // Get artwork URL
    const artworkUrl = await getArtworkFromFeed(album.feedUrl, album.feedGuid, apiCredentials);
    
    if (artworkUrl) {
      // Update all tracks for this album
      let tracksUpdated = 0;
      musicData.musicTracks.forEach(track => {
        if ((track.feedGuid === album.feedGuid || track.feedUrl === album.feedUrl) && 
            (!track.feedImage || track.feedImage.trim() === '' || !track.image || track.image.trim() === '')) {
          track.feedImage = artworkUrl;
          track.image = artworkUrl;
          tracksUpdated++;
        }
      });
      
      console.log(`  ✅ Updated ${tracksUpdated} tracks with artwork`);
      updated++;
    } else {
      console.log(`  ❌ Could not find artwork`);
    }
    
    // Light rate limiting
    if (i < albumsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('');
  }
  
  // Save updated data
  fs.writeFileSync(dbPath, JSON.stringify(musicData, null, 2));
  
  console.log(`\n📈 Summary:`);
  console.log(`   Albums processed: ${albumsToProcess.length}`);
  console.log(`   Albums updated: ${updated}`);
  console.log(`   Success rate: ${Math.round((updated / albumsToProcess.length) * 100)}%`);
  console.log(`   Total tracks in database: ${musicData.musicTracks.length}`);
}

// Run the script
if (require.main === module) {
  const maxAlbums = process.argv[2] ? parseInt(process.argv[2]) : 30;
  console.log(`🚀 Processing up to ${maxAlbums} albums\n`);
  fixMissingArtwork(maxAlbums).catch(console.error);
}

module.exports = { fixMissingArtwork };