#!/usr/bin/env node

/**
 * Add Sats and Sounds Music Playlist tracks to the database
 * This script processes remote items from the SAS playlist XML
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

async function addSASPlaylistTracks() {
  try {
    console.log('🎵 Adding Sats and Sounds Music Playlist tracks...\n');
    
    // Download the SAS playlist XML
    console.log('📥 Downloading Sats and Sounds playlist XML...');
    const response = await fetch('https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/SAS-music-playlist.xml');
    const xmlContent = await response.text();
    
    // Parse XML
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    // Extract remote items
    const channel = result.rss.channel[0];
    const remoteItems = channel['podcast:remoteItem'] || [];
    
    console.log(`Found ${remoteItems.length} remote items in SAS playlist`);
    
    // Load existing music tracks
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Track additions
    let addedCount = 0;
    let skippedCount = 0;
    let nextId = Math.max(...musicData.musicTracks.map(track => track.id), 0) + 1;
    
    // Process each remote item
    for (const item of remoteItems) {
      const feedGuid = item.$.feedGuid;
      const itemGuid = item.$.itemGuid;
      
      if (!feedGuid || !itemGuid) {
        console.log('  ⚠️  Skipping item with missing feedGuid or itemGuid');
        skippedCount++;
        continue;
      }
      
      // Check if track already exists
      const existingTrack = musicData.musicTracks.find(track => 
        track.feedGuid === feedGuid && track.itemGuid === itemGuid
      );
      
      if (existingTrack) {
        // Update the source to include SAS if not already present
        if (!existingTrack.source?.includes('SAS')) {
          const currentSource = existingTrack.source || '';
          existingTrack.source = currentSource ? `${currentSource}, SAS` : 'SAS';
          console.log(`  ✅ Updated source for existing track: ${existingTrack.title || 'Unknown'}`);
        }
        skippedCount++;
        continue;
      }
      
      // Create new track entry
      const newTrack = {
        id: nextId,
        title: `Track ${nextId}`, // Placeholder title
        artist: 'Unknown Artist', // Placeholder artist
        album: 'Unknown Album', // Placeholder album
        duration: 0, // Placeholder duration
        audioUrl: '', // Will be resolved later
        image: '', // Will be resolved later
        artwork: '', // Will be resolved later
        addedAt: new Date().toISOString(),
        source: 'SAS',
        feedGuid: feedGuid,
        itemGuid: itemGuid,
        feedTitle: '', // Will be resolved later
        feedImage: '', // Will be resolved later
        feedUrl: '', // Will be resolved later
        publishDate: '', // Will be resolved later
        needsResolution: true // Flag to indicate this needs resolution
      };
      
      musicData.musicTracks.push(newTrack);
      addedCount++;
      nextId++;
      
      console.log(`  ✅ Added track ${newTrack.id} (feedGuid: ${feedGuid.substring(0, 8)}...)`);
    }
    
    // Update metadata
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.totalTracks = musicData.musicTracks.length;
    musicData.metadata.lastUpdated = new Date().toISOString();
    
    // Save the updated database
    fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SAS IMPORT SUMMARY:');
    console.log(`   ✅ New tracks added: ${addedCount}`);
    console.log(`   ⏭️  Existing tracks skipped: ${skippedCount}`);
    console.log(`   📚 Total tracks in database: ${musicData.metadata.totalTracks}`);
    console.log('='.repeat(50));
    
    console.log('\n💡 Next steps:');
    console.log('   Run: node scripts/resolve-sas-tracks.js');
    console.log('   This will resolve the track metadata using the Podcast Index API');
    
  } catch (error) {
    console.error('❌ Error adding SAS tracks:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addSASPlaylistTracks();
}

module.exports = { addSASPlaylistTracks };