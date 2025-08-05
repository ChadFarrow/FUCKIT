#!/usr/bin/env node
// Update Lightning Thrashes tracks directly in the data file

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

// V4V resolver for Lightning Thrashes
async function resolveLightningThrashesTrack(feedGuid, itemGuid) {
  try {
    console.log(`🔍 Resolving feedGuid: ${feedGuid}, itemGuid: ${itemGuid}`);
    
    // Use the Podcast Index API to look up the feed
    const apiKey = process.env.PODCAST_INDEX_API_KEY;
    const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.error('❌ PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET not set');
      return null;
    }

    // Create authorization header
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
      console.log(`❌ Feed not found for GUID ${feedGuid}`);
      return null;
    }

    console.log(`✅ Found feed: ${feedData.feed.title} by ${feedData.feed.author}`);
    
    // Fetch the RSS feed
    const rssResponse = await fetch(feedData.feed.url);
    if (!rssResponse.ok) {
      console.log(`❌ Failed to fetch RSS feed: ${feedData.feed.url}`);
      return null;
    }
    
    const rssXml = await rssResponse.text();
    
    // Find the item with matching GUID
    const itemMatch = rssXml.match(new RegExp(`<item>([\\s\\S]*?${itemGuid}[\\s\\S]*?)</item>`, 'i'));
    
    if (!itemMatch) {
      console.log(`❌ Item with GUID ${itemGuid} not found in feed`);
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
      console.log(`❌ Could not extract track title for ${itemGuid}`);
      return null;
    }

    const resolvedTrack = {
      title: titleMatch[1],
      artist: authorMatch ? authorMatch[1] : feedData.feed.author || feedData.feed.title,
      audioUrl: enclosureMatch ? enclosureMatch[1] : '',
      duration: durationMatch ? parseInt(durationMatch[1]) : 300,
      image: imageMatch ? imageMatch[1] : feedImageMatch ? feedImageMatch[1] : feedData.feed.image,
      feedTitle: feedData.feed.title
    };

    console.log(`🎵 Resolved: "${resolvedTrack.title}" by "${resolvedTrack.artist}" (${resolvedTrack.duration}s)`);
    return resolvedTrack;

  } catch (error) {
    console.error(`❌ Error resolving ${feedGuid}/${itemGuid}:`, error.message);
    return null;
  }
}

async function updateLightningThrashesData() {
  console.log('🔄 Starting Lightning Thrashes data update...');
  
  try {
    // Read the music tracks data file
    const dataPath = path.join(__dirname, 'data', 'music-tracks.json');
    let musicTracksData;
    
    try {
      const dataContent = fs.readFileSync(dataPath, 'utf8');
      const parsedData = JSON.parse(dataContent);
      musicTracksData = parsedData.musicTracks || [];
    } catch (error) {
      console.error('❌ Failed to read music-tracks.json:', error.message);
      return;
    }
    
    console.log(`📊 Loaded ${musicTracksData.length} total tracks`);
    
    // Filter for Lightning Thrashes tracks that are unresolved
    const lightningThrashesTracks = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') && 
      track.valueForValue?.resolved === false
    );
    
    console.log(`📊 Found ${lightningThrashesTracks.length} unresolved Lightning Thrashes tracks`);
    
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process tracks in batches of 3 to avoid rate limiting
    for (let i = 0; i < lightningThrashesTracks.length; i += 3) {
      const batch = lightningThrashesTracks.slice(i, i + 3);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/3) + 1}/${Math.ceil(lightningThrashesTracks.length/3)}`);
      
      const batchPromises = batch.map(async (track) => {
        const feedGuid = track.valueForValue?.feedGuid;
        const itemGuid = track.valueForValue?.itemGuid;
        
        if (!feedGuid || !itemGuid) {
          console.log(`⚠️ Missing feedGuid or itemGuid for track ${track.id}`);
          failedCount++;
          return;
        }
        
        const resolved = await resolveLightningThrashesTrack(feedGuid, itemGuid);
        
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
            console.log(`✅ Updated track ${track.id}: "${resolved.title}"`);
          }
        } else {
          failedCount++;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait 3 seconds between batches to avoid rate limiting
      if (i + 3 < lightningThrashesTracks.length) {
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
    
    console.log(`\n🎯 Update complete!`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    
  } catch (error) {
    console.error('❌ Error updating Lightning Thrashes data:', error);
  }
}

// Run the update
updateLightningThrashesData().catch(console.error);