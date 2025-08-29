#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';
import fs from 'fs';
import path from 'path';

async function reparseMainBranchDatabaseRobust() {
  console.log('\n🔄 ROBUST DATABASE REPARSE WITH PROGRESS SAVING\n');
  console.log('═'.repeat(70));
  
  try {
    const parser = createRSSParser();
    const startTime = Date.now();
    
    // Load existing main branch database
    console.log('📁 Loading main branch database...');
    const mainBranchPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const mainBranchData = JSON.parse(fs.readFileSync(mainBranchPath, 'utf8'));
    console.log(`   ✅ Loaded ${mainBranchData.musicTracks.length} tracks`);
    
    // Set up progress tracking
    const progressFile = path.join(process.cwd(), 'data', 'reparse-progress.json');
    const enhancedFile = path.join(process.cwd(), 'data', 'enhanced-music-tracks.json');
    
    // Check for existing progress
    let startIndex = 0;
    let enhancedDatabase = {
      metadata: {
        originalCount: mainBranchData.musicTracks.length,
        enhancedAt: new Date().toISOString(),
        parser: 'feature/rss-feed-parser',
        version: '2.0'
      },
      enhancedTracks: [],
      failedTracks: [],
      enhancementStats: {
        successful: 0,
        failed: 0,
        processed: 0,
        remaining: mainBranchData.musicTracks.length,
        artistNamesFixed: 0,
        valueForValueEnabled: 0,
        audioUrlsAdded: 0,
        durationResolved: 0
      }
    };
    
    if (fs.existsSync(progressFile)) {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      startIndex = progress.lastProcessedIndex + 1;
      console.log(`   📄 Resuming from track ${startIndex + 1}`);
    }
    
    if (fs.existsSync(enhancedFile)) {
      enhancedDatabase = JSON.parse(fs.readFileSync(enhancedFile, 'utf8'));
      console.log(`   📄 Loaded existing enhanced database with ${enhancedDatabase.enhancedTracks.length} tracks`);
    }
    
    // Process in smaller batches with frequent saves
    const BATCH_SIZE = 3;
    const SAVE_EVERY = 30; // Save every 10 batches
    const totalTracks = mainBranchData.musicTracks.length;
    
    console.log(`\n🔄 Processing ${totalTracks - startIndex} remaining tracks in batches of ${BATCH_SIZE}...\n`);
    
    for (let i = startIndex; i < totalTracks; i += BATCH_SIZE) {
      const batch = mainBranchData.musicTracks.slice(i, Math.min(i + BATCH_SIZE, totalTracks));
      const batchNum = Math.floor((i - startIndex) / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil((totalTracks - startIndex) / BATCH_SIZE);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches} (tracks ${i + 1}-${Math.min(i + BATCH_SIZE, totalTracks)})...`);
      
      // Process batch
      const batchPromises = batch.map(async (track, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        try {
          const resolved = await parser.resolveRemoteItem({
            feedGuid: track.feedGuid,
            itemGuid: track.itemGuid?._
          });
          
          const enhancedTrack = {
            originalIndex: globalIndex,
            originalData: track,
            enhancedMetadata: {
              title: resolved.item.title,
              artist: resolved.feed.itunes?.author || resolved.feed.title || track.feedArtist,
              duration: resolved.item.itunes?.duration || track.duration,
              albumTitle: resolved.feed.title,
              description: resolved.item.contentSnippet || resolved.item.content || track.summary,
              publishedDate: resolved.item.pubDate,
              audioUrl: resolved.item.enclosure?.url,
              audioType: resolved.item.enclosure?.type,
              audioSize: resolved.item.enclosure?.length,
              valueForValue: {
                enabled: !!resolved.item.value,
                configuration: resolved.item.value || null
              },
              feedGuid: track.feedGuid,
              itemGuid: track.itemGuid?._
            },
            enhancements: {
              artistNameImproved: (resolved.feed.itunes?.author || resolved.feed.title) !== track.feedArtist,
              durationResolved: !!resolved.item.itunes?.duration,
              valueForValueAdded: !!resolved.item.value,
              audioUrlAdded: !!resolved.item.enclosure?.url
            },
            enhancedAt: new Date().toISOString()
          };
          
          // Update stats
          enhancedDatabase.enhancementStats.successful++;
          if (enhancedTrack.enhancements.artistNameImproved) enhancedDatabase.enhancementStats.artistNamesFixed++;
          if (enhancedTrack.enhancements.valueForValueAdded) enhancedDatabase.enhancementStats.valueForValueEnabled++;
          if (enhancedTrack.enhancements.audioUrlAdded) enhancedDatabase.enhancementStats.audioUrlsAdded++;
          if (enhancedTrack.enhancements.durationResolved) enhancedDatabase.enhancementStats.durationResolved++;
          
          console.log(`   ${globalIndex + 1}. ✅ "${resolved.item.title}" by ${resolved.feed.itunes?.author || 'Unknown'}`);
          return enhancedTrack;
          
        } catch (error) {
          enhancedDatabase.enhancementStats.failed++;
          const failedTrack = {
            originalIndex: globalIndex,
            originalData: track,
            error: error.message,
            failedAt: new Date().toISOString()
          };
          
          console.log(`   ${globalIndex + 1}. ❌ "${track.title}" - ${error.message.substring(0, 50)}...`);
          return { failed: true, data: failedTrack };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.failed) {
            enhancedDatabase.failedTracks.push(result.value.data);
          } else {
            enhancedDatabase.enhancedTracks.push(result.value);
          }
        }
      });
      
      // Update stats
      enhancedDatabase.enhancementStats.processed = i + batch.length;
      enhancedDatabase.enhancementStats.remaining = totalTracks - (i + batch.length);
      
      // Save progress periodically
      if (batchNum % SAVE_EVERY === 0 || i + BATCH_SIZE >= totalTracks) {
        console.log(`   💾 Saving progress... (${enhancedDatabase.enhancementStats.processed}/${totalTracks} processed)`);
        
        // Save enhanced database
        fs.writeFileSync(enhancedFile, JSON.stringify(enhancedDatabase, null, 2), 'utf8');
        
        // Save progress marker
        fs.writeFileSync(progressFile, JSON.stringify({
          lastProcessedIndex: i + batch.length - 1,
          timestamp: new Date().toISOString(),
          batchesCompleted: batchNum
        }, null, 2), 'utf8');
        
        // Show current stats
        const processed = enhancedDatabase.enhancementStats.processed;
        const successful = enhancedDatabase.enhancementStats.successful;
        const failed = enhancedDatabase.enhancementStats.failed;
        console.log(`   📊 Stats: ${successful} enhanced, ${failed} failed (${((successful/processed)*100).toFixed(1)}% success)`);
      }
      
      // Brief pause to respect API limits
      if (i + BATCH_SIZE < totalTracks) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Final save
    enhancedDatabase.metadata.completedAt = new Date().toISOString();
    enhancedDatabase.metadata.processingTimeSeconds = duration;
    fs.writeFileSync(enhancedFile, JSON.stringify(enhancedDatabase, null, 2), 'utf8');
    
    // Create backup of original
    const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-before-enhancement-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(mainBranchData, null, 2), 'utf8');
    
    // Clean up progress file
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
    }
    
    console.log('\n═'.repeat(70));
    console.log('🎉 DATABASE ENHANCEMENT COMPLETE!');
    console.log('═'.repeat(70));
    
    const stats = enhancedDatabase.enhancementStats;
    console.log(`📊 FINAL RESULTS:`);
    console.log(`   Total Processed: ${stats.processed}`);
    console.log(`   Successfully Enhanced: ${stats.successful}`);
    console.log(`   Failed to Enhance: ${stats.failed}`);
    console.log(`   Success Rate: ${((stats.successful / stats.processed) * 100).toFixed(1)}%`);
    console.log(`   Processing Time: ${Math.round(duration)}s (${Math.round(duration/60)}m)`);
    
    console.log(`\n🎯 ENHANCEMENTS APPLIED:`);
    console.log(`   Artist Names Fixed: ${stats.artistNamesFixed}`);
    console.log(`   Value4Value Added: ${stats.valueForValueEnabled}`);
    console.log(`   Audio URLs Added: ${stats.audioUrlsAdded}`);
    console.log(`   Durations Resolved: ${stats.durationResolved}`);
    
    console.log(`\n📁 FILES CREATED:`);
    console.log(`   Enhanced Database: ${enhancedFile}`);
    console.log(`   Original Backup: ${backupPath}`);
    
    if (stats.successful > 0) {
      console.log(`\n🎵 SAMPLE ENHANCED TRACKS:`);
      enhancedDatabase.enhancedTracks.slice(0, 5).forEach((track, index) => {
        console.log(`   ${index + 1}. "${track.enhancedMetadata.title}"`);
        console.log(`      Artist: ${track.enhancedMetadata.artist}`);
        console.log(`      Value4Value: ${track.enhancedMetadata.valueForValue.enabled ? '✅' : '❌'}`);
        const improvements = Object.entries(track.enhancements).filter(([_, value]) => value);
        if (improvements.length > 0) {
          console.log(`      Fixed: ${improvements.map(([key]) => key).join(', ')}`);
        }
      });
    }
    
    console.log(`\n✨ Your database now has proper artist names, Value4Value support,`);
    console.log(`   and direct audio URLs for ${stats.successful} tracks!`);
    
  } catch (error) {
    console.error('\n❌ Error during database enhancement:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

reparseMainBranchDatabaseRobust().catch(console.error);