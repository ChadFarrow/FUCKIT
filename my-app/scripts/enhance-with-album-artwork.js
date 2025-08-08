#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load env from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const PODCASTINDEX_BASE = 'https://api.podcastindex.org/api/1.0';

function getEnv(name) {
  return process.env[name] ?? '';
}

function sha1Hex(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function buildPiHeaders() {
  const apiKey = getEnv('PODCASTINDEX_API_KEY');
  const apiSecret = getEnv('PODCASTINDEX_API_SECRET');
  if (!apiKey || !apiSecret) {
    console.error('Missing PODCASTINDEX_API_KEY or PODCASTINDEX_API_SECRET in .env.local');
    return null;
  }
  const ts = Math.floor(Date.now() / 1000);
  const authHash = sha1Hex(apiKey + apiSecret + ts);
  return {
    'X-Auth-Date': String(ts),
    'X-Auth-Key': apiKey,
    'Authorization': authHash,
    'User-Agent': 'album-artwork-enhancer/1.0',
    'Accept': 'application/json'
  };
}

async function piGet(endpoint, params = {}) {
  const headers = buildPiHeaders();
  if (!headers) return null;
  
  const url = new URL(PODCASTINDEX_BASE + endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    return null;
  }
}

async function getAlbumArtwork(feedGuid, itemGuid) {
  console.log(`🎨 Fetching artwork for ${feedGuid} / ${itemGuid}`);
  
  // First, try to get the episode info
  const episodeData = await piGet('/episodes/byguid', { guid: itemGuid });
  if (episodeData && episodeData.episode) {
    const episode = episodeData.episode;
    
    // Check if episode has artwork
    if (episode.image) {
      console.log(`✅ Found episode artwork: ${episode.image}`);
      return episode.image;
    }
  }
  
  // If no episode artwork, try to get feed artwork
  const feedData = await piGet('/podcasts/byguid', { guid: feedGuid });
  if (feedData && feedData.feed) {
    const feed = feedData.feed;
    
    // Check if feed has artwork
    if (feed.image) {
      console.log(`✅ Found feed artwork: ${feed.image}`);
      return feed.image;
    }
    
    // Check for iTunes image
    if (feed.artwork) {
      console.log(`✅ Found iTunes artwork: ${feed.artwork}`);
      return feed.artwork;
    }
  }
  
  console.log(`❌ No artwork found for ${feedGuid} / ${itemGuid}`);
  return null;
}

async function enhanceWithAlbumArtwork() {
  console.log('🎨 Enhancing ITDV playlist with album artwork...\n');
  
  // Read the existing resolved data
  const resolvedPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.json');
  let songs = [];
  
  try {
    const existingContent = await fs.readFile(resolvedPath, 'utf-8');
    songs = JSON.parse(existingContent);
    console.log(`📊 Loaded ${songs.length} songs from ${resolvedPath}`);
  } catch (error) {
    console.error(`❌ Failed to load resolved songs: ${error.message}`);
    return;
  }
  
  let enhancedCount = 0;
  let totalProcessed = 0;
  
  for (const song of songs) {
    totalProcessed++;
    console.log(`\n[${totalProcessed}/${songs.length}] Processing: ${song.title || 'Unknown Track'}`);
    
    // Skip if already has artwork
    if (song.albumArtwork || song.artwork) {
      console.log(`⏭️ Already has artwork: ${song.albumArtwork || song.artwork}`);
      continue;
    }
    
    // Only process resolved songs
    if (!song.title || !song.artist) {
      console.log(`⏭️ Skipping unresolved song`);
      continue;
    }
    
    try {
      const artwork = await getAlbumArtwork(song.feedGuid, song.itemGuid);
      if (artwork) {
        song.albumArtwork = artwork;
        enhancedCount++;
        console.log(`✅ Enhanced with artwork: ${artwork}`);
      }
      
      // Add a small delay to be respectful to PodcastIndex API
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`❌ Error fetching artwork: ${error.message}`);
    }
  }
  
  // Save enhanced data
  const enhancedPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-fully-resolved.json');
  await fs.writeFile(enhancedPath, JSON.stringify(songs, null, 2));
  
  console.log(`\n🎉 Enhancement complete!`);
  console.log(`📊 Total songs processed: ${totalProcessed}`);
  console.log(`🎨 Songs enhanced with artwork: ${enhancedCount}`);
  console.log(`💾 Enhanced data saved to: ${enhancedPath}`);
  
  // Show some examples
  const enhancedSongs = songs.filter(s => s.albumArtwork);
  if (enhancedSongs.length > 0) {
    console.log(`\n🎨 Example enhanced songs:`);
    enhancedSongs.slice(0, 5).forEach(song => {
      console.log(`  ${song.title} by ${song.artist} - ${song.albumArtwork}`);
    });
  }
}

// Run the enhancement
enhanceWithAlbumArtwork().catch(console.error);
