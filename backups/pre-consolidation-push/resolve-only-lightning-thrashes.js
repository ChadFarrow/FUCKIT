#!/usr/bin/env node
// Resolve ONLY Lightning Thrashes playlist tracks (250 remoteItems)

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

loadEnvLocal();

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

async function resolveOnlyLightningThrashes() {
  console.log('🔄 Resolving ONLY Lightning Thrashes playlist tracks...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks in database: ${musicTracksData.length}`);
    
    // Find ONLY Lightning Thrashes tracks (not ITDV, not HGH, not others)
    const lightningTracks = musicTracksData.filter(track => 
      track.feedUrl === 'https://cdn.kolomona.com/podcasts/lightning-thrashes/playlists/001-to-060-lightning-thrashes-playlist.xml' &&
      track.playlistInfo?.source === 'Lightning Thrashes RSS Playlist'
    );
    
    console.log(`📊 Found ${lightningTracks.length} Lightning Thrashes playlist tracks`);
    
    // Find unresolved ones with feedGuid
    const unresolvedTracks = lightningTracks.filter(track => 
      track.valueForValue?.resolved === false &&
      track.valueForValue?.feedGuid &&
      track.valueForValue?.itemGuid &&
      (track.duration === 300 || track.title?.startsWith('Lightning Thrashes Track'))
    );
    
    console.log(`📊 Found ${unresolvedTracks.length} unresolved Lightning Thrashes tracks needing resolution`);
    
    if (unresolvedTracks.length === 0) {
      console.log('✅ All Lightning Thrashes tracks already resolved!');
      return;
    }
    
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process tracks in small batches
    for (let i = 0; i < unresolvedTracks.length; i += 2) {
      const batch = unresolvedTracks.slice(i, i + 2);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/2) + 1}/${Math.ceil(unresolvedTracks.length/2)}`);
      
      const batchPromises = batch.map(async (track) => {
        const feedGuid = track.valueForValue.feedGuid;
        const itemGuid = track.valueForValue.itemGuid;
        
        console.log(`🔍 Resolving: ${track.title} (${feedGuid.substring(0, 8)}...)`);
        
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
            console.log(`✅ "${resolved.title}" by "${resolved.artist}" (${resolved.duration}s)`);
          }
        } else {
          failedCount++;
          console.log(`❌ Failed to resolve: ${track.title}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait between batches to avoid rate limiting
      if (i + 2 < unresolvedTracks.length) {
        console.log('⏳ Waiting 4 seconds...');
        await new Promise(resolve => setTimeout(resolve, 4000));
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
    
    console.log(`\n🎯 Lightning Thrashes resolution complete!`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    console.log(`📊 Total Lightning Thrashes tracks: ${lightningTracks.length}`);
    
    // Count remaining placeholder tracks
    const remaining300s = lightningTracks.filter(t => t.duration === 300 && t.valueForValue?.resolved === false).length;
    console.log(`⚠️ Remaining 5-minute placeholders: ${remaining300s}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resolveOnlyLightningThrashes().catch(console.error);