const fs = require('fs');
const crypto = require('crypto');

// Known GUID corrections based on investigation
const GUID_CORRECTIONS = {
  // HGH #1 - ableandthewolf.com feed (already working)
  'a0e2112b-1972-4ae2-84b5-c70df89bd909': {
    correctFeedGuid: 'acddbb03-064b-5098-87ca-9b146beb12e8',
    feedUrl: 'https://ableandthewolf.com/static/media/feed.xml',
    itemMappings: {
      '1ae5633e-44c4-458b-b338-5f3578d035fe': 'c7003607-233e-40e8-b2fa-6465127d0076'
    }
  },
  // Working feeds found via investigation - these have correct GUIDs but failed resolution
  'fc815bcf-3639-5395-ba7d-fa217ec93d32': {
    correctFeedGuid: 'fc815bcf-3639-5395-ba7d-fa217ec93d32',
    feedUrl: 'https://music.behindthesch3m3s.com/wp-content/uploads/Delta_OG/Aged_Friends_and_Old_Whiskey/aged_friends_old_whiskey.xml',
    itemMappings: {} // Auto-resolve from feed
  },
  'c989830b-49a1-572f-9f0e-0fec994a6d5a': {
    correctFeedGuid: 'c989830b-49a1-572f-9f0e-0fec994a6d5a',
    feedUrl: 'https://static.staticsave.com/mspfiles/waytogo.xml',
    itemMappings: {} // Auto-resolve from feed
  },
  '8b41f7f4-2cc3-5a03-90f5-6c54e92bc96b': {
    correctFeedGuid: '8b41f7f4-2cc3-5a03-90f5-6c54e92bc96b',
    feedUrl: 'https://music.behindthesch3m3s.com/wp-content/uploads/OVVRDOS/ovvr_not_under.xml',
    itemMappings: {} // Auto-resolve from feed
  },
  '8b4358f8-1c21-5977-8674-d21113719ccf': {
    correctFeedGuid: '8b4358f8-1c21-5977-8674-d21113719ccf',
    feedUrl: 'https://thebearsnare.com/67thunbeat2.xml',
    itemMappings: {} // Auto-resolve from feed
  }
};

// API credentials
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

async function searchForDaneRayColeman() {
  console.log('🔍 Searching for Dane Ray Coleman feeds...');
  
  try {
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=Dane%20Ray%20Coleman&pretty`;
    const response = await fetch(searchUrl, {
      headers: {
        'X-Auth-Date': authDate.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   Found ${data.feeds?.length || 0} feeds for Dane Ray Coleman:`);
      
      if (data.feeds && data.feeds.length > 0) {
        data.feeds.forEach((feed, index) => {
          console.log(`   ${index + 1}. "${feed.title}"`);
          console.log(`      GUID: ${feed.podcastGuid}`);
          console.log(`      URL: ${feed.url}`);
          console.log(`      Description: ${feed.description?.substring(0, 100)}...`);
          console.log('');
        });
        return data.feeds;
      }
    }
  } catch (error) {
    console.log(`   ❌ Search error: ${error.message}`);
  }
  return [];
}

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

async function expandedGuidFix() {
  console.log('🔧 Expanded GUID Fix - Resolving More Tracks');
  console.log('=' .repeat(60));
  
  // First search for Dane Ray Coleman
  const daneFeeds = await searchForDaneRayColeman();
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find all unresolved tracks
  const unresolved = hghSongs.filter(track => 
    track.title.startsWith('Track ') || track.title === 'Unknown Feed'
  );
  
  console.log(`\n📊 Found ${unresolved.length} unresolved tracks`);
  
  // Check if any unresolved tracks might be Dane Ray Coleman
  const possibleDaneTracks = unresolved.filter(track => 
    track.feedGuid === '5a95f9d8-35e3-51f5-a269-ba1df36b4bd8' // HGH #3 problem feed
  );
  
  if (possibleDaneTracks.length > 0 && daneFeeds.length > 0) {
    console.log(`\n🎯 Found ${possibleDaneTracks.length} tracks that might be Dane Ray Coleman`);
    
    // Add Dane's feeds to corrections
    daneFeeds.forEach(feed => {
      GUID_CORRECTIONS['5a95f9d8-35e3-51f5-a269-ba1df36b4bd8'] = {
        correctFeedGuid: feed.podcastGuid,
        feedUrl: feed.url,
        itemMappings: {} // Auto-resolve from feed
      };
    });
  }
  
  let fixedCount = 0;
  const updatedSongs = [...hghSongs];
  
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
  
  for (const correction of Object.entries(GUID_CORRECTIONS)) {
    const [oldFeedGuid, correctionData] = correction;
    
    console.log(`\n🎯 Processing feed GUID: ${oldFeedGuid}`);
    console.log(`   Feed URL: ${correctionData.feedUrl}`);
    
    // Find tracks with this feed GUID
    const tracksToFix = unresolved.filter(track => track.feedGuid === oldFeedGuid);
    console.log(`   Found ${tracksToFix.length} tracks to fix`);
    
    if (tracksToFix.length === 0) continue;
    
    // Fetch the correct feed to get actual track data
    console.log(`   📡 Fetching feed...`);
    
    try {
      const response = await fetch(correctionData.feedUrl);
      if (!response.ok) {
        console.log(`   ❌ Failed to fetch feed: HTTP ${response.status}`);
        continue;
      }
      
      const xml = await response.text();
      const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
      const items = xml.match(itemRegex) || [];
      
      console.log(`   ✅ Feed loaded, found ${items.length} items`);
      
      // Get feed title
      const feedTitleMatch = xml.match(/<title>([^<]*)<\/title>/);
      const feedTitle = feedTitleMatch ? feedTitleMatch[1].trim() : 'Unknown Feed';
      
      // Fix each track
      for (const track of tracksToFix) {
        const globalIndex = updatedSongs.findIndex(s => 
          s.feedGuid === track.feedGuid && 
          s.itemGuid === track.itemGuid &&
          s.title === track.title
        );
        
        if (globalIndex === -1) continue;
        
        // Update the feed GUID if needed
        updatedSongs[globalIndex].feedGuid = correctionData.correctFeedGuid;
        
        // Check if we need to map the item GUID
        const oldItemGuid = track.itemGuid;
        const newItemGuid = correctionData.itemMappings[oldItemGuid] || oldItemGuid;
        
        if (newItemGuid !== oldItemGuid) {
          updatedSongs[globalIndex].itemGuid = newItemGuid;
          console.log(`   🔄 Mapped item GUID: ${oldItemGuid.substring(0, 8)}... → ${newItemGuid.substring(0, 8)}...`);
        }
        
        // Try to resolve the track with the corrected GUIDs
        const rssResult = await parseRSSFeed(correctionData.feedUrl, newItemGuid);
        
        if (rssResult && rssResult.title !== 'Unknown Title') {
          // Update the track with resolved data
          updatedSongs[globalIndex].title = rssResult.title;
          updatedSongs[globalIndex].artist = feedTitle.includes(' - ') ? feedTitle.split(' - ')[0] : feedTitle;
          updatedSongs[globalIndex].feedTitle = feedTitle;
          
          console.log(`   ✅ FIXED: "${track.title}" → "${rssResult.title}"`);
          console.log(`      Feed: ${feedTitle}`);
          console.log(`      Audio: ${rssResult.audioUrl ? '✅' : '❌'}`);
          console.log(`      Artwork: ${rssResult.artworkUrl ? '✅' : '❌'}`);
          
          // Update URL maps
          if (rssResult.audioUrl) {
            audioUrlMap[rssResult.title] = rssResult.audioUrl;
          }
          
          if (rssResult.artworkUrl) {
            artworkUrlMap[rssResult.title] = rssResult.artworkUrl;
          }
          
          fixedCount++;
        } else {
          console.log(`   ❌ Could not resolve: ${track.title}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing feed: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated data...');
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
    
    console.log(`\n🎉 Expanded GUID Fix Complete!`);
    console.log(`✅ Fixed ${fixedCount} additional tracks`);
    
    // Show updated stats
    const finalPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
    const finalUnknown = updatedSongs.filter(t => t.title === 'Unknown Feed').length;
    const finalResolved = updatedSongs.length - finalPlaceholders - finalUnknown;
    
    console.log(`📊 New statistics:`);
    console.log(`   Total tracks: ${updatedSongs.length}`);
    console.log(`   Resolved tracks: ${finalResolved}`);
    console.log(`   Remaining placeholders: ${finalPlaceholders}`);
    console.log(`   Unknown/corrupted: ${finalUnknown}`);
    console.log(`   Success rate: ${((finalResolved / updatedSongs.length) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No additional tracks were fixed');
  }
}

expandedGuidFix().catch(console.error);