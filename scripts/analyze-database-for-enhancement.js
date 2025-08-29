#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';
import fs from 'fs';
import path from 'path';

async function analyzeDatabaseForEnhancement() {
  console.log('\n📊 ANALYZING MAIN BRANCH DATABASE FOR ENHANCEMENT POTENTIAL\n');
  console.log('═'.repeat(70));
  
  try {
    const parser = createRSSParser();
    
    // Load main branch database
    const mainBranchPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const mainBranchData = JSON.parse(fs.readFileSync(mainBranchPath, 'utf8'));
    
    console.log(`📁 Loaded ${mainBranchData.musicTracks.length} tracks from main branch`);
    console.log('   Analyzing enhancement potential...\n');
    
    const analysis = {
      totalTracks: mainBranchData.musicTracks.length,
      missingArtists: 0,
      missingDurations: 0,
      enhanceable: [],
      problematicFeeds: [],
      uniqueFeeds: new Set(),
      sampleResults: []
    };
    
    // Quick analysis of what's missing in current data
    mainBranchData.musicTracks.forEach((track, index) => {
      analysis.uniqueFeeds.add(track.feedGuid);
      
      if (!track.feedArtist || track.feedArtist === '') {
        analysis.missingArtists++;
      }
      
      if (!track.duration || track.duration === 0) {
        analysis.missingDurations++;
      }
    });
    
    console.log('📈 CURRENT DATABASE ANALYSIS:');
    console.log(`   Total Tracks: ${analysis.totalTracks}`);
    console.log(`   Missing Artists: ${analysis.missingArtists} (${((analysis.missingArtists/analysis.totalTracks)*100).toFixed(1)}%)`);
    console.log(`   Missing Durations: ${analysis.missingDurations} (${((analysis.missingDurations/analysis.totalTracks)*100).toFixed(1)}%)`);
    console.log(`   Unique Feeds: ${analysis.uniqueFeeds.size}`);
    
    // Test a sample of tracks to see enhancement potential
    console.log('\n🧪 TESTING SAMPLE FOR ENHANCEMENT POTENTIAL...');
    
    const sampleSize = Math.min(20, mainBranchData.musicTracks.length);
    const sampleTracks = [];
    
    // Get a diverse sample
    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor((i / sampleSize) * mainBranchData.musicTracks.length);
      sampleTracks.push({
        index,
        track: mainBranchData.musicTracks[index]
      });
    }
    
    console.log(`   Testing ${sampleTracks.length} sample tracks...\n`);
    
    for (const {index, track} of sampleTracks) {
      console.log(`${index + 1}. Testing "${track.title}"`);
      
      try {
        const resolved = await parser.resolveRemoteItem({
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid?._
        });
        
        const enhancements = [];
        const newArtist = resolved.feed.itunes?.author || resolved.feed.title;
        const newDuration = resolved.item.itunes?.duration;
        
        if (newArtist && newArtist !== track.feedArtist) enhancements.push('Artist');
        if (newDuration && (!track.duration || track.duration === 0)) enhancements.push('Duration');
        if (resolved.item.value) enhancements.push('Value4Value');
        if (resolved.item.enclosure?.url) enhancements.push('Audio URL');
        
        console.log(`   ✅ Enhanceable: ${enhancements.length > 0 ? enhancements.join(', ') : 'Already complete'}`);
        
        analysis.enhanceable.push({
          index,
          track: track.title,
          enhancements,
          newArtist,
          newDuration,
          hasValue: !!resolved.item.value
        });
        
      } catch (error) {
        console.log(`   ❌ Cannot enhance: ${error.message}`);
        analysis.problematicFeeds.push({
          index,
          track: track.title,
          feedGuid: track.feedGuid,
          error: error.message
        });
      }
      
      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n═'.repeat(70));
    console.log('📊 ENHANCEMENT POTENTIAL ANALYSIS');
    console.log('═'.repeat(70));
    
    const enhanceableCount = analysis.enhanceable.length;
    const problematicCount = analysis.problematicFeeds.length;
    
    console.log(`Sample Size: ${sampleTracks.length}`);
    console.log(`Enhanceable: ${enhanceableCount} (${((enhanceableCount/sampleTracks.length)*100).toFixed(1)}%)`);
    console.log(`Problematic: ${problematicCount} (${((problematicCount/sampleTracks.length)*100).toFixed(1)}%)`);
    
    if (enhanceableCount > 0) {
      console.log('\n🎯 ENHANCEMENT BREAKDOWN:');
      const enhancementTypes = {};
      analysis.enhanceable.forEach(item => {
        item.enhancements.forEach(enhancement => {
          enhancementTypes[enhancement] = (enhancementTypes[enhancement] || 0) + 1;
        });
      });
      
      Object.entries(enhancementTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} tracks (${((count/enhanceableCount)*100).toFixed(1)}%)`);
      });
      
      console.log('\n🎵 SAMPLE ENHANCED TRACKS:');
      analysis.enhanceable.slice(0, 5).forEach((item, i) => {
        console.log(`   ${i + 1}. "${item.track}"`);
        console.log(`      New Artist: ${item.newArtist || 'N/A'}`);
        console.log(`      New Duration: ${item.newDuration || 'N/A'}`);
        console.log(`      Value4Value: ${item.hasValue ? '✅' : '❌'}`);
        console.log(`      Enhancements: ${item.enhancements.join(', ') || 'None needed'}`);
        console.log('');
      });
    }
    
    if (problematicCount > 0) {
      console.log('\n❌ PROBLEMATIC FEEDS ANALYSIS:');
      const errorTypes = {};
      analysis.problematicFeeds.forEach(item => {
        errorTypes[item.error] = (errorTypes[item.error] || 0) + 1;
      });
      
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} tracks`);
      });
    }
    
    // Extrapolate results to full database
    console.log('\n📈 ESTIMATED FULL DATABASE IMPACT:');
    if (sampleTracks.length > 0) {
      const enhanceablePercentage = enhanceableCount / sampleTracks.length;
      const estimatedEnhanceable = Math.round(analysis.totalTracks * enhanceablePercentage);
      const estimatedProblematic = Math.round(analysis.totalTracks * (problematicCount / sampleTracks.length));
      
      console.log(`   Estimated Enhanceable Tracks: ~${estimatedEnhanceable}`);
      console.log(`   Estimated Problematic Tracks: ~${estimatedProblematic}`);
      console.log(`   Expected Success Rate: ${((enhanceablePercentage)*100).toFixed(1)}%`);
      
      if (enhancementTypes.Artist) {
        const artistFixPercentage = enhancementTypes.Artist / sampleTracks.length;
        console.log(`   Estimated Artist Names Fixed: ~${Math.round(analysis.totalTracks * artistFixPercentage)}`);
      }
      
      if (enhancementTypes['Value4Value']) {
        const v4vPercentage = enhancementTypes['Value4Value'] / sampleTracks.length;
        console.log(`   Estimated Value4Value Added: ~${Math.round(analysis.totalTracks * v4vPercentage)}`);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (enhanceableCount > problematicCount) {
      console.log('✅ Database enhancement is highly recommended!');
      console.log('   The new RSS parser can significantly improve your data.');
    } else if (enhanceableCount > 0) {
      console.log('⚖️ Database enhancement would provide moderate improvements.');
      console.log('   Consider running on a subset or fixing problematic feeds first.');
    } else {
      console.log('❓ Most feeds in the sample are problematic.');
      console.log('   May need to investigate feed availability in Podcast Index.');
    }
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run "npm run reparse-database" to enhance the full database');
    console.log('2. The script will handle errors gracefully and provide detailed stats');
    console.log('3. Review problematic feeds to understand API limitations');
    console.log('4. Use enhanced data for improved user experience');
    
    console.log('\n✨ Analysis complete!');
    
    // Save analysis results
    const analysisPath = path.join(process.cwd(), 'data', 'database-enhancement-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify({
      ...analysis,
      uniqueFeeds: Array.from(analysis.uniqueFeeds),
      analyzedAt: new Date().toISOString()
    }, null, 2), 'utf8');
    
    console.log(`\n📄 Analysis saved to: ${analysisPath}`);
    
  } catch (error) {
    console.error('❌ Analysis error:', error.message);
  }
}

analyzeDatabaseForEnhancement().catch(console.error);