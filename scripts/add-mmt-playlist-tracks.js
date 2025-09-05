#!/usr/bin/env node

/**
 * Add Mutton Mead & Tunes Playlist tracks to the database
 * This script processes remote items from the MMT playlist XML
 */

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function addMMTPlaylistTracks() {
  try {
    console.log('🎵 Adding Mutton Mead & Tunes Playlist tracks...\n');
    
    // Download the MMT playlist XML
    console.log('📥 Downloading Mutton Mead & Tunes playlist XML...');
    const response = await fetch('https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/MMT-muic-playlist.xml');
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
    
    console.log(`Found ${remoteItems.length} remote items in Mutton Mead & Tunes playlist`);
    
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
        // Update the source to include MMT if not already present
        if (!existingTrack.source?.includes('MMT')) {
          const currentSource = existingTrack.source || '';
          existingTrack.source = currentSource ? `${currentSource}, MMT` : 'MMT';
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
        source: 'MMT',
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
    console.log('📊 MMT IMPORT SUMMARY:');
    console.log(`   ✅ New tracks added: ${addedCount}`);
    console.log(`   ⏭️  Existing tracks skipped: ${skippedCount}`);
    console.log(`   📚 Total tracks in database: ${musicData.metadata.totalTracks}`);
    console.log('='.repeat(50));
    
    console.log('\n💡 Next steps:');
    console.log('   Run: node scripts/resolve-mmt-tracks.js');
    console.log('   This will resolve the track metadata using the Podcast Index API');
    
  } catch (error) {
    console.error('❌ Error adding MMT tracks:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addMMTPlaylistTracks();
}

module.exports = { addMMTPlaylistTracks };