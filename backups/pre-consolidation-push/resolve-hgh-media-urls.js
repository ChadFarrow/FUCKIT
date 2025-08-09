const fs = require('fs');
const crypto = require('crypto');

// API credentials
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

// Create SHA1 hash for API authentication
function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

// Get audio and artwork URLs for a track using Podcast Index API
async function getMediaUrls(track, index, total) {
  try {
    // Skip if it's a placeholder track
    if (track.title.startsWith('Track ')) {
      console.log(`⏭️ ${index}/${total}: Skipping placeholder track ${track.title}`);
      return { audioUrl: null, artworkUrl: null };
    }

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
      console.log(`⚠️ ${index}/${total}: Failed to get feed for "${track.title}" - HTTP ${feedResponse.status}`);
      return { audioUrl: null, artworkUrl: null };
    }

    const feedData = await feedResponse.json();
    
    if (!feedData.feed) {
      console.log(`❌ ${index}/${total}: No feed found for "${track.title}"`);
      return { audioUrl: null, artworkUrl: null };
    }

    // Get the feed's artwork as fallback
    const feedArtwork = feedData.feed.artwork || feedData.feed.image || null;
    
    // Now get episodes from this feed to find our specific episode
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedData.feed.id}&max=100&pretty`;
    
    const authDate2 = Math.floor(Date.now() / 1000);
    const hash2 = createAuthHash(apiKey, apiSecret, authDate2);
    
    const episodeResponse = await fetch(episodesUrl, {
      headers: {
        'X-Auth-Date': authDate2.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash2,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (episodeResponse.ok) {
      const episodeData = await episodeResponse.json();
      
      if (episodeData.items && episodeData.items.length > 0) {
        // Look for our specific episode by itemGuid or title match
        let episode = episodeData.items.find(ep => ep.guid === track.itemGuid);
        
        // If not found by GUID, try to match by title
        if (!episode) {
          episode = episodeData.items.find(ep => 
            ep.title === track.title || 
            ep.title?.toLowerCase() === track.title?.toLowerCase()
          );
        }
        
        if (episode) {
          const audioUrl = episode.enclosureUrl || null;
          const artworkUrl = episode.image || episode.feedImage || feedArtwork;
          
          if (audioUrl || artworkUrl) {
            console.log(`🎵 ${index}/${total}: Found media for "${track.title}"`);
            console.log(`   Audio: ${audioUrl ? '✅' : '❌'} | Artwork: ${artworkUrl ? '✅' : '❌'}`);
          }
          
          return { audioUrl, artworkUrl };
        }
      }
    }
    
    // If we couldn't find the specific episode, at least return feed artwork
    console.log(`📝 ${index}/${total}: Using feed artwork for "${track.title}"`);
    return { audioUrl: null, artworkUrl: feedArtwork };
    
  } catch (error) {
    console.log(`⚠️ ${index}/${total}: Error getting media for "${track.title}" - ${error.message}`);
    return { audioUrl: null, artworkUrl: null };
  }
}

async function main() {
  console.log('🎯 HGH Media URL Resolution Script');
  console.log('=' .repeat(50));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Load existing URL maps
  let audioUrlMap = {};
  let artworkUrlMap = {};
  
  try {
    // Import existing maps (if any)
    const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
    const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    if (audioMatch) {
      // Parse the existing entries
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
    console.log('Starting with empty URL maps');
  }
  
  console.log(`📊 Current Status:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Existing audio URLs: ${Object.keys(audioUrlMap).length}`);
  console.log(`   Existing artwork URLs: ${Object.keys(artworkUrlMap).length}`);
  console.log('');
  
  // Process tracks that don't have URLs yet
  const tracksNeedingUrls = hghSongs.filter(track => 
    !track.title.startsWith('Track ') && 
    (!audioUrlMap[track.title] || !artworkUrlMap[track.title])
  );
  
  console.log(`🔍 Tracks needing media URLs: ${tracksNeedingUrls.length}`);
  
  if (tracksNeedingUrls.length === 0) {
    console.log('✅ All tracks already have media URLs!');
    return;
  }
  
  // Process in batches
  const batchSize = 5;
  let newAudioCount = 0;
  let newArtworkCount = 0;
  
  for (let i = 0; i < tracksNeedingUrls.length; i += batchSize) {
    const batch = tracksNeedingUrls.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tracksNeedingUrls.length / batchSize);
    
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches}...`);
    
    for (let j = 0; j < batch.length; j++) {
      const track = batch[j];
      const globalIndex = i + j + 1;
      
      const { audioUrl, artworkUrl } = await getMediaUrls(track, globalIndex, tracksNeedingUrls.length);
      
      if (audioUrl && !audioUrlMap[track.title]) {
        audioUrlMap[track.title] = audioUrl;
        newAudioCount++;
      }
      
      if (artworkUrl && !artworkUrlMap[track.title]) {
        artworkUrlMap[track.title] = artworkUrl;
        newArtworkCount++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Save progress after each batch
    // Write audio URLs
    const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
    
    // Write artwork URLs
    const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Podcast Index API
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
    
    console.log(`✅ Batch ${batchNum} completed. New: ${newAudioCount} audio, ${newArtworkCount} artwork`);
    
    // Longer delay between batches
    if (i + batchSize < tracksNeedingUrls.length) {
      console.log(`⏳ Waiting 3 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n🏁 Media URL resolution completed!');
  console.log(`✅ Added ${newAudioCount} new audio URLs`);
  console.log(`✅ Added ${newArtworkCount} new artwork URLs`);
  console.log(`📊 Final totals: ${Object.keys(audioUrlMap).length} audio, ${Object.keys(artworkUrlMap).length} artwork`);
  
  // Clean up temp files
  ['resolve-hgh-feeds.js', 'reparse-hgh-feed.js'].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
}

main().catch(console.error);