#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATABASE_FILE = path.join(__dirname, '../public/music-tracks.json');
const BACKUP_FILE = path.join(__dirname, '../data/music-tracks-backup.json');

function migrateDatabase() {
  try {
    console.log('🔄 Migrating database structure...');
    
    // Read current database
    const currentData = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
    console.log(`📊 Current database has ${currentData.musicTracks?.length || 0} tracks`);
    
    // Create backup
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(currentData, null, 2));
    console.log('💾 Backup created at:', BACKUP_FILE);
    
    // Create new database structure
    const newDatabase = {
      musicTracks: currentData.musicTracks || [],
      episodes: currentData.episodes || [],
      feeds: currentData.feeds || [],
      valueTimeSplits: currentData.valueTimeSplits || [],
      valueRecipients: currentData.valueRecipients || [],
      boostagrams: currentData.boostagrams || [],
      funding: currentData.funding || [],
      extractions: currentData.extractions || [],
      analytics: currentData.analytics || [],
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalTracks: currentData.musicTracks?.length || 0,
        totalEpisodes: currentData.episodes?.length || 0,
        totalFeeds: currentData.feeds?.length || 0,
        totalExtractions: currentData.extractions?.length || 0
      }
    };
    
    // Write new database
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(newDatabase, null, 2));
    
    console.log('✅ Database migrated successfully!');
    console.log(`📊 New structure has ${newDatabase.musicTracks.length} tracks`);
    console.log(`📈 Metadata: ${newDatabase.metadata.totalTracks} tracks, ${newDatabase.metadata.totalEpisodes} episodes`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateDatabase(); 