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

// Direct episode lookup by GUID
async function getEpisodeByGuid(feedGuid, itemGuid, index, total) {
  try {
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    // Try direct episode lookup by GUID first
    const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${itemGuid}&pretty`;
    
    const episodeResponse = await fetch(episodeUrl, {
      headers: {
        'X-Auth-Date': authDate.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (episodeResponse.ok) {
      const episodeData = await episodeResponse.json();
      
      if (episodeData.episode) {
        const episode = episodeData.episode;
        console.log(`✅ ${index}/${total}: Direct lookup found "${episode.title}"`);
        
        return {
          title: episode.title || 'Unknown Title',
          artist: episode.feedTitle || 'Unknown Artist',
          feedTitle: episode.feedTitle || 'Unknown Feed',
          duration: episode.duration || 180,
          audioUrl: episode.enclosureUrl || null,
          artworkUrl: episode.image || episode.feedImage || null
        };
      }
    }

    // If direct lookup fails, try feed-based lookup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const authDate2 = Math.floor(Date.now() / 1000);
    const hash2 = createAuthHash(apiKey, apiSecret, authDate2);
    
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}&pretty`;
    
    const feedResponse = await fetch(feedUrl, {
      headers: {
        'X-Auth-Date': authDate2.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash2,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (!feedResponse.ok) {
      console.log(`⚠️ ${index}/${total}: Failed to get feed - HTTP ${feedResponse.status}`);
      return null;
    }

    const feedData = await feedResponse.json();
    
    if (!feedData.feed) {
      console.log(`❌ ${index}/${total}: No feed found`);
      return null;
    }

    // Get episodes and look for our item
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const authDate3 = Math.floor(Date.now() / 1000);
    const hash3 = createAuthHash(apiKey, apiSecret, authDate3);
    
    const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedData.feed.id}&max=200&pretty`;
    
    const episodesResponse = await fetch(episodesUrl, {
      headers: {
        'X-Auth-Date': authDate3.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash3,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (episodesResponse.ok) {
      const episodesData = await episodesResponse.json();
      
      if (episodesData.items && episodesData.items.length > 0) {
        // Look for our specific episode by itemGuid
        let episode = episodesData.items.find(ep => ep.guid === itemGuid);
        
        if (episode) {
          console.log(`🎵 ${index}/${total}: Feed lookup found "${episode.title}"`);
          
          return {
            title: episode.title || 'Unknown Title',
            artist: episode.feedTitle || feedData.feed.title || 'Unknown Artist',
            feedTitle: episode.feedTitle || feedData.feed.title || 'Unknown Feed',
            duration: episode.duration || 180,
            audioUrl: episode.enclosureUrl || null,
            artworkUrl: episode.image || episode.feedImage || feedData.feed.artwork || feedData.feed.image || null
          };
        }
      }
    }
    
    console.log(`❌ ${index}/${total}: Could not resolve episode`);
    return null;
    
  } catch (error) {
    console.log(`⚠️ ${index}/${total}: Error - ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 Resolving Remaining HGH Tracks');
  console.log('=' .repeat(50));
  
  // Load existing data
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
  
  // Find tracks that need resolution (Unknown Feed or missing audio URLs)
  const tracksNeedingResolution = hghSongs.filter(track => 
    track.title === 'Unknown Feed' || 
    track.feedTitle === 'Unknown Feed' ||
    (!track.title.startsWith('Track ') && !audioUrlMap[track.title])
  );
  
  console.log(`🔍 Found ${tracksNeedingResolution.length} tracks needing resolution`);
  
  if (tracksNeedingResolution.length === 0) {
    console.log('✅ All tracks are already resolved!');
    return;
  }
  
  let resolvedCount = 0;
  let updatedSongs = [...hghSongs];
  
  for (let i = 0; i < tracksNeedingResolution.length; i++) {
    const track = tracksNeedingResolution[i];
    const globalIndex = hghSongs.findIndex(s => s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid);
    
    console.log(`\n🔍 Processing track ${i+1}/${tracksNeedingResolution.length}`);
    console.log(`   Current: "${track.title}" (Feed: ${track.feedGuid})`);
    
    const resolved = await getEpisodeByGuid(track.feedGuid, track.itemGuid, i+1, tracksNeedingResolution.length);
    
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
      }
      
      if (resolved.artworkUrl && resolved.title !== 'Unknown Title') {
        artworkUrlMap[resolved.title] = resolved.artworkUrl;
      }
      
      resolvedCount++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save updated data
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
    
    console.log(`\n🏁 Resolution completed!`);
    console.log(`✅ Successfully resolved ${resolvedCount} additional tracks`);
    console.log(`📊 New totals: ${Object.keys(audioUrlMap).length} audio, ${Object.keys(artworkUrlMap).length} artwork`);
  } else {
    console.log('\n❌ No additional tracks were resolved');
  }
}

main().catch(console.error);