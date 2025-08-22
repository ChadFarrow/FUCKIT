#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');
const OUTPUT_PATH = path.join(__dirname, '../data/music-tracks.json');
const REPORT_PATH = path.join(__dirname, '../data/wavlake-resolution-report-rate-limited.json');

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds before retry

// Progress tracking
let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;
let rateLimitCount = 0;

// Utility function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function to clean text for comparison
function cleanText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Parse RSS feed to extract metadata
async function parseWavlakeRSS(feedUrl, trackTitle, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   🔍 Fetching: ${feedUrl} (attempt ${attempt}/${maxRetries})`);
      
      const response = await fetch(feedUrl);
      
      if (response.status === 429) {
        rateLimitCount++;
        const waitTime = RETRY_DELAY * attempt;
        console.log(`   ⏳ Rate limited (HTTP 429). Waiting ${waitTime/1000}s before retry...`);
        await delay(waitTime);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      // Simple XML parsing to find the track
      const cleanTrackTitle = cleanText(trackTitle);
      
      // Look for the track in the RSS
      if (xmlText.toLowerCase().includes(cleanTrackTitle)) {
        // Extract basic metadata (simplified for now)
        const audioMatch = xmlText.match(/<enclosure[^>]*url="([^"]*\.(?:mp3|wav|m4a|ogg))"/i);
        const durationMatch = xmlText.match(/<itunes:duration>([^<]+)</i);
        const imageMatch = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i);
        
        return {
          audioUrl: audioMatch ? audioMatch[1] : null,
          duration: durationMatch ? durationMatch[1] : null,
          imageUrl: imageMatch ? imageMatch[1] : null,
          found: true
        };
      }
      
      return { found: false };
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (error.message.includes('429')) {
        const waitTime = RETRY_DELAY * attempt;
        console.log(`   ⏳ Rate limited. Waiting ${waitTime/1000}s before retry...`);
        await delay(waitTime);
      } else {
        console.log(`   ⚠️  Attempt ${attempt} failed: ${error.message}. Retrying...`);
        await delay(RETRY_DELAY);
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts`);
}

// Main processing function
async function main() {
  console.log('🚀 Starting Wavlake Track Resolution (Rate Limited)');
  console.log('⏱️  Rate limiting: 2s between requests, 5s retry delay');
  console.log('');
  
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
  const totalTracks = musicTracks.length;
  
  // Create backup
  const backupPath = OUTPUT_PATH.replace('.json', `.backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
  console.log(`💾 Backup created: ${backupPath}`);
  console.log('');
  
  // Process tracks with rate limiting
  for (let i = 0; i < totalTracks; i++) {
    const track = musicTracks[i];
    processedCount++;
    
    console.log(`📦 Processing track ${processedCount}/${totalTracks}: ${track.title}`);
    
    // Skip if already has audio URL
    if (track.audioUrl && track.audioUrl !== 'placeholder') {
      console.log('   ⏭️  Already has audio URL, skipping');
      skippedCount++;
      continue;
    }
    
    // Check if we have a feed URL
    if (!track.feedUrl) {
      console.log('   ⚠️  No feed URL, skipping');
      skippedCount++;
      continue;
    }
    
    try {
      // Add delay between requests to respect rate limits
      if (i > 0) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_REQUESTS/1000}s before next request...`);
        await delay(DELAY_BETWEEN_REQUESTS);
      }
      
      const metadata = await parseWavlakeRSS(track.feedUrl, track.title);
      
      if (metadata.found) {
        // Update track with found metadata
        if (metadata.audioUrl) {
          track.audioUrl = metadata.audioUrl;
          console.log('   ✅ Found audio URL');
        }
        if (metadata.duration) {
          track.duration = metadata.duration;
          console.log('   ✅ Found duration');
        }
        if (metadata.imageUrl && (!track.imageUrl || track.imageUrl === 'placeholder')) {
          track.imageUrl = metadata.imageUrl;
          console.log('   ✅ Found image URL');
        }
        successCount++;
      } else {
        console.log('   ⚠️  Track not found in RSS feed');
        skippedCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
    
    // Save progress every 10 tracks
    if (processedCount % 10 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(musicData, null, 2));
      console.log(`   💾 Progress saved (${processedCount}/${totalTracks})`);
    }
    
    console.log('');
  }
  
  // Final save
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(musicData, null, 2));
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTracks,
      processed: processedCount,
      successful: successCount,
      errors: errorCount,
      skipped: skippedCount,
      rateLimited: rateLimitCount
    },
    statistics: {
      tracksWithAudioUrls: musicTracks.filter(t => t.audioUrl && t.audioUrl !== 'placeholder').length,
      tracksWithArtwork: musicTracks.filter(t => t.imageUrl && t.imageUrl !== 'placeholder').length,
      tracksWithArtist: musicTracks.filter(t => t.artist && t.artist.trim()).length
    },
    errors: []
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  
  // Final output
  console.log('📊 Final Results:');
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ❌ Failed to update: ${errorCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ⏳ Rate limited: ${rateLimitCount}`);
  console.log('');
  console.log(`📈 Updated Statistics:`);
  console.log(`   🎵 Tracks with audio URLs: ${report.statistics.tracksWithAudioUrls}/${totalTracks}`);
  console.log(`   🖼️  Tracks with artwork: ${report.statistics.tracksWithArtwork}/${totalTracks}`);
  console.log(`   👤 Tracks with artist: ${report.statistics.tracksWithArtist}/${totalTracks}`);
  console.log('');
  console.log(`💾 Final data saved to ${OUTPUT_PATH}`);
  console.log(`📋 Report saved to ${REPORT_PATH}`);
}

// Run the script
main().catch(console.error);
