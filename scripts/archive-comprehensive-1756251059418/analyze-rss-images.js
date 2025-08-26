#!/usr/bin/env node

/**
 * Analyze RSS Feeds for Images
 * 
 * This script analyzes all RSS feeds and shows what images
 * would be uploaded to Bunny.net CDN
 */

import { RSSParser } from '../lib/rss-parser.ts';

// RSS feed URLs to analyze
const RSS_FEEDS = [
  // Main Doerfels feeds
  'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
  'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
  
  // Additional Doerfels albums
  'https://www.doerfelverse.com/feeds/18sundays.xml',
  'https://www.doerfelverse.com/feeds/alandace.xml',
  'https://www.doerfelverse.com/feeds/autumn.xml',
  'https://www.doerfelverse.com/feeds/christ-exalted.xml',
  'https://www.doerfelverse.com/feeds/come-back-to-me.xml',
  'https://www.doerfelverse.com/feeds/dead-time-live-2016.xml',
  'https://www.doerfelverse.com/feeds/dfbv1.xml',
  'https://www.doerfelverse.com/feeds/dfbv2.xml',
  'https://www.doerfelverse.com/feeds/disco-swag.xml',
  'https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml',
  'https://www.doerfelverse.com/feeds/first-married-christmas.xml',
  'https://www.doerfelverse.com/feeds/generation-gap.xml',
  'https://www.doerfelverse.com/feeds/heartbreak.xml',
  'https://www.doerfelverse.com/feeds/merry-christmix.xml',
  'https://www.doerfelverse.com/feeds/middle-season-let-go.xml',
  'https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml',
  'https://www.doerfelverse.com/feeds/possible.xml',
  'https://www.doerfelverse.com/feeds/pour-over.xml',
  'https://www.doerfelverse.com/feeds/psalm-54.xml',
  'https://www.doerfelverse.com/feeds/sensitive-guy.xml',
  'https://www.doerfelverse.com/feeds/they-dont-know.xml',
  'https://www.doerfelverse.com/feeds/think-ep.xml',
  'https://www.doerfelverse.com/feeds/underwater-single.xml',
  'https://www.doerfelverse.com/feeds/unsound-existence.xml',
  'https://www.doerfelverse.com/feeds/you-are-my-world.xml',
  'https://www.doerfelverse.com/feeds/you-feel-like-home.xml',
  'https://www.doerfelverse.com/feeds/your-chance.xml',
  
  // Ed Doerfel projects
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
  'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
  
  // TJ Doerfel projects
  'https://www.thisisjdog.com/media/ring-that-bell.xml',
];

/**
 * Analyze RSS feeds for images
 */
async function analyzeRSSFeeds() {
  console.log('🔍 Analyzing RSS feeds for images...\n');
  
  const results = {
    totalFeeds: RSS_FEEDS.length,
    processedFeeds: 0,
    failedFeeds: 0,
    totalAlbums: 0,
    totalImages: 0,
    albumArtwork: 0,
    trackImages: 0,
    albums: []
  };
  
  // Process each RSS feed
  for (const feedUrl of RSS_FEEDS) {
    try {
      console.log(`\n🔄 Analyzing: ${feedUrl}`);
      
      // Parse RSS feed
      const album = await RSSParser.parseAlbumFeed(feedUrl);
      
      if (!album) {
        console.log(`⚠️  No album data found for: ${feedUrl}`);
        results.failedFeeds++;
        continue;
      }
      
      results.processedFeeds++;
      results.totalAlbums++;
      
      console.log(`📦 Album: "${album.title}" by ${album.artist} (${album.tracks.length} tracks)`);
      
      const albumData = {
        title: album.title,
        artist: album.artist,
        artwork: album.coverArt,
        trackImages: []
      };
      
      // Count album artwork
      if (album.coverArt) {
        results.totalImages++;
        results.albumArtwork++;
        console.log(`🖼️  Album artwork: ${album.coverArt}`);
      } else {
        console.log(`❌ No album artwork found`);
      }
      
      // Count track images
      for (const track of album.tracks) {
        if (track.image) {
          results.totalImages++;
          results.trackImages++;
          albumData.trackImages.push({
            title: track.title,
            image: track.image
          });
          console.log(`🎵 Track image: ${track.title} -> ${track.image}`);
        }
      }
      
      results.albums.push(albumData);
      
    } catch (error) {
      console.error(`❌ Error analyzing feed ${feedUrl}:`, error.message);
      results.failedFeeds++;
    }
  }
  
  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RSS FEED ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total RSS Feeds: ${results.totalFeeds}`);
  console.log(`Processed Feeds: ${results.processedFeeds}`);
  console.log(`Failed Feeds: ${results.failedFeeds}`);
  console.log(`Total Albums: ${results.totalAlbums}`);
  console.log(`Total Images: ${results.totalImages}`);
  console.log(`Album Artwork: ${results.albumArtwork}`);
  console.log(`Track Images: ${results.trackImages}`);
  console.log(`Success Rate: ${results.totalFeeds > 0 ? Math.round((results.processedFeeds / results.totalFeeds) * 100) : 0}%`);
  
  // Show unique image domains
  const imageUrls = [];
  results.albums.forEach(album => {
    if (album.artwork) imageUrls.push(album.artwork);
    album.trackImages.forEach(track => {
      if (track.image) imageUrls.push(track.image);
    });
  });
  
  const domains = [...new Set(imageUrls.map(url => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid-url';
    }
  }))];
  
  console.log(`\n🌐 Image Domains Found:`);
  domains.forEach(domain => {
    const count = imageUrls.filter(url => {
      try {
        return new URL(url).hostname === domain;
      } catch {
        return false;
      }
    }).length;
    console.log(`   ${domain}: ${count} images`);
  });
  
  console.log('\n💡 To upload these images to Bunny.net CDN, run:');
  console.log('   node scripts/upload-to-bunny.js');
  
  return results;
}

// Run the analysis
analyzeRSSFeeds().catch(console.error); 