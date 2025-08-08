#!/usr/bin/env node
// Resolve remaining Lightning Thrashes tracks with feedGuid values

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
    
    console.log('✅ Loaded .env.local');
  } catch (error) {
    console.log('⚠️ Could not load .env.local:', error.message);
  }
}

// Load environment variables
loadEnvLocal();

// V4V resolver
async function resolveTrack(feedGuid, itemGuid) {
  try {
    const apiKey = process.env.PODCAST_INDEX_API_KEY;
    const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return null;
    }

    const crypto = require('crypto');
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1');
    hash.update(apiKey + apiSecret + apiHeaderTime);
    const hashString = hash.digest('hex');

    const headers = {
      'X-Auth-Key': apiKey,
      'X-Auth-Date': apiHeaderTime.toString(),
      'Authorization': hashString,
      'User-Agent': 're.podtards.com'
    };

    // Look up the feed by GUID
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    const feedResponse = await fetch(feedUrl, { headers });
    const feedData = await feedResponse.json();
    
    if (feedData.status !== 'true' || !feedData.feed || !feedData.feed.url) {
      return null;
    }
    
    // Fetch the RSS feed
    const rssResponse = await fetch(feedData.feed.url);
    if (!rssResponse.ok) {
      return null;
    }
    
    const rssXml = await rssResponse.text();
    
    // Find the item with matching GUID
    const itemMatch = rssXml.match(new RegExp(`<item>([\\s\\S]*?${itemGuid}[\\s\\S]*?)</item>`, 'i'));
    
    if (!itemMatch) {
      return null;
    }

    const itemXml = itemMatch[1];
    
    // Extract track information
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title>(.*?)<\/title>/i);
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"/i);
    const durationMatch = itemXml.match(/<itunes:duration>(\d+)<\/itunes:duration>/i);
    const imageMatch = itemXml.match(/<itunes:image[^>]+href="([^"]+)"/i);
    const authorMatch = itemXml.match(/<author>(.*?)<\/author>/i) || itemXml.match(/<itunes:author>(.*?)<\/itunes:author>/i);
    
    // Get feed-level info for fallbacks
    const feedImageMatch = rssXml.match(/<itunes:image[^>]+href="([^"]+)"/i);
    
    if (!titleMatch) {
      return null;
    }

    return {
      title: titleMatch[1],
      artist: authorMatch ? authorMatch[1] : feedData.feed.author || feedData.feed.title,
      audioUrl: enclosureMatch ? enclosureMatch[1] : '',
      duration: durationMatch ? parseInt(durationMatch[1]) : 300,
      image: imageMatch ? imageMatch[1] : feedImageMatch ? feedImageMatch[1] : feedData.feed.image,
      feedTitle: feedData.feed.title
    };

  } catch (error) {
    console.error(`❌ Error resolving ${feedGuid}/${itemGuid}:`, error.message);
    return null;
  }
}

async function updateRemainingTracks() {
  console.log('🔄 Resolving remaining Lightning Thrashes tracks...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks: ${musicTracksData.length}`);
    
    // Find Lightning Thrashes tracks that need resolution
    const unresolvedTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') && 
      track.valueForValue?.resolved === false &&
      track.valueForValue?.feedGuid &&
      track.valueForValue?.itemGuid &&
      track.duration === 300
    );
    
    console.log(`📊 Found ${unresolvedTracks.length} unresolved Lightning Thrashes tracks with feedGuid`);
    
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process tracks in small batches
    for (let i = 0; i < unresolvedTracks.length; i += 3) {
      const batch = unresolvedTracks.slice(i, i + 3);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/3) + 1}/${Math.ceil(unresolvedTracks.length/3)}`);
      
      const batchPromises = batch.map(async (track) => {
        const feedGuid = track.valueForValue.feedGuid;
        const itemGuid = track.valueForValue.itemGuid;
        
        console.log(`🔍 Resolving: ${track.title} (${feedGuid})`);
        
        const resolved = await resolveTrack(feedGuid, itemGuid);
        
        if (resolved) {
          // Update the track in the data
          const trackIndex = musicTracksData.findIndex(t => t.id === track.id);
          if (trackIndex !== -1) {
            musicTracksData[trackIndex] = {
              ...musicTracksData[trackIndex],
              title: resolved.title,
              artist: resolved.artist,
              duration: resolved.duration,
              audioUrl: resolved.audioUrl,
              image: resolved.image,
              valueForValue: {
                ...musicTracksData[trackIndex].valueForValue,
                resolved: true,
                resolvedTitle: resolved.title,
                resolvedArtist: resolved.artist,
                resolvedImage: resolved.image,
                resolvedAudioUrl: resolved.audioUrl,
                lastResolved: new Date().toISOString()
              }
            };
            
            resolvedCount++;
            console.log(`✅ Updated: "${resolved.title}" by "${resolved.artist}" (${resolved.duration}s)`);
          }
        } else {
          failedCount++;
          console.log(`❌ Failed to resolve: ${track.title}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait between batches
      if (i + 3 < unresolvedTracks.length) {
        console.log('⏳ Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Write the updated data back to the file
    try {
      const updatedData = {
        musicTracks: musicTracksData
      };
      fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
      console.log('✅ Saved updated music-tracks.json');
    } catch (error) {
      console.error('❌ Failed to write music-tracks.json:', error.message);
      return;
    }
    
    console.log(`\n🎯 Resolution complete!`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    
  } catch (error) {
    console.error('❌ Error updating tracks:', error);
  }
}

// Run the resolution
updateRemainingTracks().catch(console.error);