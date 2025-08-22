#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');
const OUTPUT_PATH = path.join(__dirname, '../data/music-tracks.json');
const REPORT_PATH = path.join(__dirname, '../data/publisher-resolution-report.json');

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second between requests (faster for publisher resolution)
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds before retry

// Progress tracking
let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;
let rateLimitCount = 0;

// Cache for feed metadata to avoid re-fetching
const feedCache = new Map();

// Utility function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract publisher information from RSS feed
async function extractPublisherFromFeed(feedUrl, maxRetries = MAX_RETRIES) {
  // Check cache first
  if (feedCache.has(feedUrl)) {
    return feedCache.get(feedUrl);
  }
  
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
      
      // Extract publisher information from various RSS fields
      let publisher = null;
      
      // Try different publisher fields in order of preference
      const publisherPatterns = [
        /<itunes:author>([^<]+)</i,
        /<author>([^<]+)</i,
        /<dc:creator>([^<]+)</i,
        /<webMaster>([^<]+)</i,
        /<managingEditor>([^<]+)</i,
        /<copyright>([^<]+)</i,
        /<itunes:owner>\s*<itunes:name>([^<]+)</i,
        /<channel>\s*<title>([^<]+)</i
      ];
      
      for (const pattern of publisherPatterns) {
        const match = xmlText.match(pattern);
        if (match && match[1].trim()) {
          publisher = match[1].trim();
          break;
        }
      }
      
      // If no publisher found, try to extract from feed URL domain
      if (!publisher) {
        try {
          const url = new URL(feedUrl);
          if (url.hostname === 'wavlake.com') {
            // For Wavlake, try to extract artist from the feed
            const artistMatch = xmlText.match(/<itunes:author>([^<]+)</i);
            if (artistMatch) {
              publisher = artistMatch[1].trim();
            }
          } else {
            // For other domains, use the hostname as fallback
            publisher = url.hostname.replace('www.', '');
          }
        } catch (e) {
          // URL parsing failed, skip
        }
      }
      
      const result = { publisher, found: !!publisher };
      
      // Cache the result
      feedCache.set(feedUrl, result);
      
      return result;
      
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
  console.log('🚀 Starting Publisher Resolution from RSS Feeds');
  console.log('⏱️  Rate limiting: 1s between requests, 3s retry delay');
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
  const backupPath = OUTPUT_PATH.replace('.json', `.backup-publisher-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
  console.log(`💾 Backup created: ${backupPath}`);
  console.log('');
  
  // Group tracks by feed URL to avoid re-fetching the same feeds
  const tracksByFeed = new Map();
  musicTracks.forEach(track => {
    if (track.feedUrl) {
      if (!tracksByFeed.has(track.feedUrl)) {
        tracksByFeed.set(track.feedUrl, []);
      }
      tracksByFeed.get(track.feedUrl).push(track);
    }
  });
  
  console.log(`🔗 Processing ${tracksByFeed.size} unique feed URLs`);
  console.log('');
  
  let feedIndex = 0;
  for (const [feedUrl, tracks] of tracksByFeed) {
    feedIndex++;
    console.log(`📦 Processing feed ${feedIndex}/${tracksByFeed.size}: ${feedUrl}`);
    console.log(`   📊 Tracks in this feed: ${tracks.length}`);
    
    try {
      // Add delay between requests to respect rate limits
      if (feedIndex > 1) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_REQUESTS/1000}s before next request...`);
        await delay(DELAY_BETWEEN_REQUESTS);
      }
      
      const feedData = await extractPublisherFromFeed(feedUrl);
      
      if (feedData.found && feedData.publisher) {
        // Update all tracks from this feed
        tracks.forEach(track => {
          if (!track.publisher || !track.publisher.trim()) {
            track.publisher = feedData.publisher;
            console.log(`   ✅ Updated: ${track.title} → Publisher: ${feedData.publisher}`);
            successCount++;
          } else {
            console.log(`   ⏭️  Skipped: ${track.title} (already has publisher: ${track.publisher})`);
            skippedCount++;
          }
          processedCount++;
        });
      } else {
        console.log(`   ⚠️  No publisher found in feed`);
        tracks.forEach(track => {
          processedCount++;
          skippedCount++;
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      tracks.forEach(track => {
        processedCount++;
        errorCount++;
      });
    }
    
    // Save progress every 20 feeds
    if (feedIndex % 20 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(musicData, null, 2));
      console.log(`   💾 Progress saved (${feedIndex}/${tracksByFeed.size} feeds)`);
    }
    
    console.log('');
  }
  
  // Final save
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(musicData, null, 2));
  
  // Generate report
  const finalStats = {
    tracksWithPublisher: musicTracks.filter(t => t.publisher && t.publisher.trim()).length,
    tracksWithoutPublisher: musicTracks.filter(t => !t.publisher || !t.publisher.trim()).length
  };
  
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
      tracksWithPublisher: finalStats.tracksWithPublisher,
      tracksWithoutPublisher: finalStats.tracksWithoutPublisher,
      publisherCoverage: (finalStats.tracksWithPublisher / totalTracks * 100).toFixed(1) + '%'
    },
    feedAnalysis: {
      totalFeeds: tracksByFeed.size,
      feedsWithPublishers: feedCache.size,
      feedsWithoutPublishers: tracksByFeed.size - feedCache.size
    }
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
  console.log(`   👤 Tracks with publisher: ${finalStats.tracksWithPublisher}/${totalTracks} (${report.statistics.publisherCoverage})`);
  console.log(`   ❌ Tracks without publisher: ${finalStats.tracksWithoutPublisher}/${totalTracks}`);
  console.log('');
  console.log(`💾 Final data saved to ${OUTPUT_PATH}`);
  console.log(`📋 Report saved to ${REPORT_PATH}`);
}

// Run the script
main().catch(console.error);
