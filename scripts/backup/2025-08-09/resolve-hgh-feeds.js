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

// Look up feed by GUID and then find episode
async function resolveFeedAndEpisode(track, index, total) {
  try {
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    // First, get the feed info
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
      console.log(`⚠️ ${index}/${total}: Feed lookup failed for ${track.feedGuid.substring(0, 8)} - HTTP ${feedResponse.status}`);
      return track;
    }

    const feedData = await feedResponse.json();
    
    if (!feedData.feed) {
      console.log(`❌ ${index}/${total}: No feed found for ${track.feedGuid.substring(0, 8)}`);
      return track;
    }

    // Get feed title
    const feedTitle = feedData.feed.title || 'Unknown Feed';
    console.log(`🔍 ${index}/${total}: Found feed "${feedTitle}"`);
    
    // Now try to get episodes from this feed and find our specific episode
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
    
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
        // Look for our specific episode by itemGuid
        const episode = episodeData.items.find(ep => ep.guid === track.itemGuid);
        
        if (episode) {
          const resolvedTrack = {
            ...track,
            title: episode.title || feedTitle,
            artist: episode.author || feedTitle,
            feedTitle: feedTitle,
            duration: episode.duration || track.duration
          };
          
          console.log(`🎵 ${index}/${total}: Resolved "${episode.title}" from "${feedTitle}"`);
          return resolvedTrack;
        } else {
          // Use first episode as fallback or just use feed info
          const fallbackTrack = {
            ...track,
            title: episodeData.items[0]?.title || feedTitle,
            artist: episodeData.items[0]?.author || feedTitle,
            feedTitle: feedTitle,
            duration: episodeData.items[0]?.duration || track.duration
          };
          
          console.log(`📝 ${index}/${total}: Used fallback "${fallbackTrack.title}" from "${feedTitle}"`);
          return fallbackTrack;
        }
      }
    }
    
    // If episodes didn't work, at least use the feed title
    const feedOnlyTrack = {
      ...track,
      title: feedTitle,
      artist: feedTitle,
      feedTitle: feedTitle
    };
    
    console.log(`📝 ${index}/${total}: Used feed title "${feedTitle}"`);
    return feedOnlyTrack;
    
  } catch (error) {
    console.log(`⚠️ ${index}/${total}: Error resolving ${track.feedGuid.substring(0, 8)} - ${error.message}`);
    return track;
  }
}

async function main() {
  console.log('🎯 HGH Feed Resolution Script');
  console.log('=' .repeat(50));
  
  // Load current data
  let hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find tracks that still need resolution (have placeholder titles)
  const needResolution = hghSongs.filter(song => song.title.startsWith('Track '));
  
  console.log(`📊 Status:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Need resolution: ${needResolution.length}`);
  console.log('');
  
  if (needResolution.length === 0) {
    console.log('✅ All tracks already resolved!');
    return;
  }
  
  // Process tracks in smaller batches to respect API limits
  const batchSize = 10;
  let resolved = 0;
  
  for (let i = 0; i < needResolution.length; i += batchSize) {
    const batch = needResolution.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(needResolution.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches}...`);
    
    for (let j = 0; j < batch.length; j++) {
      const track = batch[j];
      const globalIndex = i + j + 1;
      
      const resolved_track = await resolveFeedAndEpisode(track, globalIndex, needResolution.length);
      
      // Update the track in the main array
      const originalIndex = hghSongs.findIndex(s => s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid);
      if (originalIndex !== -1) {
        hghSongs[originalIndex] = resolved_track;
        if (resolved_track.title !== track.title) {
          resolved++;
        }
      }
      
      // Small delay between individual requests
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Save progress after each batch
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(hghSongs, null, 2));
    
    console.log(`✅ Batch ${batchNum} completed. ${resolved} tracks resolved so far.`);
    
    // Longer delay between batches
    if (i + batchSize < needResolution.length) {
      console.log(`⏳ Waiting 3 seconds before next batch...\\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\\n🏁 Resolution completed!');
  console.log(`✅ Successfully resolved ${resolved} tracks`);
  
  // Clean up temp files
  ['resolve-all-hgh-tracks.js', 'check-hgh-status.js'].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
}

main().catch(console.error);