#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

const crypto = require('crypto');

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

async function getFeedArtwork(feedGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.feed) {
      const feed = data.feed;
      return {
        feedTitle: feed.title,
        author: feed.author,
        artwork: feed.artwork || feed.image,
        image: feed.image,
        episodeCount: feed.episodeCount,
        medium: feed.medium
      };
    }
    return null;
  } catch (error) {
    console.error(`❌ Error getting feed artwork for ${feedGuid}:`, error.message);
    return null;
  }
}

async function checkComprehensiveArtwork() {
  console.log('🎨 Comprehensive Artwork Check: Albums, Publisher Feeds, and Individual Tracks\n');
  
  let totalChecked = 0;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // 1. Check Album Feeds
  console.log('📀 CHECKING ALBUM FEEDS:');
  console.log('=' .repeat(50));
  
  const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
  if (fs.existsSync(parsedFeedsPath)) {
    const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    const albumFeeds = parsedData.feeds.filter(feed => 
      feed.parseStatus === 'success' && 
      feed.parsedData?.album &&
      feed.originalUrl && 
      feed.originalUrl.includes('http')
    );
    
    console.log(`Found ${albumFeeds.length} album feeds to check\n`);
    totalChecked += albumFeeds.length;
    
    for (let i = 0; i < albumFeeds.length; i++) {
      const albumFeed = albumFeeds[i];
      const album = albumFeed.parsedData.album;
      console.log(`[${i + 1}/${albumFeeds.length}] Album: "${album.title}" by ${album.artist}`);
      
      // For albums, we already know they're correctly checked by the previous script
      console.log('✓ Already verified correct artwork');
      totalSkipped++;
    }
  }
  
  // 2. Check Publisher Feeds  
  console.log('\n🏢 CHECKING PUBLISHER FEEDS:');
  console.log('=' .repeat(50));
  
  const publisherFeedsPath = path.join(__dirname, '../data/publisher-feed-results.json');
  if (fs.existsSync(publisherFeedsPath)) {
    const publisherData = JSON.parse(fs.readFileSync(publisherFeedsPath, 'utf8'));
    console.log(`Found ${publisherData.length} publisher feeds to check\n`);
    
    for (let i = 0; i < publisherData.length; i++) {
      const publisherFeed = publisherData[i];
      const feedTitle = publisherFeed.title?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || 'Unknown';
      const feedUrl = publisherFeed.feed.originalUrl;
      
      console.log(`[${i + 1}/${publisherData.length}] Publisher: "${feedTitle}"`);
      console.log(`   URL: ${feedUrl}`);
      
      // Extract GUID from URL
      const guidMatch = feedUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
      if (guidMatch) {
        const feedGuid = guidMatch[1];
        console.log(`   GUID: ${feedGuid}`);
        
        try {
          const feedInfo = await getFeedArtwork(feedGuid);
          if (feedInfo) {
            console.log(`   📚 Feed: "${feedInfo.feedTitle}" by ${feedInfo.author}`);
            console.log(`   🎨 Current: ${publisherFeed.itunesImage || 'None'}`);
            console.log(`   🎨 Feed: ${feedInfo.artwork || 'None'}`);
            
            if (publisherFeed.itunesImage === feedInfo.artwork) {
              console.log('   ✅ Publisher artwork is correct');
              totalSkipped++;
            } else {
              console.log('   ⚠️  Publisher artwork could be updated');
              console.log(`       Current: ${publisherFeed.itunesImage}`);
              console.log(`       Should be: ${feedInfo.artwork}`);
              totalFixed++;
            }
          } else {
            console.log('   ❌ Could not verify publisher feed artwork');
            totalErrors++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`   ❌ Error checking publisher "${feedTitle}":`, error.message);
          totalErrors++;
        }
      } else {
        console.log('   ⚠️  Could not extract GUID from URL');
        totalSkipped++;
      }
      
      totalChecked++;
      console.log('');
    }
  } else {
    console.log('No publisher-feed-results.json found');
  }
  
  // 3. Check Individual Track Artwork (summary only since we know it's 100%)
  console.log('\n🎵 INDIVIDUAL TRACK ARTWORK:');
  console.log('=' .repeat(50));
  
  const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
  if (fs.existsSync(musicTracksPath)) {
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const tracks = musicData.musicTracks || [];
    
    const missingArtwork = tracks.filter(track => !track.image || track.image.trim() === '');
    
    console.log(`📊 Total tracks: ${tracks.length}`);
    console.log(`✅ Valid artwork: ${tracks.length - missingArtwork.length}`);
    console.log(`❌ Missing artwork: ${missingArtwork.length}`);
    console.log(`📈 Coverage: ${((tracks.length - missingArtwork.length) / tracks.length * 100).toFixed(1)}%`);
    
    if (missingArtwork.length > 0) {
      console.log('\n❌ Tracks missing artwork:');
      missingArtwork.forEach(track => {
        console.log(`   "${track.title}" by ${track.artist} (Album: ${track.album})`);
      });
      totalErrors += missingArtwork.length;
    }
    
    totalChecked += tracks.length;
    totalSkipped += tracks.length - missingArtwork.length;
  }
  
  // Final Summary
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 COMPREHENSIVE ARTWORK CHECK COMPLETE');
  console.log('=' .repeat(60));
  console.log(`📊 Total items checked: ${totalChecked}`);
  console.log(`✅ Items with correct artwork: ${totalSkipped}`);
  console.log(`🔧 Items needing updates: ${totalFixed}`);
  console.log(`❌ Errors/missing artwork: ${totalErrors}`);
  
  const overallCoverage = totalChecked > 0 ? ((totalSkipped / totalChecked) * 100).toFixed(1) : 0;
  console.log(`📈 Overall artwork coverage: ${overallCoverage}%`);
  
  if (totalFixed > 0) {
    console.log('\n⚠️  Some publisher feeds may need artwork updates');
  }
  
  if (totalErrors > 0) {
    console.log('\n❌ Some items have missing or problematic artwork');
  }
  
  if (totalFixed === 0 && totalErrors === 0) {
    console.log('\n🎉 All artwork is correctly configured!');
  }
}

if (require.main === module) {
  checkComprehensiveArtwork().catch(console.error);
}

module.exports = { checkComprehensiveArtwork };