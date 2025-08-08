#!/usr/bin/env node
// Resolve Lightning Thrashes V4V tracks

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

// Simple V4V resolver for Lightning Thrashes
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

async function updateLightningThrashesDatabase() {
  console.log('🔄 Starting Lightning Thrashes V4V resolution...');
  
  try {
    // Fetch Lightning Thrashes tracks from the API
    const response = await fetch('http://localhost:3000/api/music-tracks/database?pageSize=500');
    const data = await response.json();
    const allTracks = data.data?.tracks || [];
    
    // Filter for Lightning Thrashes tracks that are unresolved
    const lightningThrashesTracks = allTracks.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') && 
      track.valueForValue?.resolved === false
    );
    
    console.log(`📊 Found ${lightningThrashesTracks.length} unresolved Lightning Thrashes tracks`);
    
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process tracks in batches of 5 to avoid rate limiting
    for (let i = 0; i < lightningThrashesTracks.length; i += 5) {
      const batch = lightningThrashesTracks.slice(i, i + 5);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/5) + 1}/${Math.ceil(lightningThrashesTracks.length/5)}`);
      
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
          // Update the track via API
          try {
            const updateResponse = await fetch('http://localhost:3000/api/music-tracks/database', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'updateTrack',
                data: {
                  trackId: track.id,
                  updates: {
                    title: resolved.title,
                    artist: resolved.artist,
                    duration: resolved.duration,
                    audioUrl: resolved.audioUrl,
                    image: resolved.image,
                    valueForValue: {
                      ...track.valueForValue,
                      resolved: true,
                      resolvedTitle: resolved.title,
                      resolvedArtist: resolved.artist,
                      resolvedImage: resolved.image,
                      resolvedAudioUrl: resolved.audioUrl,
                      lastResolved: new Date().toISOString()
                    }
                  }
                }
              })
            });
            
            if (updateResponse.ok) {
              resolvedCount++;
              console.log(`✅ Updated track ${track.id}: "${resolved.title}"`);
            } else {
              console.log(`❌ Failed to update track ${track.id}`);
              failedCount++;
            }
          } catch (updateError) {
            console.error(`❌ Error updating track ${track.id}:`, updateError.message);
            failedCount++;
          }
        } else {
          failedCount++;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait 2 seconds between batches to avoid rate limiting
      if (i + 5 < lightningThrashesTracks.length) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n🎯 Resolution complete!`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    
  } catch (error) {
    console.error('❌ Error updating Lightning Thrashes database:', error);
  }
}

// Run the resolution
updateLightningThrashesDatabase().catch(console.error);