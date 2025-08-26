#!/usr/bin/env node

/**
 * Resolve Wavlake Tracks
 * 
 * This script resolves missing metadata for tracks by parsing Wavlake RSS feeds directly
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MUSIC_TRACKS_PATH = path.join(DATA_DIR, 'music-tracks.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

console.log('🌊 Resolving Wavlake Tracks\n');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `music-tracks-backup-wavlake-resolve-${timestamp}.json`);
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

// Find Wavlake tracks
const wavlakeTracks = musicTracks.filter(track => 
  track.feedUrl && track.feedUrl.includes('wavlake.com')
);

console.log(`🌊 Found ${wavlakeTracks.length} Wavlake tracks`);

if (wavlakeTracks.length === 0) {
  console.log('❌ No Wavlake tracks found');
  process.exit(0);
}

// Parse RSS feed to extract metadata
async function parseWavlakeRSS(feedUrl) {
  try {
    console.log(`   🔍 Fetching: ${feedUrl}`);
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const rssText = await response.text();
    
    // Extract basic feed information
    const feedTitleMatch = rssText.match(/<title>([^<]+)<\/title>/i);
    const feedDescriptionMatch = rssText.match(/<description>([^<]+)<\/description>/i);
    const feedImageMatch = rssText.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i);
    
    // Extract tracks
    const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/gi);
    const tracks = [];
    
    if (itemMatches) {
      itemMatches.forEach(itemContent => {
        const titleMatch = itemContent.match(/<title>([^<]+)<\/title>/i);
        const descriptionMatch = itemContent.match(/<description>([^<]+)<\/description>/i);
        const audioMatch = itemContent.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="audio\//i);
        const durationMatch = itemContent.match(/<itunes:duration>([^<]+)<\/itunes:duration>/i);
        const imageMatch = itemContent.match(/<itunes:image[^>]+href="([^"]+)"/i);
        const guidMatch = itemContent.match(/<guid[^>]*>([^<]+)<\/guid>/i);
        
        if (titleMatch) {
          tracks.push({
            title: titleMatch[1].trim(),
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            audioUrl: audioMatch ? audioMatch[1] : '',
            duration: durationMatch ? durationMatch[1] : '',
            image: imageMatch ? imageMatch[1] : '',
            guid: guidMatch ? guidMatch[1] : ''
          });
        }
      });
    }
    
    return {
      feedTitle: feedTitleMatch ? feedTitleMatch[1].trim() : '',
      feedDescription: feedDescriptionMatch ? feedDescriptionMatch[1].trim() : '',
      feedImage: feedImageMatch ? feedImageMatch[1] : '',
      tracks: tracks
    };
    
  } catch (error) {
    console.log(`   ❌ Error parsing RSS: ${error.message}`);
    return { error: error.message };
  }
}

// Process Wavlake tracks in batches
async function processWavlakeTracks(tracks, batchSize = 5) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`\n🔄 Processing ${tracks.length} Wavlake tracks in batches of ${batchSize}...`);
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tracks.length / batchSize)} (${batch.length} tracks)`);
    
    for (const track of batch) {
      try {
        if (!track.feedUrl) {
          console.log(`   ⏭️  Skipping track without feedUrl: ${track.title || 'No title'}`);
          results.skipped++;
          continue;
        }
        
        // Parse RSS feed
        const feedData = await parseWavlakeRSS(track.feedUrl);
        if (feedData.error) {
          console.log(`   ❌ RSS error for ${track.title || 'No title'}: ${feedData.error}`);
          results.failed++;
          results.errors.push(`RSS error for ${track.title}: ${feedData.error}`);
          continue;
        }
        
        // Update track with feed information
        if (feedData.feedTitle && !track.feedTitle) {
          track.feedTitle = feedData.feedTitle;
        }
        if (feedData.feedDescription && !track.feedDescription) {
          track.feedDescription = feedData.feedDescription;
        }
        if (feedData.feedImage && !track.image) {
          track.image = feedData.feedImage;
        }
        
        // Find matching track in RSS
        const matchingTrack = feedData.tracks.find(rssTrack => 
          rssTrack.title.toLowerCase() === (track.title || '').toLowerCase()
        );
        
        if (matchingTrack) {
          // Update track with RSS data
          if (matchingTrack.audioUrl && !track.audioUrl) {
            track.audioUrl = matchingTrack.audioUrl;
          }
          if (matchingTrack.duration && !track.duration) {
            track.duration = matchingTrack.duration;
          }
          if (matchingTrack.image && !track.image) {
            track.image = matchingTrack.image;
          }
          if (matchingTrack.description && !track.summary) {
            track.summary = matchingTrack.description;
          }
          
          console.log(`   ✅ Updated metadata for: ${track.title || 'No title'}`);
          results.success++;
        } else {
          console.log(`   ⚠️  No matching track found in RSS for: ${track.title || 'No title'}`);
          results.failed++;
        }
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
    const results = await processWavlakeTracks(wavlakeTracks);
    
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
    const reportPath = path.join(DATA_DIR, `wavlake-resolution-report-${timestamp}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      totalTracks: musicTracks.length,
      wavlakeTracks: wavlakeTracks.length,
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
