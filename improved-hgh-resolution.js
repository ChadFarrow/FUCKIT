const fs = require('fs');
const crypto = require('crypto');

// API credentials
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

async function resolveTrack(track, index, total) {
  try {
    console.log(`🔍 ${index}/${total}: Resolving "${track.title}" (${track.feedGuid})`);
    
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    // First get the feed info
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${track.feedGuid}&pretty`;
    
    const feedResponse = await fetch(feedUrl, {
      headers: {
        'X-Auth-Date': authDate.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (!feedResponse.ok) {
      console.log(`   ❌ Feed lookup failed: HTTP ${feedResponse.status}`);
      return null;
    }

    const feedData = await feedResponse.json();
    
    if (!feedData.feed) {
      console.log(`   ❌ No feed data returned`);
      return null;
    }

    console.log(`   ✅ Found feed: "${feedData.feed.title}"`);
    console.log(`   📊 Episodes available: ${feedData.feed.episodeCount}`);

    // Small delay before episodes request
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get episodes from this feed
    const authDate2 = Math.floor(Date.now() / 1000);
    const hash2 = createAuthHash(apiKey, apiSecret, authDate2);
    
    const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedData.feed.id}&max=200&pretty`;
    
    const episodeResponse = await fetch(episodesUrl, {
      headers: {
        'X-Auth-Date': authDate2.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash2,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (!episodeResponse.ok) {
      console.log(`   ❌ Episodes lookup failed: HTTP ${episodeResponse.status}`);
      return null;
    }

    const episodeData = await episodeResponse.json();
    
    if (!episodeData.items || episodeData.items.length === 0) {
      console.log(`   ❌ No episodes found in feed`);
      return null;
    }

    console.log(`   📊 Searching ${episodeData.items.length} episodes for itemGuid: ${track.itemGuid}`);

    // Look for our specific episode by itemGuid
    let episode = episodeData.items.find(ep => ep.guid === track.itemGuid);
    
    if (episode) {
      console.log(`   🎵 FOUND: "${episode.title}"`);
      console.log(`   🎧 Audio: ${episode.enclosureUrl ? '✅' : '❌'}`);
      console.log(`   🖼️ Artwork: ${episode.image || episode.feedImage || feedData.feed.artwork ? '✅' : '❌'}`);
      
      return {
        title: episode.title || 'Unknown Title',
        artist: episode.feedTitle || feedData.feed.title || 'Unknown Artist',
        feedTitle: episode.feedTitle || feedData.feed.title || 'Unknown Feed',
        duration: episode.duration || parseInt(episode.duration) || 180,
        audioUrl: episode.enclosureUrl || null,
        artworkUrl: episode.image || episode.feedImage || feedData.feed.artwork || feedData.feed.image || null
      };
    } else {
      console.log(`   ❌ Episode with GUID ${track.itemGuid} not found in ${episodeData.items.length} episodes`);
      
      // Debug: show first few episode GUIDs
      console.log(`   🔍 Available GUIDs: ${episodeData.items.slice(0, 3).map(ep => ep.guid).join(', ')}...`);
      
      return null;
    }
    
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Improved HGH Resolution Script');
  console.log('=' .repeat(50));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Load existing URL maps
  let audioUrlMap = {};
  let artworkUrlMap = {};
  
  try {
    const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
    const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    if (audioMatch) {
      const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          audioUrlMap[title] = url;
        });
      }
    }
    
    const artworkModule = fs.readFileSync('./data/hgh-artwork-urls.ts', 'utf8');
    const artworkMatch = artworkModule.match(/export const HGH_ARTWORK_URL_MAP[^{]*{([^}]*)}/s);
    if (artworkMatch) {
      const entries = artworkMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          artworkUrlMap[title] = url;
        });
      }
    }
  } catch (error) {
    console.log('Starting with existing URL maps');
  }
  
  // Find tracks that need resolution
  const tracksNeedingResolution = hghSongs.filter(track => 
    track.title.startsWith('Track ') ||  // Placeholder tracks
    track.title === 'Unknown Feed' ||    // Failed resolution tracks
    track.feedTitle === 'Unknown Feed' || // Feed title failures
    (!audioUrlMap[track.title] && !track.title.startsWith('Track ')) // Missing audio URLs
  );
  
  console.log(`📊 Analysis:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Current audio URLs: ${Object.keys(audioUrlMap).length}`);
  console.log(`   Tracks needing resolution: ${tracksNeedingResolution.length}`);
  
  // Show breakdown
  const placeholders = tracksNeedingResolution.filter(t => t.title.startsWith('Track ')).length;
  const unknownFeeds = tracksNeedingResolution.filter(t => t.title === 'Unknown Feed').length;
  const missingAudio = tracksNeedingResolution.filter(t => !t.title.startsWith('Track ') && t.title !== 'Unknown Feed' && !audioUrlMap[t.title]).length;
  
  console.log(`   - Placeholder tracks: ${placeholders}`);
  console.log(`   - "Unknown Feed" tracks: ${unknownFeeds}`);
  console.log(`   - Missing audio URLs: ${missingAudio}`);
  console.log('');
  
  if (tracksNeedingResolution.length === 0) {
    console.log('✅ All tracks are already resolved!');
    return;
  }
  
  let resolvedCount = 0;
  let updatedSongs = [...hghSongs];
  
  // Process in smaller batches to avoid rate limits - FULL RESOLUTION
  const batchSize = 5;
  const tracksToProcess = tracksNeedingResolution; // Process ALL tracks
  
  console.log(`🎯 Processing ALL ${tracksToProcess.length} tracks for full resolution...`);
  
  for (let i = 0; i < tracksToProcess.length; i += batchSize) {
    const batch = tracksToProcess.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tracksToProcess.length / batchSize);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches}:`);
    
    for (let j = 0; j < batch.length; j++) {
      const track = batch[j];
      const globalIndex = hghSongs.findIndex(s => s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid);
      
      const resolved = await resolveTrack(track, i + j + 1, tracksToProcess.length);
      
      if (resolved && globalIndex !== -1) {
        // Update the main tracks data
        updatedSongs[globalIndex] = {
          ...updatedSongs[globalIndex],
          title: resolved.title,
          artist: resolved.artist,
          feedTitle: resolved.feedTitle,
          duration: resolved.duration
        };
        
        // Update URL maps
        if (resolved.audioUrl && resolved.title !== 'Unknown Title') {
          audioUrlMap[resolved.title] = resolved.audioUrl;
          console.log(`   📝 Added audio URL for "${resolved.title}"`);
        }
        
        if (resolved.artworkUrl && resolved.title !== 'Unknown Title') {
          artworkUrlMap[resolved.title] = resolved.artworkUrl;
          console.log(`   🖼️ Added artwork URL for "${resolved.title}"`);
        }
        
        resolvedCount++;
      }
      
      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    
    // Longer delay between batches
    if (i + batchSize < tracksToProcess.length) {
      console.log(`⏳ Batch complete. Waiting 3 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Save updated data if we resolved anything
  if (resolvedCount > 0) {
    // Update main tracks file
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    // Update audio URLs
    const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
    
    // Update artwork URLs
    const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
    
    console.log(`\n🏁 FULL Resolution Completed!`);
    console.log(`✅ Successfully resolved ${resolvedCount} additional tracks`);
    console.log(`📊 Final totals: ${Object.keys(audioUrlMap).length} audio, ${Object.keys(artworkUrlMap).length} artwork`);
    console.log(`🎉 HGH Playlist success rate: ${((Object.keys(audioUrlMap).length / 1119) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No additional tracks were resolved in this test batch');
  }
}

main().catch(console.error);