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

// Get artist info from feed
async function getArtistFromFeed(feedUrl, feedGuid, apiCredentials) {
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
        if (data.feed) {
          const artist = data.feed.author || data.feed.itunesAuthor || '';
          if (artist && typeof artist === 'string' && artist.trim()) {
            console.log(`✅ Found artist via API: "${artist}"`);
            return artist.trim();
          }
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
          const artist = channel.itunesauthor || channel.author || channel.managingEditor || '';
          if (artist && typeof artist === 'string' && artist.trim()) {
            console.log(`✅ Found artist via RSS: "${artist}"`);
            return artist.trim();
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log(`⚠️  Error getting artist info: ${error.message}`);
    return null;
  }
}

// Update albums with publisher info
async function addMissingPublisherInfo(maxAlbums = 20) {
  console.log('🎯 Adding missing publisher information to albums...\n');
  
  const apiCredentials = loadApiCredentials();
  if (!apiCredentials || !apiCredentials.PODCAST_INDEX_API_KEY) {
    console.error('❌ Podcast Index API credentials not found');
    return;
  }
  
  // Load albums without publisher info
  const albumsPath = path.join(__dirname, '../data/albums-without-publisher.json');
  if (!fs.existsSync(albumsPath)) {
    console.error('❌ albums-without-publisher.json not found. Run the analysis first.');
    return;
  }
  
  const albumsWithoutPublisher = JSON.parse(fs.readFileSync(albumsPath, 'utf8'));
  console.log(`📊 Found ${albumsWithoutPublisher.length} albums without publisher info`);
  
  // Load music tracks data
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  const musicData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  // Backup
  const backupPath = dbPath + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(dbPath));
  console.log(`💾 Backed up to: ${backupPath}\n`);
  
  let updated = 0;
  const albumsToProcess = albumsWithoutPublisher.slice(0, maxAlbums);
  
  for (let i = 0; i < albumsToProcess.length; i++) {
    const album = albumsToProcess[i];
    console.log(`[${i + 1}/${albumsToProcess.length}] Processing: ${album.feedTitle}`);
    
    // Get artist info
    const artist = await getArtistFromFeed(album.feedUrl, album.feedGuid, apiCredentials);
    
    if (artist) {
      // Update all tracks for this album
      let tracksUpdated = 0;
      musicData.musicTracks.forEach(track => {
        if ((track.feedGuid === album.feedGuid || track.feedUrl === album.feedUrl) && 
            (!track.feedArtist || track.feedArtist.trim() === '')) {
          track.feedArtist = artist;
          tracksUpdated++;
        }
      });
      
      console.log(`  ✅ Updated ${tracksUpdated} tracks with artist: "${artist}"`);
      updated++;
    } else {
      console.log(`  ❌ Could not find artist information`);
    }
    
    // Light rate limiting for API requests
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
  const maxAlbums = process.argv[2] ? parseInt(process.argv[2]) : 20;
  console.log(`🚀 Processing up to ${maxAlbums} albums\n`);
  addMissingPublisherInfo(maxAlbums).catch(console.error);
}

module.exports = { addMissingPublisherInfo };