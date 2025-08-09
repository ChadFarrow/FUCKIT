#!/usr/bin/env node

const { MusicTrackDatabaseService } = require('../lib/music-track-database');

async function testDatabase() {
  try {
    console.log('🔍 Testing database service...');
    
    const db = MusicTrackDatabaseService.getInstance();
    
    // Test loading database
    const database = await db.loadDatabase();
    console.log(`📊 Database loaded: ${database.musicTracks.length} tracks`);
    
    // Test search
    const searchResult = await db.searchMusicTracks({ source: 'rss-playlist' }, 1, 5);
    console.log(`🔍 Search result: ${searchResult.tracks.length} tracks found`);
    
    // Test statistics
    const stats = await db.getStatistics();
    console.log('📈 Statistics:', stats);
    
  } catch (error) {
    console.error('❌ Error testing database:', error);
  }
}

testDatabase(); 