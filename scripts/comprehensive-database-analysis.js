#!/usr/bin/env node

/**
 * Comprehensive Database Analysis
 * 
 * This script provides detailed analysis of the music database including
 * missing items, duplicates, and data quality issues.
 */

const fs = require('fs');
const path = require('path');

// Database file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const MUSIC_TRACKS_FILE = path.join(DATA_DIR, 'music-tracks.json');
const ALBUMS_MISSING_ARTWORK_FILE = path.join(DATA_DIR, 'albums-missing-artwork.json');
const ALBUMS_WITHOUT_PUBLISHER_FILE = path.join(DATA_DIR, 'albums-without-publisher.json');

async function analyzeDatabase() {
  console.log('🔍 Comprehensive Database Analysis\n');
  
  try {
    // Load music tracks
    if (fs.existsSync(MUSIC_TRACKS_FILE)) {
      const musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_FILE, 'utf8'));
      const musicTracks = musicData.musicTracks || musicData;
      
      console.log('📊 MUSIC TRACKS ANALYSIS');
      console.log('═'.repeat(50));
      console.log(`Total Tracks: ${musicTracks.length}`);
      
      // Analyze duplicates
      const duplicates = findDuplicates(musicTracks);
      console.log(`\n🔄 DUPLICATES: ${duplicates.length} found`);
      if (duplicates.length > 0) {
        console.log('Top duplicates:');
        duplicates.slice(0, 10).forEach(dup => {
          console.log(`   • ${dup.title} by ${dup.artist} (${dup.count} instances)`);
        });
      }
      
      // Analyze missing data
      const missingData = analyzeMissingData(musicTracks);
      console.log('\n❌ MISSING DATA:');
      Object.entries(missingData).forEach(([field, count]) => {
        const percentage = ((count / musicTracks.length) * 100).toFixed(1);
        console.log(`   • ${field}: ${count} tracks (${percentage}%)`);
      });
      
      // Analyze data quality
      const qualityIssues = analyzeDataQuality(musicTracks);
      console.log('\n⚠️  DATA QUALITY ISSUES:');
      Object.entries(qualityIssues).forEach(([issue, tracks]) => {
        if (tracks.length > 0) {
          console.log(`   • ${issue}: ${tracks.length} tracks`);
          if (tracks.length <= 5) {
            tracks.forEach(track => {
              console.log(`     - ${track.title || 'No title'} by ${track.artist || 'No artist'}`);
            });
          }
        }
      });
      
      // Analyze by feed
      const feedAnalysis = analyzeByFeed(musicTracks);
      console.log('\n📡 FEED ANALYSIS:');
      console.log(`Total Feeds: ${feedAnalysis.totalFeeds}`);
      console.log(`Feeds with Issues: ${feedAnalysis.feedsWithIssues.length}`);
      
      if (feedAnalysis.feedsWithIssues.length > 0) {
        console.log('\nFeeds with most issues:');
        feedAnalysis.feedsWithIssues.slice(0, 5).forEach(feed => {
          console.log(`   • ${feed.feedTitle || feed.feedUrl}: ${feed.issueCount} issues`);
        });
      }
    }
    
    // Load and analyze missing artwork
    if (fs.existsSync(ALBUMS_MISSING_ARTWORK_FILE)) {
      const missingArtwork = JSON.parse(fs.readFileSync(ALBUMS_MISSING_ARTWORK_FILE, 'utf8'));
      console.log('\n🖼️  MISSING ARTWORK ANALYSIS');
      console.log('═'.repeat(50));
      console.log(`Total Albums Missing Artwork: ${missingArtwork.length}`);
      
      if (missingArtwork.length > 0) {
        console.log('\nSample albums missing artwork:');
        missingArtwork.slice(0, 10).forEach(album => {
          console.log(`   • ${album.title || 'No title'} by ${album.artist || 'No artist'}`);
        });
      }
    }
    
    // Load and analyze missing publishers
    if (fs.existsSync(ALBUMS_WITHOUT_PUBLISHER_FILE)) {
      const missingPublisher = JSON.parse(fs.readFileSync(ALBUMS_WITHOUT_PUBLISHER_FILE, 'utf8'));
      console.log('\n🏢 MISSING PUBLISHER ANALYSIS');
      console.log('═'.repeat(50));
      console.log(`Total Albums Without Publisher: ${missingPublisher.length}`);
      
      if (missingPublisher.length > 0) {
        console.log('\nSample albums without publisher:');
        missingPublisher.slice(0, 10).forEach(album => {
          console.log(`   • ${album.title || 'No title'} by ${album.artist || 'No artist'}`);
        });
      }
    }
    
    // Generate recommendations
    generateRecommendations();
    
  } catch (error) {
    console.error('❌ Error analyzing database:', error.message);
  }
}

function findDuplicates(tracks) {
  const seen = new Map();
  
  tracks.forEach(track => {
    const key = `${track.title || ''}-${track.artist || ''}`.toLowerCase();
    if (seen.has(key)) {
      seen.get(key).count++;
    } else {
      seen.set(key, { title: track.title, artist: track.artist, count: 1 });
    }
  });
  
  const duplicates = [];
  for (const [key, value] of seen) {
    if (value.count > 1) {
      duplicates.push(value);
    }
  }
  
  return duplicates.sort((a, b) => b.count - a.count);
}

function analyzeMissingData(tracks) {
  const missing = {
    'Title': 0,
    'Artist': 0,
    'Artwork URL': 0,
    'Audio URL': 0,
    'Duration': 0,
    'Publisher': 0,
    'Feed Title': 0,
    'Feed Description': 0
  };
  
  tracks.forEach(track => {
    if (!track.title || track.title.trim() === '') missing['Title']++;
    if (!track.artist || track.artist.trim() === '') missing['Artist']++;
    if (!track.artworkUrl || track.artworkUrl.trim() === '') missing['Artwork URL']++;
    if (!track.audioUrl || track.audioUrl.trim() === '') missing['Audio URL']++;
    if (!track.duration || track.duration === '') missing['Duration']++;
    if (!track.publisher || track.publisher.trim() === '') missing['Publisher']++;
    if (!track.feedTitle || track.feedTitle.trim() === '') missing['Feed Title']++;
    if (!track.feedDescription || track.feedDescription.trim() === '') missing['Feed Description']++;
  });
  
  return missing;
}

function analyzeDataQuality(tracks) {
  const issues = {
    'Empty Duration': [],
    'Placeholder Artwork': [],
    'Invalid URLs': [],
    'Missing GUIDs': []
  };
  
  tracks.forEach(track => {
    if (track.duration === '' || track.duration === '0') {
      issues['Empty Duration'].push(track);
    }
    
    if (track.artworkUrl && track.artworkUrl.includes('placeholder')) {
      issues['Placeholder Artwork'].push(track);
    }
    
    if (track.audioUrl && !track.audioUrl.startsWith('http')) {
      issues['Invalid URLs'].push(track);
    }
    
    if (!track.itemGuid || !track.itemGuid._) {
      issues['Missing GUIDs'].push(track);
    }
  });
  
  return issues;
}

function analyzeByFeed(tracks) {
  const feeds = new Map();
  
  tracks.forEach(track => {
    const feedUrl = track.feedUrl || 'unknown';
    if (!feeds.has(feedUrl)) {
      feeds.set(feedUrl, {
        feedUrl,
        feedTitle: track.feedTitle,
        trackCount: 0,
        issues: 0
      });
    }
    
    const feed = feeds.get(feedUrl);
    feed.trackCount++;
    
    // Count issues
    if (!track.title || !track.artist || !track.artworkUrl || !track.audioUrl) {
      feed.issues++;
    }
  });
  
  const feedsWithIssues = Array.from(feeds.values())
    .filter(feed => feed.issues > 0)
    .sort((a, b) => b.issues - a.issues)
    .map(feed => ({ ...feed, issueCount: feed.issues }));
  
  return {
    totalFeeds: feeds.size,
    feedsWithIssues
  };
}

function generateRecommendations() {
  console.log('\n💡 RECOMMENDATIONS');
  console.log('═'.repeat(50));
  console.log('1. 🔄 DUPLICATES:');
  console.log('   • Run: node scripts/exact-match-deduplication.js');
  console.log('   • Run: node scripts/smart-deduplication.js');
  console.log('   • Run: node scripts/final-deduplication.js');
  
  console.log('\n2. 🖼️  MISSING ARTWORK:');
  console.log('   • Run: node scripts/check-all-artwork-comprehensive.js');
  console.log('   • Run: node scripts/search-podcastindex-for-artwork.js');
  console.log('   • Run: node scripts/fix-all-album-artwork.js');
  
  console.log('\n3. 🏢 MISSING PUBLISHERS:');
  console.log('   • Run: node scripts/find-missing-publisher-albums.js');
  console.log('   • Run: node scripts/fetch-missing-publishers.js');
  console.log('   • Run: node scripts/add-missing-publisher-info.js');
  
  console.log('\n4. 🎵 MISSING AUDIO URLs:');
  console.log('   • Run: node scripts/batch-resolve-308-optimized.js');
  console.log('   • Run: node scripts/resolve-remote-item.js');
  
  console.log('\n5. ⏱️  MISSING DURATIONS:');
  console.log('   • Run: node scripts/duration-fixer.js');
  
  console.log('\n6. 🔍 COMPREHENSIVE FIX:');
  console.log('   • Run: node scripts/comprehensive-database-fix.js');
  console.log('   • Run: node scripts/fix-database-gaps.js');
}

// Run the analysis
analyzeDatabase();
