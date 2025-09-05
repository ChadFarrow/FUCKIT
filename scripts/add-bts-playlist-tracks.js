#!/usr/bin/env node

/**
 * Add Before the Sch3m3s Playlist tracks to the database
 * This script processes remote items from the BTS playlist XML
 */

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function addBTSPlaylistTracks() {
  try {
    console.log('🎵 Adding Before the Sch3m3s Playlist tracks...\n');
    
    // Download the BTS playlist XML
    console.log('📥 Downloading Before the Sch3m3s playlist XML...');
    const response = await fetch('https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/b4ts-music-playlist.xml');
    const xmlContent = await response.text();
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
    
    const result = parser.parse(xmlContent);
    
    // Extract remote items
    const channel = result?.rss?.channel || {};
    const remoteItemsRaw = channel['podcast:remoteItem'];
    const remoteItems = Array.isArray(remoteItemsRaw) ? remoteItemsRaw : [remoteItemsRaw].filter(Boolean);
    
    console.log(`Found ${remoteItems.length} remote items in Before the Sch3m3s playlist`);
    
    // Load existing music tracks
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Track additions
    let addedCount = 0;
    let skippedCount = 0;
    let nextId = Math.max(...musicData.musicTracks.map(track => track.id), 0) + 1;
    
    // Process each remote item
    for (const item of remoteItems) {
      const feedGuid = item['@_feedGuid'];
      const itemGuid = item['@_itemGuid'];
      
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
        // Update the source to include BTS if not already present
        if (!existingTrack.source?.includes('BTS')) {
          const currentSource = existingTrack.source || '';
          existingTrack.source = currentSource ? `${currentSource}, BTS` : 'BTS';
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
        source: 'BTS',
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
    console.log('📊 BTS IMPORT SUMMARY:');
    console.log(`   ✅ New tracks added: ${addedCount}`);
    console.log(`   ⏭️  Existing tracks skipped: ${skippedCount}`);
    console.log(`   📚 Total tracks in database: ${musicData.metadata.totalTracks}`);
    console.log('='.repeat(50));
    
    console.log('\n💡 Next steps:');
    console.log('   Run: node scripts/resolve-bts-tracks.js');
    console.log('   This will resolve the track metadata using the Podcast Index API');
    
  } catch (error) {
    console.error('❌ Error adding BTS tracks:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addBTSPlaylistTracks();
}

module.exports = { addBTSPlaylistTracks };