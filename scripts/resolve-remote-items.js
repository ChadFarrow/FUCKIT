#!/usr/bin/env node

/**
 * Resolve Remote Items
 * 
 * This script processes tracks that were added via podcast:remoteItem format
 * and resolves their missing metadata using the Podcast Index API.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '../data');
const MUSIC_TRACKS_PATH = path.join(DATA_DIR, 'music-tracks.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

console.log('🔗 Resolving Remote Items and Missing Metadata\n');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `music-tracks-backup-remote-resolve-${timestamp}.json`);
fs.copyFileSync(MUSIC_TRACKS_PATH, backupPath);
console.log(`✅ Created backup: ${backupPath}`);

// Read music tracks
let musicData;
try {
  musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
  const musicTracks = musicData.musicTracks || musicData;
  console.log(`📀 Loaded ${musicTracks.length} tracks`);
} catch (error) {
  console.error('❌ Error reading music-tracks.json:', error.message);
  process.exit(1);
}

const musicTracks = musicData.musicTracks || musicData;

// Categorize tracks
const tracksWithFullMetadata = musicTracks.filter(track => 
  track.itemGuid && track.itemGuid._ && track.feedGuid && track.audioUrl
);

const tracksWithPartialMetadata = musicTracks.filter(track => 
  track.feedGuid && (!track.itemGuid || !track.itemGuid._ || !track.audioUrl)
);

const tracksMissingMetadata = musicTracks.filter(track => 
  !track.feedGuid || (!track.itemGuid && !track.audioUrl)
);

console.log(`📊 Track Analysis:`);
console.log(`   ✅ Full metadata: ${tracksWithFullMetadata.length}`);
console.log(`   ⚠️  Partial metadata: ${tracksWithPartialMetadata.length}`);
console.log(`   ❌ Missing metadata: ${tracksMissingMetadata.length}`);

// Podcast Index API authentication
function createAuthHeaders() {
  const unixTime = Math.floor(Date.now() / 1000);
  const data4Hash = API_KEY + API_SECRET + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': API_KEY,
    'Authorization': hash,
    'User-Agent': 'FUCKIT-Music-App/1.0'
  };
}

// Cache for API calls
const feedCache = new Map();
const episodeCache = new Map();

// Get feed information from Podcast Index
async function getFeedInfo(feedGuid) {
  if (feedCache.has(feedGuid)) {
    return feedCache.get(feedGuid);
  }
  
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    let result;
    if (data.status === 'true' && data.feed && data.feed.id) {
      result = { 
        feedId: data.feed.id, 
        feedTitle: data.feed.title,
        feedUrl: data.feed.url,
        feedImage: data.feed.image,
        feedArtist: data.feed.author || data.feed.ownerName,
        episodeCount: data.feed.episodeCount || 0
      };
    } else {
      result = { error: 'Feed not found' };
    }
    
    feedCache.set(feedGuid, result);
    return result;
  } catch (error) {
    const result = { error: error.message };
    feedCache.set(feedGuid, result);
    return result;
  }
}

// Get episode information from Podcast Index
async function getEpisodeInfo(feedId, itemGuid) {
  const cacheKey = `${feedId}-${itemGuid}`;
  if (episodeCache.has(cacheKey)) {
    return episodeCache.get(cacheKey);
  }
  
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    let result;
    if (data.status === 'true' && data.episode) {
      result = {
        title: data.episode.title,
        description: data.episode.description,
        audioUrl: data.episode.enclosureUrl,
        duration: data.episode.duration,
        published: data.episode.datePublished,
        image: data.episode.image,
        explicit: data.episode.explicit || false
      };
    } else {
      result = { error: 'Episode not found' };
    }
    
    episodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const result = { error: error.message };
    episodeCache.set(cacheKey, result);
    return result;
  }
}

// Process tracks with partial metadata
async function processPartialMetadataTracks(tracks, batchSize = 10) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`\n🔄 Processing ${tracks.length} tracks with partial metadata...`);
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tracks.length / batchSize)} (${batch.length} tracks)`);
    
    for (const track of batch) {
      try {
        if (!track.feedGuid) {
          console.log(`   ⏭️  Skipping track without feedGuid: ${track.title || 'No title'}`);
          results.skipped++;
          continue;
        }
        
        // Get feed info
        const feedInfo = await getFeedInfo(track.feedGuid);
        if (feedInfo.error) {
          console.log(`   ❌ Feed error for ${track.title || 'No title'}: ${feedInfo.error}`);
          results.failed++;
          results.errors.push(`Feed error for ${track.title}: ${feedInfo.error}`);
          continue;
        }
        
        // Update track with feed information
        if (feedInfo.feedTitle && !track.feedTitle) {
          track.feedTitle = feedInfo.feedTitle;
        }
        if (feedInfo.feedUrl && !track.feedUrl) {
          track.feedUrl = feedInfo.feedUrl;
        }
        if (feedInfo.feedImage && !track.image) {
          track.image = feedInfo.feedImage;
        }
        if (feedInfo.feedArtist && !track.artist) {
          track.artist = feedInfo.feedArtist;
        }
        
        // If we have an itemGuid, try to get episode info
        if (track.itemGuid && track.itemGuid._) {
          const episodeInfo = await getEpisodeInfo(feedInfo.feedId, track.itemGuid._);
          if (!episodeInfo.error) {
            if (episodeInfo.audioUrl && !track.audioUrl) {
              track.audioUrl = episodeInfo.audioUrl;
            }
            if (episodeInfo.duration && !track.duration) {
              track.duration = episodeInfo.duration;
            }
            if (episodeInfo.image && !track.image) {
              track.image = episodeInfo.image;
            }
            console.log(`   ✅ Updated metadata for: ${track.title || 'No title'}`);
            results.success++;
          } else {
            console.log(`   ⚠️  Episode not found for: ${track.title || 'No title'}`);
            results.failed++;
          }
        } else {
          console.log(`   ⚠️  No itemGuid for: ${track.title || 'No title'}`);
          results.failed++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ❌ Error processing ${track.title || 'No title'}: ${error.message}`);
        results.failed++;
        results.errors.push(`Processing error for ${track.title}: ${error.message}`);
      }
    }
    
    // Save progress after each batch
    const progressData = {
      ...musicData,
      musicTracks: musicTracks
    };
    fs.writeFileSync(MUSIC_TRACKS_PATH, JSON.stringify(progressData, null, 2));
    console.log(`   💾 Progress saved`);
  }
  
  return results;
}

// Main execution
async function main() {
  try {
    console.log(`\n🎯 Focus: Processing ${tracksWithPartialMetadata.length} tracks with partial metadata`);
    
    const results = await processPartialMetadataTracks(tracksWithPartialMetadata);
    
    console.log('\n📊 Final Results:');
    console.log(`   ✅ Successfully updated: ${results.success}`);
    console.log(`   ❌ Failed to update: ${results.failed}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      results.errors.slice(0, 10).forEach(error => {
        console.log(`   • ${error}`);
      });
      if (results.errors.length > 10) {
        console.log(`   ... and ${results.errors.length - 10} more errors`);
      }
    }
    
    // Save final results
    const finalData = {
      ...musicData,
      musicTracks: musicTracks
    };
    fs.writeFileSync(MUSIC_TRACKS_PATH, JSON.stringify(finalData, null, 2));
    
    // Save detailed report
    const reportPath = path.join(DATA_DIR, `remote-items-resolution-report-${timestamp}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      totalTracks: musicTracks.length,
      tracksWithFullMetadata: tracksWithFullMetadata.length,
      tracksWithPartialMetadata: tracksWithPartialMetadata.length,
      tracksMissingMetadata: tracksMissingMetadata.length,
      results: results
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n💾 Final data saved to ${MUSIC_TRACKS_PATH}`);
    console.log(`📋 Detailed report saved to ${reportPath}`);
    
    // Show updated statistics
    const updatedTracksWithAudio = musicTracks.filter(track => track.audioUrl);
    const updatedTracksWithArtwork = musicTracks.filter(track => track.image);
    const updatedTracksWithArtist = musicTracks.filter(track => track.artist);
    
    console.log(`\n📈 Updated Statistics:`);
    console.log(`   🎵 Tracks with audio URLs: ${updatedTracksWithAudio.length}/${musicTracks.length}`);
    console.log(`   🖼️  Tracks with artwork: ${updatedTracksWithArtwork.length}/${musicTracks.length}`);
    console.log(`   👤 Tracks with artist: ${updatedTracksWithArtist.length}/${musicTracks.length}`);
    
    console.log(`\n💡 Next steps:`);
    console.log(`   • Run: node scripts/fetch-missing-publishers.js (add publisher info)`);
    console.log(`   • Run: node scripts/search-podcastindex-for-artwork.js (find missing artwork)`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
