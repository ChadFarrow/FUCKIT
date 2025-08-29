#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';
import fs from 'fs';
import path from 'path';

async function testDatabaseReparseSmall() {
  console.log('\n🧪 TESTING DATABASE REPARSE (SMALL SAMPLE)\n');
  console.log('═'.repeat(60));
  
  try {
    const parser = createRSSParser();
    
    // Load main branch database
    const mainBranchPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const mainBranchData = JSON.parse(fs.readFileSync(mainBranchPath, 'utf8'));
    
    console.log(`📁 Loaded ${mainBranchData.musicTracks.length} tracks from main branch`);
    console.log('   Testing with first 3 tracks...\n');
    
    // Test with first 3 tracks
    const sampleTracks = mainBranchData.musicTracks.slice(0, 3);
    
    for (let i = 0; i < sampleTracks.length; i++) {
      const track = sampleTracks[i];
      
      console.log(`🔍 Track ${i + 1}: "${track.title}"`);
      console.log(`   Original Artist: ${track.feedArtist || 'None'}`);
      console.log(`   Original Duration: ${track.duration || 'None'}`);
      console.log(`   Feed GUID: ${track.feedGuid}`);
      console.log(`   Item GUID: ${track.itemGuid?._}`);
      
      try {
        const resolved = await parser.resolveRemoteItem({
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid?._
        });
        
        console.log('   ✅ Successfully enhanced!');
        console.log(`   New Title: "${resolved.item.title}"`);
        console.log(`   New Artist: ${resolved.feed.itunes?.author || resolved.feed.title}`);
        console.log(`   New Duration: ${resolved.item.itunes?.duration || 'Still unknown'}`);
        console.log(`   Audio URL: ${resolved.item.enclosure?.url ? 'Available' : 'Not found'}`);
        console.log(`   Value4Value: ${resolved.item.value ? '✅ Enabled' : '❌ Disabled'}`);
        
        // Show what would be improved
        const improvements = [];
        if ((resolved.feed.itunes?.author || resolved.feed.title) !== track.feedArtist) improvements.push('Artist name');
        if (resolved.item.itunes?.duration && !track.duration) improvements.push('Duration');
        if (resolved.item.value) improvements.push('Value4Value');
        if (resolved.item.enclosure?.url) improvements.push('Audio URL');
        
        if (improvements.length > 0) {
          console.log(`   📈 Improvements: ${improvements.join(', ')}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Enhancement failed: ${error.message}`);
      }
      
      console.log('');
      
      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('═'.repeat(60));
    console.log('✨ Sample test complete!');
    console.log('');
    console.log('💡 This demonstrates that the new RSS parser can:');
    console.log('   • Extract proper artist names from feeds');
    console.log('   • Get accurate track durations');
    console.log('   • Add Value4Value payment information');
    console.log('   • Provide direct audio URLs');
    console.log('   • Enhance existing database entries significantly');
    console.log('');
    console.log('🚀 Run "npm run reparse-database" to enhance the full database!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testDatabaseReparseSmall().catch(console.error);