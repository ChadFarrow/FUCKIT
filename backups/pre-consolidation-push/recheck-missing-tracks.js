const fs = require('fs');
const crypto = require('crypto');

// API credentials
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

// Load data
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');

// Extract existing audio URLs
const audioTitles = new Set();
const audioMatch = audioModule.match(/"([^"]+)":\s*"[^"]+"/g);
if (audioMatch) {
  audioMatch.forEach(entry => {
    const [, title] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
    audioTitles.add(title);
  });
}

// Get the tracks I identified as "missing"
const missingTracks = hghSongs.filter(track => 
  !track.title.startsWith('Track ') && 
  !audioTitles.has(track.title)
);

console.log('🔧 Rechecking "Missing" Tracks with Fresh API Calls');
console.log('=' .repeat(60));

async function recheckTrack(track, index) {
  try {
    console.log(`\n${index + 1}/${missingTracks.length}: Checking "${track.title}"`);
    console.log(`   Feed GUID: ${track.feedGuid}`);
    
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${track.feedGuid}&pretty`;
    
    const response = await fetch(feedUrl, {
      headers: {
        'X-Auth-Date': authDate.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.feed) {
        console.log(`   ✅ FEED EXISTS: "${data.feed.title}"`);
        console.log(`   📊 Episodes: ${data.feed.episodeCount}`);
        console.log(`   🔗 URL: ${data.feed.url}`);
        
        // Now try to get episodes to find the specific track
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const authDate2 = Math.floor(Date.now() / 1000);
        const hash2 = createAuthHash(apiKey, apiSecret, authDate2);
        
        const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${data.feed.id}&max=100&pretty`;
        
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
            const episode = episodeData.items.find(ep => ep.guid === track.itemGuid);
            
            if (episode) {
              console.log(`   🎵 EPISODE FOUND: "${episode.title}"`);
              console.log(`   🎧 Audio: ${episode.enclosureUrl ? '✅' : '❌'}`);
              console.log(`   🖼️ Artwork: ${episode.image ? '✅' : '❌'}`);
              
              return {
                feedExists: true,
                episodeExists: true,
                title: episode.title,
                audioUrl: episode.enclosureUrl,
                artworkUrl: episode.image || episode.feedImage || data.feed.artwork
              };
            } else {
              console.log(`   ❌ Episode with GUID ${track.itemGuid} not found in feed`);
            }
          } else {
            console.log(`   ❌ No episodes found in feed`);
          }
        } else {
          console.log(`   ⚠️ Failed to get episodes: HTTP ${episodeResponse.status}`);
        }
        
        return {
          feedExists: true,
          episodeExists: false,
          feedTitle: data.feed.title
        };
      } else {
        console.log(`   ❌ No feed data returned`);
      }
    } else {
      console.log(`   ❌ Feed not found: HTTP ${response.status}`);
    }
    
    return { feedExists: false, episodeExists: false };
    
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return { feedExists: false, episodeExists: false };
  }
}

async function main() {
  console.log(`📊 Found ${missingTracks.length} tracks to recheck`);
  
  let feedsExist = 0;
  let episodesExist = 0;
  let totallyMissing = 0;
  
  // Check first 10 tracks to avoid rate limits
  const tracksToCheck = missingTracks.slice(0, 10);
  
  for (let i = 0; i < tracksToCheck.length; i++) {
    const result = await recheckTrack(tracksToCheck[i], i);
    
    if (result.feedExists && result.episodeExists) {
      episodesExist++;
      feedsExist++;
    } else if (result.feedExists) {
      feedsExist++;
    } else {
      totallyMissing++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Recheck Summary:');
  console.log(`   Feeds that exist: ${feedsExist}/${tracksToCheck.length}`);
  console.log(`   Episodes that exist: ${episodesExist}/${tracksToCheck.length}`);
  console.log(`   Completely missing: ${totallyMissing}/${tracksToCheck.length}`);
  
  if (episodesExist > 0) {
    console.log('\n🎯 IMPORTANT: Some "missing" tracks actually exist!');
    console.log('   This suggests my resolution script has bugs that need fixing.');
  }
}

main().catch(console.error);