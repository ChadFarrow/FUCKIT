#!/usr/bin/env node

/**
 * Cache all artwork and audio from parsed feeds
 * This script will:
 * 1. Initialize the cache system
 * 2. Download and cache all artwork from parsed feeds
 * 3. Download and cache all audio files from parsed feeds
 * 4. Generate cache statistics and reports
 */

const { FeedCache } = require('../lib/feed-cache.ts');
const { FeedParser } = require('../lib/feed-parser.ts');

async function main() {
  console.log('🚀 Starting comprehensive feed caching...\n');
  
  try {
    // Initialize cache system
    await FeedCache.initialize();
    
    // Get parse statistics
    const parseStats = FeedParser.getParseStats();
    console.log(`📊 Found ${parseStats.albumsFound} albums with ${parseStats.totalTracks} tracks`);
    
    // Cache all feeds
    const result = await FeedCache.cacheAllFeeds();
    
    console.log('\n📈 Cache Report Summary:');
    console.log('========================');
    console.log(`✅ Total feeds processed: ${result.totalProcessed}`);
    console.log(`🖼️ Artwork files cached: ${result.artworkCached}`);
    console.log(`🎵 Audio files cached: ${result.audioCached}`);
    console.log(`❌ Errors encountered: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Cache Errors:');
      console.log('================');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url}: ${error.error}`);
      });
    }
    
    // Get cache statistics
    const cacheStats = FeedCache.getCacheStats();
    console.log('\n📊 Cache Statistics:');
    console.log('====================');
    console.log(`📁 Total cached items: ${cacheStats.totalItems}`);
    console.log(`💾 Total cache size: ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🖼️ Artwork files: ${cacheStats.artworkCount}`);
    console.log(`🎵 Audio files: ${cacheStats.audioCount}`);
    console.log(`📅 Oldest item: ${new Date(cacheStats.oldestItem).toLocaleDateString()}`);
    console.log(`📅 Newest item: ${new Date(cacheStats.newestItem).toLocaleDateString()}`);
    
    // Show some example cached items
    const parsedFeeds = FeedParser.getParsedFeeds();
    const albums = parsedFeeds.filter(f => f.type === 'album' && f.parsedData?.album).slice(0, 3);
    
    console.log('\n🎵 Sample Cached Albums:');
    console.log('=========================');
    for (const feed of albums) {
      const album = feed.parsedData.album;
      console.log(`📀 ${album.title} by ${album.artist}`);
      console.log(`   🖼️ Cover art: ${album.coverArt ? '✅ Cached' : '❌ No cover art'}`);
      console.log(`   🎵 Tracks: ${album.tracks.length} (${album.tracks.filter(t => t.url).length} with audio)`);
      console.log('');
    }
    
    console.log('✅ Feed caching completed successfully!');
    console.log('📁 Cached files stored in: data/cache/');
    console.log('📊 Cache metadata: data/cache/cache-metadata.json');
    console.log('📈 Cache stats: data/cache/cache-stats.json');
    
  } catch (error) {
    console.error('❌ Error during feed caching:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 