#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');
const TEST_COUNT = 5; // Only test 5 tracks

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds before retry

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
  console.log('🧪 Testing Wavlake Track Resolution (Rate Limited)');
  console.log(`⏱️  Rate limiting: 2s between requests, 5s retry delay`);
  console.log(`📊 Testing with ${TEST_COUNT} tracks only`);
  console.log('');
  
  // Read music tracks
  let musicData;
  try {
    musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    const musicTracks = musicData.musicTracks || musicData;
    console.log(`📀 Loaded ${musicTracks.length} tracks (will test first ${TEST_COUNT})`);
  } catch (error) {
    console.error('❌ Error reading music-tracks.json:', error.message);
    process.exit(1);
  }
  
  const musicTracks = musicData.musicTracks || musicData;
  const testTracks = musicTracks.slice(0, TEST_COUNT);
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  // Process test tracks with rate limiting
  for (let i = 0; i < testTracks.length; i++) {
    const track = testTracks[i];
    
    console.log(`📦 Testing track ${i + 1}/${TEST_COUNT}: ${track.title}`);
    
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
        console.log('   ✅ Track found in RSS feed');
        if (metadata.audioUrl) console.log(`      🎵 Audio URL: ${metadata.audioUrl}`);
        if (metadata.duration) console.log(`      ⏱️  Duration: ${metadata.duration}`);
        if (metadata.imageUrl) console.log(`      🖼️  Image URL: ${metadata.imageUrl}`);
        successCount++;
      } else {
        console.log('   ⚠️  Track not found in RSS feed');
        skippedCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
    
    console.log('');
  }
  
  // Final output
  console.log('📊 Test Results:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log('');
  console.log('💡 If this test works well, run the full script:');
  console.log('   node scripts/resolve-wavlake-tracks-rate-limited.js');
}

// Run the script
main().catch(console.error);
