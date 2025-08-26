#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

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

async function resolveOneTrack(track, index) {
  console.log(`🔍 [${index + 1}] Starting resolution for ${track.feedGuid.substring(0, 8)}...`);
  
  try {
    // Step 1: Get feed info
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${track.feedGuid}`;
    const feedHeaders = generateAuthHeaders();
    
    const feedResponse = await fetch(feedUrl, { headers: feedHeaders });
    
    if (feedResponse.status === 429) {
      console.log(`⏸️ [${index + 1}] Rate limited - stopping here`);
      return null;
    }
    
    if (!feedResponse.ok) {
      throw new Error(`Feed lookup failed: ${feedResponse.status}`);
    }
    
    const feedData = await feedResponse.json();
    
    if (feedData.status !== 'true' || !feedData.feed) {
      throw new Error('Feed not found');
    }
    
    console.log(`🎙️ [${index + 1}] Found feed: ${feedData.feed.title}`);
    
    // Wait 10 seconds between API calls to be very conservative
    console.log(`⏳ [${index + 1}] Waiting 10 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 2: Get episode info
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${track.itemGuid}&feedid=${feedData.feed.id}`;
    const episodeHeaders = generateAuthHeaders();
    
    const episodeResponse = await fetch(episodeUrl, { headers: episodeHeaders });
    
    if (episodeResponse.status === 429) {
      console.log(`⏸️ [${index + 1}] Rate limited on episode - stopping here`);
      return null;
    }
    
    if (!episodeResponse.ok) {
      throw new Error(`Episode lookup failed: ${episodeResponse.status}`);
    }
    
    const episodeData = await episodeResponse.json();
    
    if (episodeData.status !== 'true' || !episodeData.episode) {
      throw new Error('Episode not found');
    }
    
    console.log(`🎵 [${index + 1}] ✅ Resolved: ${episodeData.episode.title}`);
    console.log(`🔗 [${index + 1}] Audio: ${episodeData.episode.enclosureUrl ? 'YES' : 'NO'}`);
    
    return {
      feedGuid: track.feedGuid,
      itemGuid: track.itemGuid,
      title: episodeData.episode.title,
      artist: feedData.feed.title, // Use feed title as artist
      feedUrl: feedData.feed.url,
      feedTitle: feedData.feed.title,
      duration: episodeData.episode.duration,
      audioUrl: episodeData.episode.enclosureUrl,
      artworkUrl: episodeData.episode.image,
      episodeId: episodeData.episode.id,
      feedId: feedData.feed.id
    };
    
  } catch (error) {
    console.error(`❌ [${index + 1}] Failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🐌 Very conservative HGH track resolution...');
  console.log('⏰ Processing ONE track at a time with 10-second delays');
  console.log('🛑 Will stop immediately if rate limited');
  
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  
  console.log(`📋 Total tracks: ${resolvedSongs.length}`);
  console.log('🧪 Will process until rate limited, then save progress\n');
  
  const resolvedTracks = [];
  const audioUrlMap = {};
  const artworkUrlMap = {};
  
  // Process one at a time until rate limited
  for (let i = 0; i < Math.min(5, resolvedSongs.length); i++) { // Max 5 tracks to start
    const track = resolvedSongs[i];
    
    const resolved = await resolveOneTrack(track, i);
    
    if (resolved === null) {
      console.log('\n⏸️ Rate limited or failed - stopping here');
      break;
    }
    
    resolvedTracks.push(resolved);
    
    if (resolved.audioUrl) {
      audioUrlMap[resolved.title] = resolved.audioUrl;
    }
    
    if (resolved.artworkUrl) {
      artworkUrlMap[resolved.title] = resolved.artworkUrl;
    }
    
    // Wait 30 seconds between tracks to be extra conservative
    if (i < 4) { // Don't wait after the last one
      console.log(`⏳ Waiting 30 seconds before next track...\n`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  // Save progress
  if (resolvedTracks.length > 0) {
    console.log(`\n💾 Saving progress: ${resolvedTracks.length} tracks resolved`);
    
    // Update audio URLs (merge with existing sample data)
    const audioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
    const audioUrlsContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = ${JSON.stringify(audioUrlMap, null, 2)};
`;
    fs.writeFileSync(audioUrlsPath, audioUrlsContent);
    
    // Update artwork URLs
    const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
    const artworkUrlsContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = ${JSON.stringify(artworkUrlMap, null, 2)};
`;
    fs.writeFileSync(artworkUrlsPath, artworkUrlsContent);
    
    console.log('\n🎉 Progress saved!');
    console.log(`✅ ${Object.keys(audioUrlMap).length} tracks with audio`);
    console.log(`🖼️ ${Object.keys(artworkUrlMap).length} tracks with artwork`);
    console.log('\n🔄 Run this script again later to resolve more tracks');
  }
}

main().catch(console.error);