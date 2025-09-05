#!/usr/bin/env node

/**
 * Re-add HGH tracks from updated playlist to check for new feedGuids
 * This will replace existing HGH tracks with updated data
 */

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

async function reAddHGHTracks() {
  try {
    console.log('🔄 Re-importing HGH tracks from updated playlist...\n');
    
    // Download the updated HGH playlist XML
    console.log('📥 Downloading updated HGH playlist XML...');
    const response = await fetch('https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml');
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
    
    console.log(`Found ${remoteItems.length} remote items in updated HGH playlist`);
    
    // Load existing music tracks
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Remove existing HGH tracks
    const originalCount = musicData.musicTracks.length;
    musicData.musicTracks = musicData.musicTracks.filter(track => 
      !track.source || (!track.source.includes('HGH'))
    );
    const removedCount = originalCount - musicData.musicTracks.length;
    console.log(`Removed ${removedCount} existing HGH tracks`);
    
    // Track additions
    let addedCount = 0;
    let nextId = Math.max(...musicData.musicTracks.map(track => track.id), 0) + 1;
    
    // Process each remote item
    for (const item of remoteItems) {
      const feedGuid = item['@_feedGuid'];
      const itemGuid = item['@_itemGuid'];
      
      if (!feedGuid || !itemGuid) {
        console.log('  ⚠️  Skipping item with missing feedGuid or itemGuid');
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
        source: 'HGH Playlist - Music Reference',
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
    }
    
    // Update metadata
    musicData.metadata = musicData.metadata || {};
    musicData.metadata.totalTracks = musicData.musicTracks.length;
    musicData.metadata.lastUpdated = new Date().toISOString();
    
    // Save the updated database
    fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
    
    // Show sample of new feedGuids to compare
    console.log('\nSample of new HGH feedGuids:');
    const newHGHTracks = musicData.musicTracks.filter(t => t.source && t.source.includes('HGH')).slice(0, 5);
    newHGHTracks.forEach(track => {
      console.log(`  Track ${track.id}: feedGuid ${track.feedGuid}`);
    });
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 HGH RE-IMPORT SUMMARY:');
    console.log(`   🗑️  Removed old tracks: ${removedCount}`);
    console.log(`   ✅ New tracks added: ${addedCount}`);
    console.log(`   📚 Total tracks in database: ${musicData.metadata.totalTracks}`);
    console.log('='.repeat(50));
    
    console.log('\n💡 Next step: Test resolution with updated feedGuids');
    
  } catch (error) {
    console.error('❌ Error re-adding HGH tracks:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  reAddHGHTracks();
}

module.exports = { reAddHGHTracks };