#!/usr/bin/env node

/**
 * Parse all feeds and store the information needed for the app
 * This script will:
 * 1. Parse all active feeds from data/feeds.json
 * 2. Extract album and publisher information
 * 3. Store parsed data in data/parsed-feeds.json
 * 4. Generate a detailed parse report
 */

const { FeedParser } = require('../lib/feed-parser.ts');
const { FeedManager } = require('../lib/feed-manager.ts');

async function main() {
  console.log('🚀 Starting comprehensive feed parsing...\n');
  
  try {
    // Get feed statistics before parsing
    const activeFeeds = FeedManager.getActiveFeeds();
    console.log(`📊 Found ${activeFeeds.length} active feeds to parse`);
    
    const albumFeeds = activeFeeds.filter(f => f.type === 'album');
    const publisherFeeds = activeFeeds.filter(f => f.type === 'publisher');
    
    console.log(`🎵 Album feeds: ${albumFeeds.length}`);
    console.log(`🏢 Publisher feeds: ${publisherFeeds.length}`);
    
    // Parse all feeds
    const report = await FeedParser.parseAllFeeds();
    
    console.log('\n📈 Parse Report Summary:');
    console.log('========================');
    console.log(`✅ Successful parses: ${report.successfulParses}/${report.totalFeeds}`);
    console.log(`❌ Failed parses: ${report.failedParses}`);
    console.log(`🎵 Albums found: ${report.albumsFound}`);
    console.log(`🏢 Publishers found: ${report.publishersFound}`);
    console.log(`🎼 Total tracks: ${report.totalTracks}`);
    console.log(`⏱️ Total duration: ${report.totalDuration}`);
    console.log(`🎯 PodRoll feeds: ${report.podRollFeeds}`);
    console.log(`💰 Funding feeds: ${report.fundingFeeds}`);
    console.log(`⏱️ Parse time: ${(report.parseTime / 1000).toFixed(2)}s`);
    
    if (report.errors.length > 0) {
      console.log('\n❌ Parse Errors:');
      console.log('================');
      report.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.feedId}: ${error.error}`);
      });
    }
    
    // Get additional statistics
    const stats = FeedParser.getParseStats();
    console.log('\n📊 Additional Statistics:');
    console.log('=========================');
    console.log(`📁 Parsed feeds stored: ${stats.totalFeeds}`);
    console.log(`✅ Success rate: ${((stats.successfulParses / stats.totalFeeds) * 100).toFixed(1)}%`);
    
    // Show some example data
    const albums = FeedParser.getParsedAlbums();
    if (albums.length > 0) {
      console.log('\n🎵 Sample Albums:');
      console.log('=================');
      albums.slice(0, 5).forEach((album, index) => {
        console.log(`${index + 1}. ${album.title} by ${album.artist} (${album.tracks.length} tracks)`);
      });
    }
    
    const podRollAlbums = FeedParser.getAlbumsWithPodRoll();
    if (podRollAlbums.length > 0) {
      console.log('\n🎯 Albums with PodRoll:');
      console.log('=======================');
      podRollAlbums.forEach((album, index) => {
        console.log(`${index + 1}. ${album.title} by ${album.artist}`);
      });
    }
    
    const fundingAlbums = FeedParser.getAlbumsWithFunding();
    if (fundingAlbums.length > 0) {
      console.log('\n💰 Albums with Funding:');
      console.log('=======================');
      fundingAlbums.forEach((album, index) => {
        console.log(`${index + 1}. ${album.title} by ${album.artist}`);
      });
    }
    
    console.log('\n✅ Feed parsing completed successfully!');
    console.log('📁 Data saved to: data/parsed-feeds.json');
    console.log('📊 Report saved to: data/parse-reports/');
    
  } catch (error) {
    console.error('❌ Error during feed parsing:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 