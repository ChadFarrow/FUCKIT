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
    console.log(`🔍 ${index}/${total}: Resolving "${track.title}"`);
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
    
    if (rssResult && rssResult.title !== 'Unknown Title') {
      console.log(`   🎵 RESOLVED: "${rssResult.title}"`);
      console.log(`   🎧 Audio: ${rssResult.audioUrl ? '✅' : '❌'}`);
      console.log(`   🖼️ Artwork: ${rssResult.artworkUrl ? '✅' : '❌'}`);
      
      return {
        title: rssResult.title,
        artist: feedData.feed.title || 'HGH Artist',
        feedTitle: feedData.feed.title || 'Unknown Feed',
        duration: 180, // Default duration
        audioUrl: rssResult.audioUrl,
        artworkUrl: rssResult.artworkUrl || feedData.feed.artwork || feedData.feed.image
      };
    } else {
      console.log(`   ❌ Could not resolve title from RSS`);
      return null;
    }
    
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 FINAL FIX: Resolve HGH Placeholder Track Titles');
  console.log('=' .repeat(60));
  
  // Load current data - FRESH READ each time
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
  
  // Find ALL placeholder tracks
  const placeholderTracks = hghSongs.filter(track => track.title.startsWith('Track '));
  
  console.log(`📊 Analysis:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Placeholder tracks to fix: ${placeholderTracks.length}`);
  console.log(`   Current audio URLs: ${Object.keys(audioUrlMap).length}`);
  console.log(`   Current artwork URLs: ${Object.keys(artworkUrlMap).length}`);
  console.log('');
  
  if (placeholderTracks.length === 0) {
    console.log('✅ No placeholder tracks to fix!');
    return;
  }
  
  let resolvedCount = 0;
  const updatedSongs = [...hghSongs]; // Start with a copy
  
  console.log(`🎯 Resolving ${placeholderTracks.length} placeholder tracks...`);
  console.log('');
  
  for (let i = 0; i < placeholderTracks.length; i++) {
    const track = placeholderTracks[i];
    
    // Find the index in the main array
    const globalIndex = updatedSongs.findIndex(s => 
      s.feedGuid === track.feedGuid && 
      s.itemGuid === track.itemGuid &&
      s.title === track.title
    );
    
    if (globalIndex === -1) {
      console.log(`   ⚠️ Could not find track in main array: ${track.title}`);
      continue;
    }
    
    const resolved = await resolveViaDirect(track, i + 1, placeholderTracks.length);
    
    if (resolved && resolved.title !== 'Unknown Title') {
      // Update the track IN PLACE in the updatedSongs array
      updatedSongs[globalIndex] = {
        ...updatedSongs[globalIndex],
        title: resolved.title,
        artist: resolved.artist,
        feedTitle: resolved.feedTitle,
        duration: resolved.duration
      };
      
      // Also update URL maps if we have URLs
      if (resolved.audioUrl) {
        audioUrlMap[resolved.title] = resolved.audioUrl;
      }
      
      if (resolved.artworkUrl) {
        artworkUrlMap[resolved.title] = resolved.artworkUrl;
      }
      
      console.log(`   ✅ FIXED: "${track.title}" → "${resolved.title}"`);
      resolvedCount++;
    }
    
    console.log(''); // Space between tracks
    
    // Rate limiting
    if (i < placeholderTracks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log('💾 Saving updated data...');
  
  // Save the FULLY updated tracks file
  fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
  console.log('   ✅ Saved updated tracks to hgh-resolved-songs.json');
  
  // Update audio URLs file
  const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
  
  fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
  console.log('   ✅ Saved audio URLs to hgh-audio-urls.ts');
  
  // Update artwork URLs file
  const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
  
  fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
  console.log('   ✅ Saved artwork URLs to hgh-artwork-urls.ts');
  
  // Final stats
  const finalPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
  const finalUnknown = updatedSongs.filter(t => t.title === 'Unknown Feed').length;
  const finalResolved = updatedSongs.length - finalPlaceholders - finalUnknown;
  
  console.log(`\n🏁 FINAL RESOLUTION COMPLETE!`);
  console.log('=' .repeat(60));
  console.log(`✅ Successfully resolved ${resolvedCount}/${placeholderTracks.length} placeholder tracks`);
  console.log(`📊 Final track breakdown:`);
  console.log(`   Total tracks: ${updatedSongs.length}`);
  console.log(`   Resolved tracks: ${finalResolved}`);
  console.log(`   Remaining placeholders: ${finalPlaceholders}`);
  console.log(`   Unknown/corrupted: ${finalUnknown}`);
  console.log(`🎉 Success rate: ${((finalResolved / updatedSongs.length) * 100).toFixed(1)}%`);
  console.log(`📈 Audio URLs available: ${Object.keys(audioUrlMap).length}`);
  console.log(`🖼️ Artwork URLs available: ${Object.keys(artworkUrlMap).length}`);
}

main().catch(console.error);