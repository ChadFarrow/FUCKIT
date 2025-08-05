#!/usr/bin/env node
// Fix durations for resolved Lightning Thrashes tracks by re-parsing RSS feeds with better duration extraction

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
  } catch (error) {
    console.log('⚠️ Could not load .env.local:', error.message);
  }
}

loadEnvLocal();

async function getRSSFeedDuration(feedGuid, itemGuid) {
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
    
    // Try multiple duration patterns
    const durationPatterns = [
      /<itunes:duration>(\d+)<\/itunes:duration>/i,
      /<itunes:duration>(\d+):(\d+)<\/itunes:duration>/i,
      /<itunes:duration>(\d+):(\d+):(\d+)<\/itunes:duration>/i,
      /<duration>(\d+)<\/duration>/i,
      /<duration>(\d+):(\d+)<\/duration>/i,
      /<duration>(\d+):(\d+):(\d+)<\/duration>/i
    ];
    
    for (const pattern of durationPatterns) {
      const match = itemXml.match(pattern);
      if (match) {
        if (match.length === 2) {
          // Just seconds
          return parseInt(match[1]);
        } else if (match.length === 3) {
          // MM:SS format
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        } else if (match.length === 4) {
          // HH:MM:SS format
          return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        }
      }
    }
    
    return null;

  } catch (error) {
    console.error(`❌ Error getting duration for ${feedGuid}/${itemGuid}:`, error.message);
    return null;
  }
}

async function fixDurationsFromRSS() {
  console.log('🔧 Fixing durations by re-parsing RSS feeds...');
  
  try {
    const dataPath = path.join(__dirname, 'public', 'music-tracks.json');
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(dataContent);
    const musicTracksData = parsedData.musicTracks || [];
    
    // Find resolved Lightning Thrashes tracks with 300s duration that have V4V data
    const tracksToFix = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.duration === 300 &&
      track.valueForValue?.resolved === true &&
      track.valueForValue?.feedGuid &&
      track.valueForValue?.itemGuid
    );
    
    console.log(`📊 Found ${tracksToFix.length} resolved tracks to fix durations for`);
    
    if (tracksToFix.length === 0) {
      console.log('✅ No tracks need duration fixes');
      return;
    }
    
    let fixedCount = 0;
    let failedCount = 0;
    
    // Process tracks in small batches to avoid rate limiting
    for (let i = 0; i < tracksToFix.length; i += 3) {
      const batch = tracksToFix.slice(i, i + 3);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/3) + 1}/${Math.ceil(tracksToFix.length/3)}`);
      
      const batchPromises = batch.map(async (track) => {
        const feedGuid = track.valueForValue.feedGuid;
        const itemGuid = track.valueForValue.itemGuid;
        
        console.log(`🔍 Getting duration for: "${track.valueForValue.resolvedTitle}" by "${track.valueForValue.resolvedArtist}"`);
        
        const actualDuration = await getRSSFeedDuration(feedGuid, itemGuid);
        
        if (actualDuration && actualDuration !== 300 && actualDuration > 0) {
          // Update the track in the data
          const trackIndex = musicTracksData.findIndex(t => t.id === track.id);
          if (trackIndex !== -1) {
            musicTracksData[trackIndex].duration = actualDuration;
            musicTracksData[trackIndex].endTime = actualDuration;
            
            fixedCount++;
            const mins = Math.floor(actualDuration / 60);
            const secs = actualDuration % 60;
            console.log(`✅ Updated duration: ${mins}:${secs.toString().padStart(2, '0')} (was 5:00)`);
          }
        } else {
          failedCount++;
          console.log(`❌ Could not get duration from RSS feed`);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait between batches to avoid rate limiting
      if (i + 3 < tracksToFix.length) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Save the updated data
    if (fixedCount > 0) {
      const updatedData = {
        musicTracks: musicTracksData
      };
      fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
      console.log('✅ Saved updated music-tracks.json');
    }
    
    console.log(`\n🎯 Duration fix complete!`);
    console.log(`✅ Fixed: ${fixedCount} tracks`);
    console.log(`❌ Failed: ${failedCount} tracks`);
    
    // Count remaining 5:00 tracks
    const remaining300s = musicTracksData.filter(track => 
      track.feedUrl?.includes('lightning-thrashes') &&
      track.duration === 300
    ).length;
    console.log(`⚠️ Remaining 5:00 Lightning Thrashes tracks: ${remaining300s}`);
    
  } catch (error) {
    console.error('❌ Error fixing track durations:', error);
  }
}

fixDurationsFromRSS().catch(console.error);