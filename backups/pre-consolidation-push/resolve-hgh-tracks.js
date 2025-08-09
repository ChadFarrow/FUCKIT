#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Podcast Index API credentials
const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

// Function to create auth headers for Podcast Index API
function createAuthHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = 'sha1';
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = API_KEY + API_SECRET + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest('hex');

  return {
    'X-Auth-Key': API_KEY,
    'X-Auth-Date': apiHeaderTime.toString(),
    'Authorization': hash4Header,
    'User-Agent': 'HGH-Resolver/1.0'
  };
}

// Function to resolve a single track
async function resolveTrack(feedGuid, itemGuid, index) {
  try {
    // First, try to get the episode by GUID
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}&feedguid=${feedGuid}`;
    
    const response = await fetch(episodeUrl, {
      headers: createAuthHeaders()
    });

    if (!response.ok) {
      console.log(`⚠️  Track ${index + 1}: Failed to fetch episode data`);
      return null;
    }

    const data = await response.json();
    
    if (!data.episode) {
      console.log(`⚠️  Track ${index + 1}: No episode found`);
      return null;
    }

    const episode = data.episode;
    
    // Extract relevant information
    const trackInfo = {
      feedGuid,
      itemGuid,
      title: episode.title || `HGH Track ${index + 1}`,
      artist: episode.feedTitle || 'Unknown Artist',
      audioUrl: episode.enclosureUrl || '',
      artworkUrl: episode.image || episode.feedImage || '',
      duration: episode.duration || 180,
      feedTitle: episode.feedTitle || 'Unknown Feed'
    };

    console.log(`✅ Track ${index + 1}: ${trackInfo.title} by ${trackInfo.artist}`);
    return trackInfo;

  } catch (error) {
    console.error(`❌ Track ${index + 1}: Error resolving:`, error.message);
    return null;
  }
}

// Function to delay between API calls to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎵 Starting HGH tracks resolution...\n');

  // Fetch the playlist from the API
  const playlistResponse = await fetch('http://localhost:3001/api/hgh-songs-list');
  const playlistData = await playlistResponse.json();
  
  if (!playlistData.success) {
    console.error('❌ Failed to fetch playlist data');
    process.exit(1);
  }

  const tracks = playlistData.tracks;
  console.log(`📋 Found ${tracks.length} tracks to resolve\n`);

  const resolvedTracks = [];
  const audioUrls = {};
  const artworkUrls = {};

  // Process tracks in batches to avoid overwhelming the API
  const batchSize = 10;
  const delayBetweenBatches = 2000; // 2 seconds
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, Math.min(i + batchSize, tracks.length));
    
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tracks.length / batchSize)}...`);
    
    const batchPromises = batch.map((track, batchIndex) => 
      resolveTrack(track.feedGuid, track.itemGuid, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result) {
        resolvedTracks.push(result);
        
        // Map by track number for now
        const trackKey = `HGH Track ${i + j + 1}`;
        if (result.audioUrl) {
          audioUrls[trackKey] = result.audioUrl;
        }
        if (result.artworkUrl) {
          artworkUrls[trackKey] = result.artworkUrl;
        }
      }
    }
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < tracks.length) {
      console.log(`⏳ Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
      await delay(delayBetweenBatches);
    }
  }

  console.log(`\n✅ Resolution complete!`);
  console.log(`   - Resolved: ${resolvedTracks.length}/${tracks.length} tracks`);
  console.log(`   - With audio: ${Object.keys(audioUrls).length}`);
  console.log(`   - With artwork: ${Object.keys(artworkUrls).length}`);

  // Save resolved tracks
  const resolvedPath = path.join(__dirname, '..', 'data', 'hgh-resolved-tracks.json');
  fs.writeFileSync(resolvedPath, JSON.stringify(resolvedTracks, null, 2));
  console.log(`\n💾 Saved resolved tracks to: data/hgh-resolved-tracks.json`);

  // Update audio URLs file
  const audioUrlsContent = `// HGH Music Playlist Audio URLs
// Map of track titles to their audio URLs
// Generated: ${new Date().toISOString()}

export const HGH_AUDIO_URL_MAP: { [title: string]: string } = ${JSON.stringify(audioUrls, null, 2)};

export default HGH_AUDIO_URL_MAP;
`;
  
  const audioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
  fs.writeFileSync(audioUrlsPath, audioUrlsContent);
  console.log(`💾 Updated: data/hgh-audio-urls.ts`);

  // Update artwork URLs file
  const artworkUrlsContent = `// HGH Music Playlist Artwork URLs
// Map of track titles to their artwork URLs
// Generated: ${new Date().toISOString()}

export const HGH_ARTWORK_URL_MAP: { [title: string]: string } = ${JSON.stringify(artworkUrls, null, 2)};

export default HGH_ARTWORK_URL_MAP;
`;

  const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
  fs.writeFileSync(artworkUrlsPath, artworkUrlsContent);
  console.log(`💾 Updated: data/hgh-artwork-urls.ts`);

  console.log('\n🎉 HGH tracks resolution complete!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});