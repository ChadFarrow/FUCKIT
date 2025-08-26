#!/usr/bin/env node
// Resolve V4V tracks for any playlist source

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
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

// Configuration
const CONFIG = {
  source: '',
  limit: 0,
  dryRun: false
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    switch(key) {
      case '--source':
        CONFIG.source = value;
        break;
      case '--limit':
        CONFIG.limit = parseInt(value) || 0;
        break;
      case '--dry-run':
        CONFIG.dryRun = true;
        break;
    }
  });
  
  if (!CONFIG.source) {
    console.error('❌ Error: --source is required');
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🎵 Resolve V4V Tracks

Usage: node resolve-v4v-tracks.js [options]

Required options:
  --source=<name>    Playlist source name (e.g., "Lightning Thrashes RSS Playlist")

Optional options:
  --limit=<number>   Limit number of tracks to resolve (default: all)
  --dry-run          Show what would be resolved without saving

Examples:
  node resolve-v4v-tracks.js --source="Lightning Thrashes RSS Playlist"
  node resolve-v4v-tracks.js --source="ITDV RSS Playlist" --limit=10
`);
}

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
    const durationMatch = itemXml.match(/<itunes:duration>(\d+)<\/itunes:duration>/i) ||
                         itemXml.match(/<itunes:duration>(\d+):(\d+)<\/itunes:duration>/i) ||
                         itemXml.match(/<itunes:duration>(\d+):(\d+):(\d+)<\/itunes:duration>/i);
    const imageMatch = itemXml.match(/<itunes:image[^>]+href="([^"]+)"/i);
    const authorMatch = itemXml.match(/<author>(.*?)<\/author>/i) || itemXml.match(/<itunes:author>(.*?)<\/itunes:author>/i);
    
    // Get feed-level info for fallbacks
    const feedImageMatch = rssXml.match(/<itunes:image[^>]+href="([^"]+)"/i);
    
    if (!titleMatch) {
      return null;
    }
    
    // Parse duration
    let duration = 300; // default
    if (durationMatch) {
      if (durationMatch.length === 2) {
        // Just seconds
        duration = parseInt(durationMatch[1]);
      } else if (durationMatch.length === 3) {
        // MM:SS format
        duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
      } else if (durationMatch.length === 4) {
        // HH:MM:SS format
        duration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]);
      }
    }

    return {
      title: titleMatch[1],
      artist: authorMatch ? authorMatch[1] : feedData.feed.author || feedData.feed.title,
      audioUrl: enclosureMatch ? enclosureMatch[1] : '',
      duration: duration,
      image: imageMatch ? imageMatch[1] : feedImageMatch ? feedImageMatch[1] : feedData.feed.image,
      feedTitle: feedData.feed.title
    };

  } catch (error) {
    console.error(`❌ Error resolving ${feedGuid}/${itemGuid}:`, error.message);
    return null;
  }
}

async function resolvePlaylistTracks() {
  console.log(`🔄 Resolving V4V tracks for: ${CONFIG.source}`);
  
  try {
    const dataPath = path.join(__dirname, '..', 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    console.log(`📊 Total tracks in database: ${musicTracksData.length}`);
    
    // Find tracks from specified source
    const sourceTracks = musicTracksData.filter(track => 
      track.playlistInfo?.source === CONFIG.source
    );
    
    console.log(`📊 Found ${sourceTracks.length} tracks from ${CONFIG.source}`);
    
    // Find unresolved tracks with V4V data
    const unresolvedTracks = sourceTracks.filter(track => 
      track.valueForValue?.resolved === false &&
      track.valueForValue?.feedGuid &&
      track.valueForValue?.itemGuid
    );
    
    console.log(`📊 Found ${unresolvedTracks.length} unresolved tracks needing resolution`);
    
    if (unresolvedTracks.length === 0) {
      console.log('✅ All tracks already resolved!');
      return;
    }
    
    // Apply limit if specified
    const tracksToResolve = CONFIG.limit > 0 
      ? unresolvedTracks.slice(0, CONFIG.limit)
      : unresolvedTracks;
    
    if (CONFIG.dryRun) {
      console.log(`\n🔍 DRY RUN - Would resolve ${tracksToResolve.length} tracks:`);
      tracksToResolve.slice(0, 5).forEach(track => {
        console.log(`  - ${track.title} (${track.valueForValue.feedGuid.substring(0, 8)}...)`);
      });
      return;
    }
    
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process tracks in small batches
    for (let i = 0; i < tracksToResolve.length; i += 3) {
      const batch = tracksToResolve.slice(i, i + 3);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/3) + 1}/${Math.ceil(tracksToResolve.length/3)}`);
      
      const batchPromises = batch.map(async (track) => {
        const feedGuid = track.valueForValue.feedGuid;
        const itemGuid = track.valueForValue.itemGuid;
        
        console.log(`🔍 Resolving: ${track.title}`);
        
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
            const mins = Math.floor(resolved.duration / 60);
            const secs = resolved.duration % 60;
            console.log(`✅ "${resolved.title}" by "${resolved.artist}" (${mins}:${secs.toString().padStart(2, '0')})`);
          }
        } else {
          failedCount++;
          console.log(`❌ Failed to resolve: ${track.title}`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait between batches to avoid rate limiting
      if (i + 3 < tracksToResolve.length) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Write the updated data back to the file
    const updatedData = {
      musicTracks: musicTracksData
    };
    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
    console.log('✅ Saved updated music-tracks.json');
    
    console.log(`\n🎯 V4V resolution complete!`);
    console.log(`✅ Resolved: ${resolvedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    
    // Count statistics
    const updatedSourceTracks = musicTracksData.filter(track => 
      track.playlistInfo?.source === CONFIG.source
    );
    const resolvedSourceTracks = updatedSourceTracks.filter(t => t.valueForValue?.resolved === true);
    const unresolvedSourceTracks = updatedSourceTracks.filter(t => t.valueForValue?.resolved === false);
    
    console.log(`\n📊 ${CONFIG.source} Statistics:`);
    console.log(`📊 Total tracks: ${updatedSourceTracks.length}`);
    console.log(`✅ Resolved: ${resolvedSourceTracks.length}`);
    console.log(`⚠️ Unresolved: ${unresolvedSourceTracks.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main execution
async function main() {
  parseArgs();
  await resolvePlaylistTracks();
}

main().catch(console.error);