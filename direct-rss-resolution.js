const fs = require('fs');
const crypto = require('crypto');

// API credentials for getting feed URLs
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

// Parse RSS feed directly to find episodes
async function parseRSSFeed(feedUrl, itemGuid) {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      return null;
    }
    
    const xml = await response.text();
    
    // Simple XML parsing to find the episode with matching GUID
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = xml.match(itemRegex) || [];
    
    for (const item of items) {
      // Check if this item has the matching GUID
      const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
      const guid = guidMatch ? guidMatch[1].trim() : null;
      
      if (guid === itemGuid) {
        // Extract episode details
        const titleMatch = item.match(/<title>([^<]*)<\/title>/);
        const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
        const imageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*>/) || 
                           item.match(/<image[^>]*url="([^"]*)"[^>]*>/);
        
        return {
          title: titleMatch ? titleMatch[1].trim() : 'Unknown Title',
          audioUrl: enclosureMatch ? enclosureMatch[1] : null,
          artworkUrl: imageMatch ? imageMatch[1] : null
        };
      }
    }
    
    return null;
  } catch (error) {
    console.log(`   ⚠️ RSS parsing error: ${error.message}`);
    return null;
  }
}

async function resolveViaDirect(track, index, total) {
  try {
    console.log(`🔍 ${index}/${total}: Direct RSS resolution for "${track.title}"`);
    console.log(`   Feed GUID: ${track.feedGuid}`);
    console.log(`   Item GUID: ${track.itemGuid}`);
    
    // First get feed URL from Podcast Index
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
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
    
    if (!feedData.feed || !feedData.feed.url) {
      console.log(`   ❌ No feed URL available`);
      return null;
    }

    console.log(`   ✅ Found RSS feed: ${feedData.feed.url}`);
    console.log(`   📡 Parsing RSS directly...`);

    // Parse the RSS feed directly
    const rssResult = await parseRSSFeed(feedData.feed.url, track.itemGuid);
    
    if (rssResult) {
      console.log(`   🎵 FOUND VIA RSS: "${rssResult.title}"`);
      console.log(`   🎧 Audio: ${rssResult.audioUrl ? '✅' : '❌'}`);
      console.log(`   🖼️ Artwork: ${rssResult.artworkUrl ? '✅' : '❌'}`);
      
      return {
        title: rssResult.title,
        artist: feedData.feed.title || 'Unknown Artist',
        feedTitle: feedData.feed.title || 'Unknown Feed',
        duration: 180, // Default duration
        audioUrl: rssResult.audioUrl,
        artworkUrl: rssResult.artworkUrl || feedData.feed.artwork || feedData.feed.image
      };
    } else {
      console.log(`   ❌ Episode not found in RSS feed`);
      return null;
    }
    
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Direct RSS Resolution for HGH Placeholder Tracks');
  console.log('=' .repeat(60));
  
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
  
  // Focus on placeholder tracks only
  const placeholderTracks = hghSongs.filter(track => track.title.startsWith('Track '));
  
  console.log(`📊 Analysis:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Current audio URLs: ${Object.keys(audioUrlMap).length}`);
  console.log(`   Placeholder tracks to resolve: ${placeholderTracks.length}`);
  console.log('');
  
  if (placeholderTracks.length === 0) {
    console.log('✅ No placeholder tracks to resolve!');
    return;
  }
  
  let resolvedCount = 0;
  let updatedSongs = [...hghSongs];
  
  // Process ALL placeholder tracks to achieve 100% success like ITDV
  const maxTracks = placeholderTracks.length;
  const tracksToProcess = placeholderTracks;
  
  console.log(`🎯 Running full direct RSS resolution on ${tracksToProcess.length} placeholder tracks...`);
  
  for (let i = 0; i < tracksToProcess.length; i++) {
    const track = tracksToProcess[i];
    const globalIndex = hghSongs.findIndex(s => s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid);
    
    const resolved = await resolveViaDirect(track, i + 1, tracksToProcess.length);
    
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
    
    console.log(''); // Space between tracks
    
    // Faster rate limiting - RSS parsing is less rate-limited than API calls
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // Save updated data if we resolved anything
  if (resolvedCount > 0) {
    // Update main tracks file
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    // Update audio URLs
    const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
    
    // Update artwork URLs
    const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
    
    console.log(`\n🏁 Direct RSS Resolution Test Complete!`);
    console.log(`✅ Successfully resolved ${resolvedCount}/${tracksToProcess.length} placeholder tracks`);
    console.log(`📊 New totals: ${Object.keys(audioUrlMap).length} audio, ${Object.keys(artworkUrlMap).length} artwork`);
    console.log(`🎉 Success rate: ${((resolvedCount / tracksToProcess.length) * 100).toFixed(1)}%`);
    
    if (resolvedCount > 0) {
      console.log(`\n💡 Direct RSS parsing is working! Run with higher maxTracks to resolve all ${placeholderTracks.length} placeholders.`);
    }
  } else {
    console.log('\n❌ No tracks were resolved via direct RSS parsing');
  }
}

main().catch(console.error);