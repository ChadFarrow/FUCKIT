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
    const feedHeaders = generateAuthHeaders(); // Fresh headers for each call
    
    const feedResponse = await fetch(feedUrl, { headers: feedHeaders });
    
    if (feedResponse.status === 429) {
      console.log(`⏸️ [${index + 1}] Rate limited - stopping here`);
      return null;
    }
    
    if (feedResponse.status === 401) {
      console.log(`🔐 [${index + 1}] Auth failed on feed lookup`);
      return null;
    }
    
    if (!feedResponse.ok) {
      throw new Error(`Feed lookup failed: ${feedResponse.status} ${feedResponse.statusText}`);
    }
    
    const feedData = await feedResponse.json();
    
    if (feedData.status !== 'true' || !feedData.feed) {
      throw new Error('Feed not found');
    }
    
    console.log(`🎙️ [${index + 1}] Found feed: ${feedData.feed.title}`);
    console.log(`🆔 [${index + 1}] Feed ID: ${feedData.feed.id}`);
    
    // Wait 10 seconds and generate fresh auth headers for episode lookup
    console.log(`⏳ [${index + 1}] Waiting 10 seconds for episode lookup...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 2: Get episode info with fresh auth headers
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${track.itemGuid}&feedid=${feedData.feed.id}`;
    const episodeHeaders = generateAuthHeaders(); // Fresh headers
    
    console.log(`🔍 [${index + 1}] Looking up episode ${track.itemGuid.substring(0, 8)}...`);
    
    const episodeResponse = await fetch(episodeUrl, { headers: episodeHeaders });
    
    if (episodeResponse.status === 429) {
      console.log(`⏸️ [${index + 1}] Rate limited on episode - stopping here`);
      return null;
    }
    
    if (episodeResponse.status === 401) {
      console.log(`🔐 [${index + 1}] Auth failed on episode lookup`);
      return null;
    }
    
    if (!episodeResponse.ok) {
      const errorText = await episodeResponse.text();
      console.log(`❌ [${index + 1}] Episode lookup failed (${episodeResponse.status}): ${errorText.substring(0, 100)}`);
      throw new Error(`Episode lookup failed: ${episodeResponse.status} ${episodeResponse.statusText}`);
    }
    
    const episodeData = await episodeResponse.json();
    
    if (episodeData.status !== 'true' || !episodeData.episode) {
      console.log(`❌ [${index + 1}] Episode not found in API response:`, JSON.stringify(episodeData, null, 2).substring(0, 200));
      throw new Error('Episode not found in response');
    }
    
    console.log(`🎵 [${index + 1}] ✅ Resolved: ${episodeData.episode.title}`);
    console.log(`🔗 [${index + 1}] Audio: ${episodeData.episode.enclosureUrl ? 'YES' : 'NO'}`);
    console.log(`🖼️ [${index + 1}] Image: ${episodeData.episode.image ? 'YES' : 'NO'}`);
    console.log(`⏱️ [${index + 1}] Duration: ${episodeData.episode.duration || 'Unknown'}`);
    
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
  console.log('🎵 HGH track resolution with fixed authentication...');
  console.log('🔐 Using fresh auth headers for each API call');
  console.log('⏰ Processing tracks one at a time with delays\n');
  
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  
  console.log(`📋 Total tracks: ${resolvedSongs.length}`);
  console.log('🧪 Processing first 5 tracks as test\n');
  
  const resolvedTracks = [];
  const audioUrlMap = {};
  const artworkUrlMap = {};
  
  // Process first 5 tracks
  for (let i = 0; i < Math.min(5, resolvedSongs.length); i++) {
    const track = resolvedSongs[i];
    
    const resolved = await resolveOneTrack(track, i);
    
    if (resolved === null) {
      console.log('\n⏸️ Stopped due to error or rate limit');
      break;
    }
    
    resolvedTracks.push(resolved);
    
    if (resolved.audioUrl) {
      audioUrlMap[resolved.title] = resolved.audioUrl;
    }
    
    if (resolved.artworkUrl) {
      artworkUrlMap[resolved.title] = resolved.artworkUrl;
    }
    
    // Wait 15 seconds between tracks
    if (i < 4) {
      console.log(`⏳ Waiting 15 seconds before next track...\n`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
  
  // Save results
  if (resolvedTracks.length > 0) {
    console.log(`\n💾 Saving ${resolvedTracks.length} resolved tracks...`);
    
    // Update audio URLs
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
    
    console.log('\n🎉 Success!');
    console.log(`✅ ${Object.keys(audioUrlMap).length} tracks with audio URLs`);
    console.log(`🖼️ ${Object.keys(artworkUrlMap).length} tracks with artwork URLs`);
    console.log('\n🌐 Refresh the HGH playlist page to see real tracks!');
  } else {
    console.log('\n❌ No tracks were successfully resolved');
  }
}

main().catch(console.error);