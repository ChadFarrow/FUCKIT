#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

// Generate auth headers for Podcast Index API
function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔄 Fetching: ${url} (attempt ${i + 1})`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed: ${error.message}`);
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
    }
  }
}

async function resolveFeedInfo(feedGuid) {
  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  const headers = generateAuthHeaders();
  
  try {
    const data = await fetchWithRetry(url, { headers });
    
    if (data.status === 'true' && data.feed) {
      return {
        feedTitle: data.feed.title,
        feedUrl: data.feed.url,
        feedId: data.feed.id,
        feedDescription: data.feed.description
      };
    } else {
      throw new Error(`Feed not found: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`❌ Failed to resolve feed ${feedGuid}: ${error.message}`);
    return null;
  }
}

async function resolveEpisodeInfo(feedId, itemGuid) {
  const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}&feedid=${feedId}`;
  const headers = generateAuthHeaders();
  
  try {
    const data = await fetchWithRetry(url, { headers });
    
    if (data.status === 'true' && data.episode) {
      return {
        title: data.episode.title,
        description: data.episode.description,
        duration: data.episode.duration,
        enclosureUrl: data.episode.enclosureUrl,
        image: data.episode.image,
        episodeId: data.episode.id,
        datePublished: data.episode.datePublished
      };
    } else {
      throw new Error(`Episode not found: ${data.description || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`❌ Failed to resolve episode ${itemGuid} in feed ${feedId}: ${error.message}`);
    return null;
  }
}

async function extractArtistFromTitle(title, description) {
  // Try to extract artist info from title or description
  // Common patterns: "Artist - Song", "Song by Artist", etc.
  
  if (!title) return 'Unknown Artist';
  
  // Pattern: "Artist - Song"
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      return parts[0].trim();
    }
  }
  
  // Pattern: "Song by Artist"
  const byPattern = / by (.+)/i;
  const byMatch = title.match(byPattern);
  if (byMatch) {
    return byMatch[1].trim();
  }
  
  // Look in description for artist info
  if (description) {
    const artistPattern = /artist:?\s*([^,\n]+)/i;
    const artistMatch = description.match(artistPattern);
    if (artistMatch) {
      return artistMatch[1].trim();
    }
  }
  
  return 'Unknown Artist';
}

async function main() {
  console.log('🎵 Starting detailed HGH tracks resolution...');
  
  // Load the existing resolved songs data
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  
  if (!fs.existsSync(resolvedSongsPath)) {
    console.error('❌ hgh-resolved-songs.json not found');
    process.exit(1);
  }
  
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  console.log(`📋 Found ${resolvedSongs.length} tracks to resolve`);
  
  const detailedTracks = [];
  const audioUrlMap = {};
  const artworkUrlMap = {};
  
  let successCount = 0;
  let failCount = 0;
  
  // Process tracks in smaller batches to avoid rate limiting
  const batchSize = 10;
  
  for (let i = 0; i < resolvedSongs.length; i += batchSize) {
    const batch = resolvedSongs.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} (tracks ${i + 1}-${Math.min(i + batchSize, resolvedSongs.length)})`);
    
    const batchPromises = batch.map(async (track, batchIndex) => {
      const trackIndex = i + batchIndex;
      
      try {
        // Step 1: Resolve feed info
        console.log(`🔍 [${trackIndex + 1}/${resolvedSongs.length}] Resolving feed ${track.feedGuid.substring(0, 8)}...`);
        const feedInfo = await resolveFeedInfo(track.feedGuid);
        
        if (!feedInfo) {
          throw new Error('Feed resolution failed');
        }
        
        console.log(`🎙️ [${trackIndex + 1}/${resolvedSongs.length}] Found feed: ${feedInfo.feedTitle}`);
        
        // Step 2: Resolve episode info
        console.log(`🔍 [${trackIndex + 1}/${resolvedSongs.length}] Resolving episode ${track.itemGuid.substring(0, 8)}...`);
        const episodeInfo = await resolveEpisodeInfo(feedInfo.feedId, track.itemGuid);
        
        if (!episodeInfo) {
          throw new Error('Episode resolution failed');
        }
        
        console.log(`🎵 [${trackIndex + 1}/${resolvedSongs.length}] Found track: ${episodeInfo.title}`);
        
        // Step 3: Extract artist info
        const artist = await extractArtistFromTitle(episodeInfo.title, episodeInfo.description);
        
        // Step 4: Create detailed track data
        const detailedTrack = {
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid,
          title: episodeInfo.title,
          artist: artist,
          feedUrl: feedInfo.feedUrl,
          feedTitle: feedInfo.feedTitle,
          duration: episodeInfo.duration,
          audioUrl: episodeInfo.enclosureUrl,
          artworkUrl: episodeInfo.image,
          episodeId: episodeInfo.episodeId,
          feedId: feedInfo.feedId,
          datePublished: episodeInfo.datePublished
        };
        
        detailedTracks.push(detailedTrack);
        
        // Build URL maps
        if (episodeInfo.enclosureUrl) {
          audioUrlMap[episodeInfo.title] = episodeInfo.enclosureUrl;
        }
        
        if (episodeInfo.image) {
          artworkUrlMap[episodeInfo.title] = episodeInfo.image;
        }
        
        successCount++;
        console.log(`✅ [${trackIndex + 1}/${resolvedSongs.length}] Resolved: ${episodeInfo.title} by ${artist}`);
        
        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        failCount++;
        console.error(`❌ [${trackIndex + 1}/${resolvedSongs.length}] Failed to resolve track: ${error.message}`);
        
        // Still add a placeholder entry
        detailedTracks.push({
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid,
          title: `HGH Track ${trackIndex + 1}`,
          artist: 'Unknown Artist',
          feedTitle: 'Homegrown Hits',
          duration: 180,
          audioUrl: '',
          artworkUrl: ''
        });
      }
    });
    
    // Process batch concurrently but wait for completion
    await Promise.all(batchPromises);
    
    // Longer pause between batches
    if (i + batchSize < resolvedSongs.length) {
      console.log('⏳ Pausing between batches...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Step 5: Save detailed tracks data
  console.log('💾 Saving detailed tracks data...');
  
  const detailedTracksPath = path.join(__dirname, '..', 'data', 'hgh-detailed-tracks.json');
  fs.writeFileSync(detailedTracksPath, JSON.stringify(detailedTracks, null, 2));
  
  // Step 6: Update audio URLs map
  const audioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
  const audioUrlsContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Real audio URLs resolved from RSS feeds for all HGH tracks
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = ${JSON.stringify(audioUrlMap, null, 2)};
`;
  fs.writeFileSync(audioUrlsPath, audioUrlsContent);
  
  // Step 7: Update artwork URLs map
  const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
  const artworkUrlsContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs resolved from RSS feeds for all HGH tracks
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = ${JSON.stringify(artworkUrlMap, null, 2)};
`;
  fs.writeFileSync(artworkUrlsPath, artworkUrlsContent);
  
  // Summary
  console.log('\n🎉 HGH tracks resolution completed!');
  console.log(`✅ Successfully resolved: ${successCount} tracks`);
  console.log(`❌ Failed to resolve: ${failCount} tracks`);
  console.log(`🎵 Total tracks with audio: ${Object.keys(audioUrlMap).length}`);
  console.log(`🖼️ Total tracks with artwork: ${Object.keys(artworkUrlMap).length}`);
  console.log('\n📁 Files updated:');
  console.log(`  - ${detailedTracksPath}`);
  console.log(`  - ${audioUrlsPath}`);
  console.log(`  - ${artworkUrlsPath}`);
}

main().catch(console.error);